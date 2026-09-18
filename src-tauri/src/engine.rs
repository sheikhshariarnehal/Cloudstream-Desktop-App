use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStatus {
    pub is_healthy: bool,
    pub engine_jar_found: bool,
    pub engine_jar_path: Option<String>,
    pub stubs_jar_found: bool,
    pub java_found: bool,
    pub java_is_bundled: bool,
    pub java_path: Option<String>,
    pub providers_count: usize,
    pub error: Option<String>,
}

pub struct EngineClient {
    client: Client,
    base_url: String,
    port: u16,
    last_error: Arc<RwLock<Option<String>>>,
    plugins_dir: Option<PathBuf>,
    spawn_lock: Arc<Mutex<()>>,
    has_logged_active: Arc<AtomicBool>,
}

impl EngineClient {
    pub fn new(port: Option<u16>, plugins_dir: Option<PathBuf>) -> Self {
        let p = port.unwrap_or(DEFAULT_ENGINE_PORT);
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(35))
                .build()
                .unwrap_or_else(|_| Client::new()),
            base_url: format!("http://127.0.0.1:{}", p),
            port: p,
            last_error: Arc::new(RwLock::new(None)),
            plugins_dir,
            spawn_lock: Arc::new(Mutex::new(())),
            has_logged_active: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub async fn is_healthy(&self) -> bool {
        self.check_health_with_retries(2, Duration::from_secs(5)).await
    }

