use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TvType {
    Movie,
    TvSeries,
    Anime,
    AnimeMovie,
    AsianDrama,
    Cartoon,
    Documentary,
    LiveStream,
    Torrent,
    NSFW,
    #[serde(other)]
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DubStatus {
    Subbed,
    Dubbed,
    Both,
    #[serde(other)]
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub name: String,
    pub url: String,
    pub api_name: String,
    pub tv_type: TvType,
    pub poster_url: Option<String>,
    pub year: Option<i32>,
    pub score: Option<f64>,
    pub dub_status: Option<DubStatus>,
    pub latest_episode: Option<i32>,
    #[serde(default)]
    pub quality: Option<String>,
    #[serde(default)]
    pub season: Option<i32>,
    #[serde(default)]
    pub episode: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryItem {
    pub id: Option<i64>,
    pub search_text: String,
    pub searched_at: i64,
    #[serde(default)]
    pub types: Vec<TvType>,
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSearchResult {
    pub provider: String,
    pub items: Vec<SearchResponse>,
    pub current_page: u32,
    pub has_next: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMultiResult {
    pub grouped: Vec<ProviderSearchResult>,
    pub bundled: Vec<SearchResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchChunkEvent {
    pub query: String,
    pub provider: String,
    pub items: Vec<SearchResponse>,
    pub completed_count: usize,
    pub total_count: usize,
    pub is_done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomePageList {
    pub name: String,
    pub list: Vec<SearchResponse>,
    pub is_horizontal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    pub name: String,
    pub role: Option<String>,
    pub image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub name: Option<String>,
    pub season: Option<i32>,
    pub episode: i32,
    pub data: String,
    pub poster_url: Option<String>,
    pub rating: Option<f64>,
    pub description: Option<String>,
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadResponse {
    pub name: String,
    pub url: String,
    pub api_name: String,
    pub tv_type: TvType,
    pub poster_url: Option<String>,
    pub background_poster_url: Option<String>,
    pub plot: Option<String>,
    pub year: Option<i32>,
    pub duration_minutes: Option<i32>,
    pub tags: Vec<String>,
    pub cast: Vec<Actor>,
    pub episodes: Vec<Episode>,
    pub recommendations: Vec<SearchResponse>,
    pub trailers: Vec<String>,
    pub sync_ids: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum QualityProfile {
    Quality360p,
    Quality480p,
    Quality720p,
    Quality1080p,
    Quality4K,
    Auto,
    #[serde(other)]
    Unknown,
}

impl QualityProfile {
    pub fn from_str(s: &str) -> Self {
        let lower = s.to_lowercase();
        if lower.contains("4k") || lower.contains("2160") {
            QualityProfile::Quality4K
        } else if lower.contains("1080") {
            QualityProfile::Quality1080p
        } else if lower.contains("720") {
            QualityProfile::Quality720p
        } else if lower.contains("480") {
            QualityProfile::Quality480p
        } else if lower.contains("360") {
            QualityProfile::Quality360p
        } else {
            QualityProfile::Auto
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractorLink {
    pub source: String,
    pub name: String,
    pub url: String,
    pub referer: String,
    pub quality: QualityProfile,
    pub is_m3u8: bool,
    pub is_dash: bool,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SubtitleOrigin {
    Embedded,
    ExternalUrl,
    DownloadedFile,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SubtitleFormat {
    Vtt,
    Srt,
    Ass,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleData {
    pub url: String,
    pub language: String,
    pub ietf_tag: String,
    pub origin: SubtitleOrigin,
    pub format: SubtitleFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionInfo {
    pub id: String,
    pub name: String,
    pub is_builtin: bool,
    pub version: Option<String>,
    pub supported_types: Vec<String>,
    pub icon_url: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryEntry {
    pub name: String,
    pub url: String,
    pub icon_url: Option<String>,
    pub manifest_version: Option<i32>,
    pub plugin_count: usize,
    pub added_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub internal_name: Option<String>,
    pub plugin_url: String,
    pub version: i32,
    pub api_version: i32,
    pub tv_types: Vec<String>,
    pub icon_url: Option<String>,
    pub authors: Vec<String>,
    pub description: Option<String>,
    pub repository_url: Option<String>,
    pub language: Option<String>,
    pub file_size: Option<i64>,
    pub file_hash: Option<String>,
    pub status: Option<String>, // "installed", "available", "update_available"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryManifest {
    pub name: String,
    pub url: String,
    pub manifest_version: Option<i32>,
    pub plugins: Vec<PluginManifest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchHistoryItem {
    pub id: Option<i64>,
    pub media_id: String,
    pub provider_id: String,
    pub title: String,
    pub poster_url: Option<String>,
    pub episode_num: Option<i32>,
    pub season_num: Option<i32>,
    pub episode_name: Option<String>,
    pub position_ms: i64,
    pub duration_ms: i64,
    pub last_watched_at: i64,
    pub is_completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchlistItem {
    pub id: Option<i64>,
    pub media_id: String,
    pub provider_id: String,
    pub title: String,
    pub poster_url: Option<String>,
    pub tv_type: String,
    pub status: String, // "watching", "completed", "plan_to_watch", "dropped", "on_hold"
    pub score: Option<f64>,
    pub added_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipInterval {
    pub start: f64,
    pub end: f64,
    pub skip_type: String, // "op", "ed", "recap", "mixed-op", "mixed-ed"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_profile_parsing() {
        assert_eq!(QualityProfile::from_str("4K HDR"), QualityProfile::Quality4K);
        assert_eq!(QualityProfile::from_str("1080p FHD"), QualityProfile::Quality1080p);
        assert_eq!(QualityProfile::from_str("720p HD"), QualityProfile::Quality720p);
        assert_eq!(QualityProfile::from_str("480p SD"), QualityProfile::Quality480p);
        assert_eq!(QualityProfile::from_str("Unknown source"), QualityProfile::Auto);
    }
}
