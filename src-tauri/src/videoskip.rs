use crate::models::SkipInterval;
use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct AniSkipResult {
    #[serde(rename = "skipType")]
    skip_type: String,
    interval: AniSkipInterval,
}

#[derive(Deserialize)]
struct AniSkipInterval {
    #[serde(rename = "startTime")]
    start_time: f64,
    #[serde(rename = "endTime")]
    end_time: f64,
}

#[derive(Deserialize)]
struct AniSkipResponse {
    found: bool,
    results: Option<Vec<AniSkipResult>>,
}

pub struct SkipManager {
    client: Client,
}

impl SkipManager {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn get_anime_skip(
        &self,
        mal_id: i64,
        episode_num: i32,
        episode_length: f64,
    ) -> Result<Vec<SkipInterval>> {
        let url = format!(
            "https://api.aniskip.com/v2/skip-times/{}/{}?types=op&types=ed&types=recap&episodeLength={}",
            mal_id, episode_num, episode_length
        );

        let res = self.client.get(&url).send().await?;
        if !res.status().is_success() {
            return Ok(Vec::new());
        }

        let data: AniSkipResponse = res.json().await?;
        let mut list = Vec::new();

        if data.found {
            if let Some(results) = data.results {
                for r in results {
                    list.push(SkipInterval {
                        start: r.interval.start_time,
                        end: r.interval.end_time,
                        skip_type: r.skip_type,
                    });
                }
            }
        }

        Ok(list)
    }
}