    pub async fn check_health_with_retries(&self, retries: usize, timeout: Duration) -> bool {
        let url = format!("{}/health", self.base_url);
        let check_client = Client::builder()
            .timeout(timeout)
            .build()
            .unwrap_or_else(|_| Client::new());

        for attempt in 0..retries {
            match check_client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => return true,
                _ => {
                    if attempt + 1 < retries {
                        tokio::time::sleep(Duration::from_millis(500)).await;
                    }
                }
            }
        }
        false
    }

    /// Finds the self-contained portable JRE bundled with the desktop application.
    pub fn find_bundled_jre() -> Option<PathBuf> {
        let mut candidates = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                // Next to executable
                candidates.push(parent.join("jre").join("bin").join("java.exe"));
                // Tauri v2 resources directory
                candidates.push(parent.join("resources").join("jre").join("bin").join("java.exe"));
            }
        }
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            candidates.push(PathBuf::from(manifest_dir).join("jre").join("bin").join("java.exe"));
        }
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("jre").join("bin").join("java.exe"));
            candidates.push(cwd.join("src-tauri").join("jre").join("bin").join("java.exe"));
        }
        // Direct local dev fallback
        candidates.push(PathBuf::from(r"d:\Poject\CloudStream\CloudStream-Desktop\src-tauri\jre\bin\java.exe"));

        for c in candidates {
            if c.exists() {
                return Some(c);
            }
        }
        None
    }

    /// System Java 17+ discovery fallback if bundled JRE is somehow absent.
    pub fn find_system_java17() -> Option<PathBuf> {
        let mut candidates = Vec::new();

        if let Ok(java_home) = std::env::var("JAVA_HOME") {
            candidates.push(PathBuf::from(java_home).join("bin").join("java.exe"));
        }
        if let Ok(jdk_home) = std::env::var("JDK_HOME") {
            candidates.push(PathBuf::from(jdk_home).join("bin").join("java.exe"));
        }

        candidates.push(PathBuf::from(r"C:\Program Files\Java\jdk-17\bin\java.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\Java\jdk-21\bin\java.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\Java\jdk-22\bin\java.exe"));
        candidates.push(PathBuf::from(r"C:\Program Files\Java\jdk-23\bin\java.exe"));

        for base in [
            r"C:\Program Files\Java",
            r"C:\Program Files\Eclipse Adoptium",
            r"C:\Program Files\Microsoft",
            r"C:\Program Files\BellSoft",
            r"C:\Program Files\Amazon Corretto",
        ] {
            if let Ok(entries) = std::fs::read_dir(base) {
                for entry in entries.flatten() {
                    let java_exe = entry.path().join("bin").join("java.exe");
                    if java_exe.exists() {
                        candidates.push(java_exe);
                    }
                }
            }
        }

        candidates.push(PathBuf::from(r"C:\Program Files\Common Files\Oracle\Java\javapath\java.exe"));

        for c in candidates {
            if c.exists() {
                return Some(c);
            }
        }

        // Fallback: check if "java" in PATH responds
        if let Ok(output) = Command::new("java").arg("-version").output() {
            if output.status.success() || !output.stderr.is_empty() {
                return Some(PathBuf::from("java"));
            }
        }

        None
    }

    /// Returns (java_path, is_bundled)
    pub fn find_java() -> Option<(PathBuf, bool)> {
        // 1. Always prioritize the self-contained bundled JRE
        if let Some(bundled) = Self::find_bundled_jre() {
            return Some((bundled, true));
        }
        // 2. Fall back to installed system Java 17+
        if let Some(sys) = Self::find_system_java17() {
            return Some((sys, false));
        }
        None
    }

    /// Returns the engine JAR path. Searches bundled resources, adjacent paths, and dev locations.
    pub fn find_engine_jar() -> Option<PathBuf> {
        let mut candidates = Vec::new();

        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                candidates.push(parent.join("engine.jar"));
                candidates.push(parent.join("resources").join("engine.jar"));
                candidates.push(parent.join("CloudStream Desktop-windows-x64-1.2.4.jar"));
                candidates.push(parent.join("resources").join("CloudStream Desktop-windows-x64-1.2.4.jar"));
            }
        }
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            candidates.push(PathBuf::from(manifest_dir).join("engine.jar"));
        }
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("engine.jar"));
            candidates.push(cwd.join("src-tauri").join("engine.jar"));
        }
        candidates.push(PathBuf::from(r"d:\Poject\CloudStream\CloudStream-Desktop\src-tauri\engine.jar"));

        for c in candidates {
            if c.exists() {
                return Some(c);
            }
        }
        None
    }

    /// Returns the android-stubs.jar path bundled with our Tauri app.
    pub fn find_stubs_jar() -> Option<PathBuf> {
        let mut candidates = Vec::new();

        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                candidates.push(parent.join("android-stubs.jar"));
                candidates.push(parent.join("resources").join("android-stubs.jar"));
            }
        }
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            candidates.push(PathBuf::from(manifest_dir).join("android-stubs.jar"));
        }
        if let Ok(cwd) = std::env::current_dir() {
            candidates.push(cwd.join("android-stubs.jar"));
            candidates.push(cwd.join("src-tauri").join("android-stubs.jar"));
        }
        candidates.push(PathBuf::from(r"d:\Poject\CloudStream\CloudStream-Desktop\src-tauri\android-stubs.jar"));

        for c in candidates {
            if c.exists() {
                return Some(c);
            }
        }
        None
    }

    /// Kill any process listening on our engine port so we can start fresh.
    #[cfg(target_os = "windows")]
    fn kill_engine_on_port(port: u16) {
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

    pub fn kill(&self) {
        self.has_logged_active.store(false, Ordering::Relaxed);
        #[cfg(target_os = "windows")]
        Self::kill_engine_on_port(self.port);
    }

    /// Returns detailed engine health and dependency status.
    pub async fn get_status(&self) -> EngineStatus {
        let healthy = self.is_healthy().await;
        let engine_jar = Self::find_engine_jar();
        let stubs_jar = Self::find_stubs_jar();
        let java_info = Self::find_java();
        let providers_count = if healthy {
            self.get_providers().await.map(|p| p.len()).unwrap_or(0)
        } else {
            0
        };
        let err = self.last_error.read().await.clone();

        EngineStatus {
            is_healthy: healthy,
            engine_jar_found: engine_jar.is_some(),
            engine_jar_path: engine_jar.map(|p| p.to_string_lossy().to_string()),
            stubs_jar_found: stubs_jar.is_some(),
            java_found: java_info.is_some(),
            java_is_bundled: java_info.as_ref().map(|(_, b)| *b).unwrap_or(false),
            java_path: java_info.map(|(p, _)| p.to_string_lossy().to_string()),
            providers_count,
            error: err,
        }
    }

    /// Spawn the engine, wait up to 25 s for it to become healthy.
    pub async fn spawn_and_wait(&self) -> bool {
        let Some(jar_path) = Self::find_engine_jar() else {
            let msg = "Could not locate engine JAR (engine.jar) — .cs3 extensions unavailable";
            println!("[EngineClient] {}", msg);
            *self.last_error.write().await = Some(msg.to_string());
            return false;
        };

        let Some((java_bin, is_bundled)) = Self::find_java() else {
            let msg = "Java 17+ runtime not found — neither bundled JRE nor system Java was detected";
            println!("[EngineClient] {}", msg);
            *self.last_error.write().await = Some(msg.to_string());
            return false;
        };

        let jar_dir = jar_path.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));

        let stubs = Self::find_stubs_jar();

        let cp = if let Some(ref s) = stubs {
            format!("{};{}", s.to_string_lossy(), jar_path.to_string_lossy())
        } else {
            jar_path.to_string_lossy().to_string()
        };
        let main_class = "com.lagradost.cloudstream.desktop.MainKt";

        println!(
            "[EngineClient] Spawning engine: java={:?} (bundled: {}) cp=... MainClass={}",
            java_bin, is_bundled, main_class
        );
        if stubs.is_some() {
            println!("[EngineClient] Android stubs injected — AppCompatActivity crash prevented");
        } else {
            println!("[EngineClient] Warning: android-stubs.jar not found");
        }

        let mut cmd = Command::new(&java_bin);
        cmd.current_dir(&jar_dir);
        cmd.args([
            // Disable strict JVM bytecode verification.
            // DEX-to-JVM translated classes (from .cs3 plugins) have mismatched
            // StackMapTable entries that fail Java 13+ verification but run fine at runtime.
            "-Xverify:none",
            "-cp", &cp,
            main_class,
            "--server",
            "--port", &self.port.to_string(),
        ]);

        if let Some(ref pdir) = self.plugins_dir {
            cmd.args(["--plugins-dir", &pdir.to_string_lossy()]);
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let result = cmd.spawn();
        if let Err(e) = result {
            let msg = format!("Failed to spawn engine with {:?}: {}", java_bin, e);
            println!("[EngineClient] {}", msg);
            *self.last_error.write().await = Some(msg);
            return false;
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
            let msg = "Engine process spawned but failed to become healthy within 25 seconds".to_string();
            println!("[EngineClient] {}", msg);
            *self.last_error.write().await = Some(msg);
            return false;
        }

        *self.last_error.write().await = None;

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

        println!("[EngineClient] Engine healthy (providers still loading or empty)");
        true
    }

    pub async fn ensure_running(&self) -> bool {
        // Fast path: if engine is already healthy, return immediately without taking the spawn lock
        if self.is_healthy().await {
            if !self.has_logged_active.swap(true, Ordering::Relaxed) {
                println!("[EngineClient] Headless .cs3 engine active on {}", self.base_url);
            }
            return true;
        }

        // Concurrency guard: avoid stampedes of multiple commands trying to kill or spawn simultaneously
        let _guard = self.spawn_lock.lock().await;

        // Double-check health under lock (another caller may have completed spawning while we waited)
        if self.is_healthy().await {
            if !self.has_logged_active.swap(true, Ordering::Relaxed) {
                println!("[EngineClient] Headless .cs3 engine active on {}", self.base_url);
            }
            return true;
        }

        println!("[EngineClient] Engine not running or unresponsive — starting now");
        self.has_logged_active.store(false, Ordering::Relaxed);

        #[cfg(target_os = "windows")]
        Self::kill_engine_on_port(self.port);

        let success = self.spawn_and_wait().await;
        if success {
            self.has_logged_active.store(true, Ordering::Relaxed);
        }
        success
    }

    /// Force-restart the engine (e.g. after a JAR rebuild or corrupt state).
    pub async fn force_restart(&self) -> bool {
        let _guard = self.spawn_lock.lock().await;
        println!("[EngineClient] Force-restarting .cs3 engine...");
        self.has_logged_active.store(false, Ordering::Relaxed);

        #[cfg(target_os = "windows")]
        Self::kill_engine_on_port(self.port);

        tokio::time::sleep(Duration::from_secs(2)).await;

        let success = self.spawn_and_wait().await;
        if success {
            self.has_logged_active.store(true, Ordering::Relaxed);
        }
        success
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
