use crate::engine::EngineClient;
use crate::models::{ExtractorLink, HomePageList, LoadResponse, SearchResponse};
use crate::plugins::PluginManager;
use anyhow::Result;
use std::sync::Arc;

pub struct ProviderRegistry {
    engine: Arc<EngineClient>,
    #[allow(dead_code)]
    plugin_manager: Arc<PluginManager>,
}

impl ProviderRegistry {
    pub fn new(engine: Arc<EngineClient>, plugin_manager: Arc<PluginManager>) -> Self {
        Self {
            engine,
            plugin_manager,
        }
    }

    /// Fetches home page catalog directly from the dynamic .cs3 engine.
    /// Supports virtual providers:
    /// - "none": Returns empty list (clean offline home screen)
    /// - "random": Aggregates random shelves across installed providers
    /// - "all" / None: Default multi-provider catalog
    /// - Specific provider name (e.g. "DiscoveryFTP", "DhakaFlix")
    pub async fn get_home_page(&self, provider: Option<&str>, page: i32) -> Vec<HomePageList> {
        match provider {
            Some("none") | Some("None") => {
                // CloudStream noneApi parity: no provider rows, clean home screen
                Vec::new()
            }
            Some("random") | Some("Random") => {
                // CloudStream randomApi parity: sample shelves from installed providers
                let providers = self.engine.get_providers().await.unwrap_or_default();
                let mut combined_shelves = Vec::new();
                for p in providers.into_iter().filter(|p| p.has_main_page) {
                    if let Ok(mut shelves) = self.engine.get_main_page(Some(&p.name), 1).await {
                        combined_shelves.append(&mut shelves);
                    }
                    if combined_shelves.len() >= 12 {
                        break;
                    }
                }
                combined_shelves
            }
            Some("all") | Some("All") | Some("All Extensions") | Some("") | None => {
                match self.engine.get_main_page(None, page).await {
                    Ok(shelves) => shelves,
                    Err(e) => {
                        eprintln!("[ProviderRegistry] Error loading main page: {}", e);
                        Vec::new()
                    }
                }
            }
            Some(name) => {
                match self.engine.get_main_page(Some(name), page).await {
                    Ok(shelves) => shelves,
                    Err(e) => {
                        eprintln!("[ProviderRegistry] Error loading main page for {}: {}", name, e);
                        Vec::new()
                    }
                }
            }
        }
    }

    /// Searches media across all active extensions or within a specific selected extension.
    pub async fn search(&self, query: &str, provider: Option<&str>) -> Vec<SearchResponse> {
        let p = match provider {
            Some("all") | Some("All") | Some("All Extensions") | Some("") | None => None,
            Some(name) => Some(name),
        };
        match self.engine.search(query, p).await {
            Ok(results) => results,
            Err(e) => {
                eprintln!("[ProviderRegistry] Error searching '{}': {}", query, e);
                Vec::new()
            }
        }
    }

    /// Loads media details and episode lists directly from the provider's .cs3 implementation.
    pub async fn load(&self, provider: &str, url: &str) -> Result<LoadResponse> {
        self.engine.load(provider, url).await
    }

    /// Extracts video streaming links directly from the provider's .cs3 implementation.
    pub async fn load_links(&self, provider: &str, data: &str) -> Result<Vec<ExtractorLink>> {
        self.engine.load_links(provider, data).await
    }
}
