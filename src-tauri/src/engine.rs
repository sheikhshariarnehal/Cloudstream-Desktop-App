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

    /// Returns the best Java 17 executable path (required for dex-translator compatibility).
    fn find_java17() -> String {
        let jdk17 = PathBuf::from(r"C:\Program Files\Java\jdk-17\bin\java.exe");
        if jdk17.exists() {
            return jdk17.to_string_lossy().to_string();
        }
        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            let java = PathBuf::from(java_home).join("bin").join("java.exe");
            if java.exists() {
                return java.to_string_lossy().to_string();
            }
        }
        "java".to_string()
    }

    /// Returns the engine JAR path. Searches next to our binary and common build locations.
    fn find_engine_jar() -> Option<PathBuf> {
        // Check next to the running executable first (for packaged app)
        if let Ok(exe) = std::env::current_exe() {
            let candidates = [
                exe.parent().map(|p| p.join("engine.jar")),
                exe.parent().map(|p| p.join("CloudStream Desktop-windows-x64-1.2.4.jar")),
            ];
            for c in candidates.into_iter().flatten() {
                if c.exists() { return Some(c); }
            }
        }
        // Dev-time: look in src-tauri/ inside our CloudStream-Desktop project
        let dev_candidates = [
            PathBuf::from(r"d:\Poject\CloudStream\CloudStream-Desktop\src-tauri\engine.jar"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("engine.jar"),
        ];
        for c in dev_candidates {
            if c.exists() { return Some(c); }
        }
        None
    }

    /// Returns the android-stubs.jar path bundled with our Tauri app.
    fn find_stubs_jar() -> Option<PathBuf> {
        // Packaged app: stubs sit next to the executable
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let p = dir.join("android-stubs.jar");
                if p.exists() { return Some(p); }
            }
        }
        // Dev-time: stubs sit in src-tauri/
        let dev_candidates = [
            PathBuf::from(r"d:\Poject\CloudStream\CloudStream-Desktop\src-tauri\android-stubs.jar"),
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("android-stubs.jar"),
        ];
        for c in dev_candidates {
            if c.exists() { return Some(c); }
        }
        None
    }

    /// Kill any process listening on our engine port so we can start fresh.
    #[cfg(target_os = "windows")]
    fn kill_engine_on_port(port: u16) {
        // netstat -ano -p TCP to find PID
        let output = std::process::Command::new("netstat")
            .args(["-ano", "-p", "TCP"])
            .output();
        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains(&format!(":{}", port)) && line.contains("LISTENING") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pid_str) = parts.last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            if pid > 4 {
                                let _ = std::process::Command::new("taskkill")
                                    .args(["/PID", &pid.to_string(), "/F"])
                                    .output();
                                println!("[EngineClient] Killed stale engine process PID {}", pid);
                            }
                        }
                    }
                }
            }
        }
    }

    /// Spawn the engine, wait up to 25 s for it to become healthy.
    async fn spawn_and_wait(&self) -> bool {
        let Some(jar_path) = Self::find_engine_jar() else {
            println!("[EngineClient] Could not locate engine JAR — .cs3 extensions unavailable");
            return false;
        };
        let jar_dir = jar_path.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));

        let java_bin = Self::find_java17();
        let stubs = Self::find_stubs_jar();

        // Build classpath: android-stubs.jar;engine.jar
        // We launch via MainClass instead of -jar so extra classpath entries are honoured.
        let cp = if let Some(ref s) = stubs {
            format!("{};{}", s.to_string_lossy(), jar_path.to_string_lossy())
        } else {
            jar_path.to_string_lossy().to_string()
        };
        let main_class = "com.lagradost.cloudstream.desktop.MainKt";

        println!(
            "[EngineClient] Spawning engine: java={} cp=... MainClass={}",
            java_bin, main_class
        );
        if stubs.is_some() {
            println!("[EngineClient] Android stubs injected — AppCompatActivity crash prevented");
        } else {
            println!("[EngineClient] Warning: android-stubs.jar not found; CastleTv may crash");
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let result = Command::new(&java_bin)
                .current_dir(&jar_dir)
                .args([
                    "-Xverify:none",
                    "-cp", &cp,
                    main_class,
                    "--server",
                    "--port", &self.port.to_string(),
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
            if let Err(e) = result {
                println!("[EngineClient] Failed to spawn engine: {}", e);
                return false;
            }
        }

        // Phase 1: Poll up to 25 s for /health to pass
        let mut healthy = false;
        for i in 1..=25 {
            tokio::time::sleep(Duration::from_secs(1)).await;
            if self.is_healthy().await {
                println!("[EngineClient] Engine /health passed after {}s", i);
                healthy = true;
                break;
            }
            if i % 5 == 0 {
                println!("[EngineClient] Waiting for engine health... ({}/25s)", i);
            }
        }

        if !healthy {
            println!("[EngineClient] Engine did not become healthy within 25s");
            return false;
        }

        // Phase 2: Wait up to 30 s for /providers to return results (plugins loaded)
        for i in 1..=30 {
            if let Ok(providers) = self.get_providers().await {
                if !providers.is_empty() {
                    println!("[EngineClient] Engine fully ready: {} providers loaded after {}s", providers.len(), i);
                    return true;
                }
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
            if i % 5 == 0 {
                println!("[EngineClient] Waiting for plugins to load... ({}/30s)", i);
            }
        }

        println!("[EngineClient] Engine healthy but no providers loaded after 30s");
        true // Engine is up even if empty — still usable
    }

    pub async fn ensure_running(&self) {
        let Some(jar_path) = Self::find_engine_jar() else {
            println!("[EngineClient] No engine JAR found — skipping startup");
            return;
        };

        if self.is_healthy().await {
            // Engine is running. Check if our JAR was rebuilt more recently than
            // the engine's last startup by probing a simple version marker.
            // For now, accept it as-is (avoid double-launch on normal restarts).
            println!("[EngineClient] Headless .cs3 engine already active on {}", self.base_url);
            return;
        }

        println!("[EngineClient] Engine not running — starting now (jar: {:?})", jar_path);

        #[cfg(target_os = "windows")]
        Self::kill_engine_on_port(self.port);

        self.spawn_and_wait().await;
    }

    /// Force-restart the engine (e.g. after a JAR rebuild or corrupt state).
    pub async fn force_restart(&self) {
        println!("[EngineClient] Force-restarting .cs3 engine...");

        #[cfg(target_os = "windows")]
        Self::kill_engine_on_port(self.port);

        // Give the OS a moment to release the port
        tokio::time::sleep(Duration::from_secs(2)).await;

        self.spawn_and_wait().await;
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
