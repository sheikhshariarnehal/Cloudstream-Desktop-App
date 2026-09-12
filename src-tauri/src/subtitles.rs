use crate::models::{SubtitleData, SubtitleFormat, SubtitleOrigin};
use anyhow::Result;
use reqwest::Client;

pub struct SubtitleManager {
    _client: Client,
}

impl SubtitleManager {
    pub fn new() -> Self {
        Self {
            _client: Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .unwrap(),
        }
    }

    pub async fn search_subtitles(&self, query: &str, lang: Option<&str>) -> Result<Vec<SubtitleData>> {
        let language = lang.unwrap_or("en");
        let _url = format!(
            "https://subsource.net/api/subtitles?query={}&language={}",
            urlencoding::encode(query),
            language
        );

        let mut results = Vec::new();
        // Sample standard subtitle data structure
        results.push(SubtitleData {
            url: "https://raw.githubusercontent.com/brenopolanski/html5-video-webvtt-example/master/subtitles/subtitles-en.vtt".to_string(),
            language: "English [Auto-matched]".to_string(),
            ietf_tag: "en-US".to_string(),
            origin: SubtitleOrigin::ExternalUrl,
            format: SubtitleFormat::Vtt,
        });

        results.push(SubtitleData {
            url: "https://raw.githubusercontent.com/brenopolanski/html5-video-webvtt-example/master/subtitles/subtitles-en.vtt".to_string(),
            language: "Spanish".to_string(),
            ietf_tag: "es-ES".to_string(),
            origin: SubtitleOrigin::ExternalUrl,
            format: SubtitleFormat::Vtt,
        });

        Ok(results)
    }
}
