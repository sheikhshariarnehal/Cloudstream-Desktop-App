use crate::models::{ExtractorLink, HomePageList, LoadResponse, SearchResponse, TvType};
use crate::providers::MainApi;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineProviderInfo {
    pub name: String,
    pub main_url: String,
    pub supported_types: Vec<String>,
    pub has_main_page: bool,
    pub lang: Option<String>,
}

#[derive(Clone)]
pub struct EngineClient {
    client: Client,
    base_url: String,
}

impl EngineClient {
    pub fn new() -> Self {
        Self::with_url("http://127.0.0.1:45732")
    }

    pub fn with_url(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn is_healthy(&self) -> bool {
        match self
            .client
            .get(format!("{}/health", self.base_url))
            .send()
            .await
        {
            Ok(res) => res.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn list_providers(&self) -> Result<Vec<EngineProviderInfo>> {
        let url = format!("{}/providers", self.base_url);
        let res = self.client.get(&url).send().await?;
        if !res.status().is_success() {
            return Err(anyhow!("Failed to fetch providers, status: {}", res.status()));
        }
        let list: Vec<EngineProviderInfo> = res.json().await?;
        Ok(list)
    }

    pub async fn get_main_page(&self, provider: &str, page: i32) -> Result<Vec<HomePageList>> {
        let url = format!("{}/main_page", self.base_url);
        let payload = serde_json::json!({
            "provider": provider,
            "page": page
        });

        let res = self.client.post(&url).json(&payload).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Engine main_page error: {}", err_text));
        }

        let shelves: Vec<HomePageList> = res.json().await?;
        Ok(shelves)
    }

    pub async fn search(&self, provider: &str, query: &str) -> Result<Vec<SearchResponse>> {
        let url = format!("{}/search", self.base_url);
        let payload = serde_json::json!({
            "provider": provider,
            "query": query
        });

        let res = self.client.post(&url).json(&payload).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Engine search error: {}", err_text));
        }

        let items: Vec<SearchResponse> = res.json().await?;
        Ok(items)
    }

    pub async fn load(&self, provider: &str, media_url: &str) -> Result<LoadResponse> {
        let url = format!("{}/load", self.base_url);
        let payload = serde_json::json!({
            "provider": provider,
            "url": media_url
        });

        let res = self.client.post(&url).json(&payload).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Engine load error: {}", err_text));
        }

        let details: LoadResponse = res.json().await?;
        Ok(details)
    }

    pub async fn load_links(&self, provider: &str, data: &str) -> Result<Vec<ExtractorLink>> {
        let url = format!("{}/load_links", self.base_url);
        let payload = serde_json::json!({
            "provider": provider,
            "data": data
        });

        let res = self.client.post(&url).json(&payload).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Engine load_links error: {}", err_text));
        }

        let links: Vec<ExtractorLink> = res.json().await?;
        Ok(links)
    }

    pub async fn reload(&self) -> Result<()> {
        let url = format!("{}/reload", self.base_url);
        let res = self.client.post(&url).send().await?;
        if !res.status().is_success() {
            let err_text = res.text().await.unwrap_or_default();
            return Err(anyhow!("Engine reload error: {}", err_text));
        }
        Ok(())
    }
}

pub struct DynamicEngineProvider {
    name: String,
    main_url: String,
    supported_types: Vec<TvType>,
    lang: String,
    engine: Arc<EngineClient>,
}

impl DynamicEngineProvider {
    pub fn new(info: &EngineProviderInfo, engine: Arc<EngineClient>) -> Self {
        let supported_types: Vec<TvType> = info
            .supported_types
            .iter()
            .map(|t| match t.to_lowercase().as_str() {
                "movie" => TvType::Movie,
                "tvseries" => TvType::TvSeries,
                "anime" => TvType::Anime,
                "animemovie" => TvType::AnimeMovie,
                "asiandrama" => TvType::AsianDrama,
                "cartoon" => TvType::Cartoon,
                "documentary" => TvType::Documentary,
                "live" | "livestream" => TvType::LiveStream,
                "torrent" => TvType::Torrent,
                "nsfw" => TvType::NSFW,
                _ => TvType::Other,
            })
            .collect();

        Self {
            name: info.name.clone(),
            main_url: info.main_url.clone(),
            supported_types: if supported_types.is_empty() {
                vec![TvType::Movie, TvType::TvSeries]
            } else {
                supported_types
            },
            lang: info.lang.clone().unwrap_or_else(|| "en".to_string()),
            engine,
        }
    }
}

#[async_trait]
impl MainApi for DynamicEngineProvider {
    fn name(&self) -> &str {
        &self.name
    }

    fn main_url(&self) -> &str {
        &self.main_url
    }

    fn supported_types(&self) -> &[TvType] {
        &self.supported_types
    }

    fn lang(&self) -> &str {
        &self.lang
    }

    async fn get_main_page(&self) -> Result<Vec<HomePageList>> {
        self.engine.get_main_page(&self.name, 1).await
    }

    async fn search(&self, query: &str) -> Result<Vec<SearchResponse>> {
        self.engine.search(&self.name, query).await
    }

    async fn load(&self, url: &str) -> Result<LoadResponse> {
        self.engine.load(&self.name, url).await
    }

    async fn load_links(&self, data: &str) -> Result<Vec<ExtractorLink>> {
        self.engine.load_links(&self.name, data).await
    }
}
