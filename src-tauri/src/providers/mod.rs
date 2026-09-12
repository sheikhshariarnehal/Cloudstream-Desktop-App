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
    /// If provider is None or "all", loads feeds across active installed extensions.
    /// If provider is specified (e.g. "AllWish", "AniKoto"), loads that specific provider's homepage.
    pub async fn get_home_page(&self, provider: Option<&str>) -> Vec<HomePageList> {
        let p = match provider {
            Some("all") | Some("All") | Some("All Extensions") | Some("") | None => None,
            Some(name) => Some(name),
        };
        match self.engine.get_main_page(p, 1).await {
            Ok(shelves) => shelves,
            Err(e) => {
                eprintln!("[ProviderRegistry] Error loading main page: {}", e);
                Vec::new()
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
