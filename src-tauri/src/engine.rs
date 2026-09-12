use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use crate::models::{ExtractorLink, HomePageList, LoadResponse, SearchResponse};

pub const DEFAULT_ENGINE_PORT: u16 = 45732;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineProviderInfo {
    pub name: String,
    pub main_url: String,
    pub supported_types: Vec<String>,
    pub has_main_page: bool,
    pub lang: String,
}

pub struct EngineClient {
    client: Client,
    base_url: String,
    port: u16,
}

impl EngineClient {
    pub fn new(port: Option<u16>) -> Self {
        let p = port.unwrap_or(DEFAULT_ENGINE_PORT);
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(35))
                .build()
                .unwrap_or_else(|_| Client::new()),
            base_url: format!("http://127.0.0.1:{}", p),
            port: p,
        }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn is_healthy(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        let check_client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap_or_else(|_| Client::new());

        match check_client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn ensure_running(&self) {
        if self.is_healthy().await {
            println!("[EngineClient] Headless .cs3 engine already active on {}", self.base_url);
            return;
        }

        println!("[EngineClient] Headless .cs3 engine not detected. Attempting to start daemon...");

        // Try locating Windows desktop app root or built jar
        let candidate_dirs = [
            PathBuf::from(r"d:\Poject\CloudStream\Windows desktop app"),
            std::env::current_dir()
                .unwrap_or_default()
                .join("..")
                .join("Windows desktop app"),
        ];

        let mut started = false;
        for dir in candidate_dirs {
            let jar_path = dir.join("build").join("compose").join("jars").join("CloudStream Desktop-windows-x64-1.2.4.jar");
            if jar_path.exists() {
                println!("[EngineClient] Spawning EngineServer via packaged jar: {:?}", jar_path);
                let java_cmd = std::env::var("JAVA_HOME")
                    .map(|jh| PathBuf::from(jh).join("bin").join("java.exe"))
                    .unwrap_or_else(|_| PathBuf::from(r"C:\Program Files\Java\jdk-22\bin\java.exe"));

                let java_bin = if java_cmd.exists() {
                    java_cmd.to_string_lossy().to_string()
                } else {
                    "java".to_string()
                };

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    let _ = Command::new(&java_bin)
                        .current_dir(&dir)
                        .args(["-jar", &jar_path.to_string_lossy(), "--server", "--port", &self.port.to_string()])
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                    started = true;
                }
                break;
            }

            let gradlew = dir.join("gradlew.bat");
            if gradlew.exists() {
                println!("[EngineClient] Spawning EngineServer via {:?}", gradlew);
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    let _ = Command::new(&gradlew)
                        .current_dir(&dir)
                        .args(["run", &format!("--args=--server --port {}", self.port)])
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                    started = true;
                }
                break;
            }
        }

        if started {
            // Poll for up to 15 seconds for startup
            for i in 1..=15 {
                tokio::time::sleep(Duration::from_secs(1)).await;
                if self.is_healthy().await {
                    println!("[EngineClient] Headless engine is now healthy and listening on port {}", self.port);
                    return;
                }
                println!("[EngineClient] Waiting for engine server to respond... ({}/15)", i);
            }
        }
    }

    pub async fn get_providers(&self) -> Result<Vec<EngineProviderInfo>> {
        let url = format!("{}/providers", self.base_url);
        let resp = self.client.get(&url).send().await?;
        let providers: Vec<EngineProviderInfo> = resp.json().await?;
        Ok(providers)
    }

    pub async fn get_main_page(&self, provider: Option<&str>, page: i32) -> Result<Vec<HomePageList>> {
        let url = format!("{}/main_page", self.base_url);
        let mut body = serde_json::json!({
            "page": page
        });
        if let Some(p) = provider {
            body["provider"] = serde_json::Value::String(p.to_string());
        }

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to fetch main page from engine: {}", err_text));
        }

        let shelves: Vec<HomePageList> = resp.json().await?;
        Ok(shelves)
    }

    pub async fn search(&self, query: &str, provider: Option<&str>) -> Result<Vec<SearchResponse>> {
        let url = format!("{}/search", self.base_url);
        let mut body = serde_json::json!({
            "query": query
        });
        if let Some(p) = provider {
            body["provider"] = serde_json::Value::String(p.to_string());
        }

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Engine search error: {}", err_text));
        }

        let results: Vec<SearchResponse> = resp.json().await?;
        Ok(results)
    }

    pub async fn load(&self, provider: &str, url_str: &str) -> Result<LoadResponse> {
        let url = format!("{}/load", self.base_url);
        let body = serde_json::json!({
            "provider": provider,
            "url": url_str
        });

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Engine load error: {}", err_text));
        }

        let details: LoadResponse = resp.json().await?;
        Ok(details)
    }

    pub async fn load_links(&self, provider: &str, data_str: &str) -> Result<Vec<ExtractorLink>> {
        let url = format!("{}/load_links", self.base_url);
        let body = serde_json::json!({
            "provider": provider,
            "data": data_str
        });

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Engine load_links error: {}", err_text));
        }

        let links: Vec<ExtractorLink> = resp.json().await?;
        Ok(links)
    }

    pub async fn reload(&self) -> Result<()> {
        let url = format!("{}/reload", self.base_url);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Engine reload error: {}", err_text));
        }
        Ok(())
    }
}
