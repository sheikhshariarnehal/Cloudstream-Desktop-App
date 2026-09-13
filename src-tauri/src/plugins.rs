use crate::models::{PluginManifest, RepositoryManifest};
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::Value;
use std::fs::{self, File};
use std::io::Read;
use std::path::PathBuf;
use zip::ZipArchive;

pub struct PluginManager {
    client: Client,
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let plugins_dir = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map(|home| PathBuf::from(home).join(".cloudstream_desktop").join("plugins"))
            .unwrap_or_else(|_| app_data_dir.join("plugins"));
        let _ = fs::create_dir_all(&plugins_dir);
        Self {
            client: Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap(),
            plugins_dir,
        }
    }

    pub fn plugins_dir(&self) -> &PathBuf {
        &self.plugins_dir
    }

    pub fn normalize_repo_url(url: &str) -> String {
        let mut clean = url.trim().to_string();
        if clean.starts_with('!') {
            clean = format!("https://py.md/{}", &clean[1..]);
        } else if clean.starts_with("cloudstreamrepo://") {
            clean = clean.replace("cloudstreamrepo://", "https://");
        } else if clean.starts_with("https://cs.repo/?") || clean.starts_with("https://cs.repo?") {
            clean = clean.replace("https://cs.repo/?", "https://").replace("https://cs.repo?", "https://");
        } else if clean.starts_with("cs.repo/?") || clean.starts_with("cs.repo?") {
            clean = clean.replace("cs.repo/?", "https://").replace("cs.repo?", "https://");
        }

        // Convert github blob to raw
        if clean.contains("github.com") && clean.contains("/blob/") {
            clean = clean.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
        }

        if !clean.starts_with("http://") && !clean.starts_with("https://") {
            clean = format!("https://{}", clean);
        }

        clean
    }

    pub async fn fetch_repository(&self, repo_url: &str) -> Result<RepositoryManifest> {
        let clean_url = Self::normalize_repo_url(repo_url);
        let res = self.client.get(&clean_url).send().await?;
        let text = res.text().await?;

        let val: Value = serde_json::from_str(&text)
            .map_err(|e| anyhow!("Failed to parse repo JSON from {}: {}", clean_url, e))?;

        let mut raw_plugin_values = Vec::new();

        // CloudStream repo schema:
        // Case 1: Direct JSON array of plugin objects
        if let Some(arr) = val.as_array() {
            raw_plugin_values.extend(arr.clone());
        }
        // Case 2: Object with pluginLists (array of URLs pointing to plugins.json or inline objects)
        else if let Some(plugin_lists) = val.get("pluginLists").and_then(|v| v.as_array()) {
            for item in plugin_lists {
                if let Some(list_url) = item.as_str() {
                    let normalized_list_url = Self::normalize_repo_url(list_url);
                    println!("[PluginManager] Fetching plugin list from: {}", normalized_list_url);
                    if let Ok(resp) = self.client.get(&normalized_list_url).send().await {
                        if let Ok(sub_text) = resp.text().await {
                            if let Ok(sub_val) = serde_json::from_str::<Value>(&sub_text) {
                                if let Some(sub_arr) = sub_val.as_array() {
                                    raw_plugin_values.extend(sub_arr.clone());
                                }
                            }
                        }
                    }
                } else if item.is_object() {
                    raw_plugin_values.push(item.clone());
                }
            }
        }
        // Case 3: Object with "plugins" array
        else if let Some(arr) = val.get("plugins").and_then(|v| v.as_array()) {
            raw_plugin_values.extend(arr.clone());
        }

        let repo_name = val
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| {
                clean_url
                    .split('/')
                    .filter(|s| !s.is_empty())
                    .last()
                    .unwrap_or("CloudStream Repo")
            })
            .to_string();

        let mut plugins = Vec::new();
        let installed = self.list_installed_plugins().unwrap_or_default();

        for p in raw_plugin_values {
            let name = p
                .get("name")
                .or_else(|| p.get("internalName"))
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();

            let internal_name = p.get("internalName").and_then(|v| v.as_str()).map(|s| s.to_string());

            let plugin_url = p
                .get("url")
                .or_else(|| p.get("pluginUrl"))
                .or_else(|| p.get("jarUrl"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            if plugin_url.is_empty() {
                continue;
            }

            let version = p.get("version").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
            let api_version = p.get("apiVersion").and_then(|v| v.as_i64()).unwrap_or(1) as i32;

            let tv_types = p
                .get("tvTypes")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let icon_url = p.get("iconUrl").and_then(|v| v.as_str()).map(|s| s.to_string());
            let description = p.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());
            let language = p.get("language").and_then(|v| v.as_str()).map(|s| s.to_string());
            let file_size = p.get("fileSize").and_then(|v| v.as_i64());
            let file_hash = p.get("fileHash").and_then(|v| v.as_str()).map(|s| s.to_string());

            let authors = p
                .get("authors")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let id = format!("{}_{}", name.to_lowercase().replace(' ', "_"), version);

            let is_installed = installed.iter().any(|inst| inst.name.eq_ignore_ascii_case(&name));

            plugins.push(PluginManifest {
                id,
                name,
                internal_name,
                plugin_url,
                version,
                api_version,
                tv_types,
                icon_url,
                authors,
                description,
                repository_url: Some(clean_url.to_string()),
                language,
                file_size,
                file_hash,
                status: Some(if is_installed { "installed".to_string() } else { "available".to_string() }),
            });
        }

        Ok(RepositoryManifest {
            name: repo_name,
            url: clean_url.to_string(),
            manifest_version: val.get("manifestVersion").and_then(|v| v.as_i64()).map(|v| v as i32),
            plugins,
        })
    }

    pub async fn install_plugin(&self, manifest: &PluginManifest) -> Result<PathBuf> {
        let download_url = &manifest.plugin_url;
        let file_name = if download_url.ends_with(".jar") {
            format!("{}.jar", manifest.name.replace(' ', "_"))
        } else {
            format!("{}.cs3", manifest.name.replace(' ', "_"))
        };
        let target_path = self.plugins_dir.join(&file_name);

        println!("[PluginManager] Downloading extension from {} to {:?}", download_url, target_path);
        let bytes = self.client.get(download_url).send().await?.bytes().await?;
        fs::write(&target_path, &bytes)?;

        // If it's a zip/cs3, verify archive
        if file_name.ends_with(".cs3") {
            if let Ok(file) = File::open(&target_path) {
                if let Ok(archive) = ZipArchive::new(file) {
                    println!("[PluginManager] Verified archive with {} files", archive.len());
                }
            }
        }

        println!("[PluginManager] Successfully installed extension '{}'", manifest.name);
        Ok(target_path)
    }

    pub fn install_plugin_from_local_file(&self, source_path_str: &str) -> Result<PathBuf> {
        let src = PathBuf::from(source_path_str);
        if !src.exists() {
            return Err(anyhow!("File does not exist: {}", source_path_str));
        }

        let file_name = src
            .file_name()
            .ok_or_else(|| anyhow!("Invalid file path"))?;
        let target = self.plugins_dir.join(file_name);

        fs::copy(&src, &target)?;
        println!("[PluginManager] Installed local plugin file to {:?}", target);
        Ok(target)
    }

    pub fn list_installed_plugins(&self) -> Result<Vec<PluginManifest>> {
        let mut list = Vec::new();
        if !self.plugins_dir.exists() {
            return Ok(list);
        }

        for entry in fs::read_dir(&self.plugins_dir)? {
            let entry = entry?;
            let path = entry.path();
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            if ext == "cs3" || ext == "jar" {
                let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Extension");
                let mut found_manifest = false;

                // Try reading plugin.json if it's a zip archive
                if let Ok(file) = File::open(&path) {
                    if let Ok(mut archive) = ZipArchive::new(file) {
                        for i in 0..archive.len() {
                            if let Ok(mut f) = archive.by_index(i) {
                                if f.name() == "plugin.json"
                                    || f.name() == "manifest.json"
                                    || f.name().ends_with("/plugin.json")
                                    || f.name().ends_with("/manifest.json")
                                {
                                    let mut content = String::new();
                                    if f.read_to_string(&mut content).is_ok() {
                                        if let Ok(val) = serde_json::from_str::<Value>(&content) {
                                            let name = val
                                                .get("name")
                                                .or_else(|| val.get("internalName"))
                                                .and_then(|v| v.as_str())
                                                .unwrap_or(file_stem)
                                                .to_string();
                                            let version = val.get("version").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
                                            let id = format!("{}_{}", name.to_lowercase().replace(' ', "_"), version);
                                            let icon_url = val
                                                .get("iconUrl")
                                                .or_else(|| val.get("icon_url"))
                                                .or_else(|| val.get("icon"))
                                                .and_then(|v| v.as_str())
                                                .map(|s| s.to_string());

                                            let tv_types = val
                                                .get("tvTypes")
                                                .and_then(|v| v.as_array())
                                                .map(|arr| {
                                                    arr.iter()
                                                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                                                        .collect()
                                                })
                                                .unwrap_or_default();

                                            list.push(PluginManifest {
                                                id,
                                                name: name.clone(),
                                                internal_name: Some(name),
                                                plugin_url: path.to_string_lossy().to_string(),
                                                version,
                                                api_version: val.get("apiVersion").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                                                tv_types,
                                                icon_url,
                                                authors: Vec::new(),
                                                description: val.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                                repository_url: None,
                                                language: val.get("language").and_then(|v| v.as_str()).map(|s| s.to_string()),
                                                file_size: path.metadata().ok().map(|m| m.len() as i64),
                                                file_hash: None,
                                                status: Some("installed".to_string()),
                                            });
                                            found_manifest = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // If icon_url wasn't in json manifest, check if archive contains icon image
                        if found_manifest {
                            if let Some(last_plugin) = list.last_mut() {
                                if last_plugin.icon_url.is_none() {
                                    for j in 0..archive.len() {
                                        if let Ok(mut img_file) = archive.by_index(j) {
                                            let entry_name = img_file.name().to_lowercase();
                                            if entry_name == "icon.png" || entry_name.ends_with("/icon.png") {
                                                let mut img_bytes = Vec::new();
                                                if img_file.read_to_end(&mut img_bytes).is_ok() {
                                                    use base64::Engine;
                                                    last_plugin.icon_url = Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(&img_bytes)));
                                                    break;
                                                }
                                            } else if entry_name == "icon.jpg" || entry_name.ends_with("/icon.jpg") || entry_name == "icon.jpeg" || entry_name.ends_with("/icon.jpeg") {
                                                let mut img_bytes = Vec::new();
                                                if img_file.read_to_end(&mut img_bytes).is_ok() {
                                                    use base64::Engine;
                                                    last_plugin.icon_url = Some(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(&img_bytes)));
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // If not a readable zip or no plugin.json, list by filename
                if !found_manifest {
                    list.push(PluginManifest {
                        id: file_stem.to_string(),
                        name: file_stem.replace('_', " "),
                        internal_name: Some(file_stem.to_string()),
                        plugin_url: path.to_string_lossy().to_string(),
                        version: 1,
                        api_version: 1,
                        tv_types: vec!["Movie".to_string(), "TvSeries".to_string()],
                        icon_url: None,
                        authors: vec!["Community".to_string()],
                        description: Some("Custom installed CloudStream extension.".to_string()),
                        repository_url: None,
                        language: None,
                        file_size: path.metadata().ok().map(|m| m.len() as i64),
                        file_hash: None,
                        status: Some("installed".to_string()),
                    });
                }
            }
        }
        Ok(list)
    }

    pub fn delete_plugin(&self, plugin_name: &str) -> Result<bool> {
        let safe_name = plugin_name.replace(' ', "_").to_lowercase();
        let query_lower = plugin_name.to_lowercase();
        let clean_query = plugin_name
            .chars()
            .filter(|c| c.is_alphanumeric())
            .collect::<String>()
            .to_lowercase();

        let mut deleted_any = false;
        if self.plugins_dir.exists() {
            for entry in fs::read_dir(&self.plugins_dir)? {
                let entry = entry?;
                let path = entry.path();
                let stem = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let clean_stem = stem
                    .chars()
                    .filter(|c| c.is_alphanumeric())
                    .collect::<String>()
                    .to_lowercase();

                let file_name = entry.file_name().to_string_lossy().to_string();

                let is_match = stem == safe_name
                    || stem == query_lower
                    || (!clean_query.is_empty() && clean_stem == clean_query)
                    || file_name.eq_ignore_ascii_case(plugin_name);

                if is_match {
                    println!("[PluginManager] Deleting plugin file {:?}", path);
                    fs::remove_file(&path)?;
                    deleted_any = true;
                }
            }
        }
        Ok(deleted_any)
    }

    pub fn delete_all_plugins(&self) -> Result<usize> {
        let mut count = 0;
        if self.plugins_dir.exists() {
            for entry in fs::read_dir(&self.plugins_dir)? {
                let entry = entry?;
                let path = entry.path();
                let ext = path
                    .extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if ext == "cs3" || ext == "jar" {
                    println!("[PluginManager] Removing plugin file {:?}", path);
                    fs::remove_file(&path)?;
                    count += 1;
                }
            }
        }
        Ok(count)
    }
}
