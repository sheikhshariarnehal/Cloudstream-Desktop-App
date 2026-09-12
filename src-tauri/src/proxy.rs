use anyhow::Result;
use axum::{
    body::Body,
    extract::Query,
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use url::Url;

#[derive(Clone)]
pub struct StreamProxy {
    port: u16,
    _client: Client,
}

#[derive(Deserialize)]
pub struct ProxyQuery {
    pub url: String,
    pub headers: Option<String>,
}

impl StreamProxy {
    pub async fn start() -> Result<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let port = listener.local_addr()?.port();

        let client = Client::builder()
            .danger_accept_invalid_certs(true) // For local BDIX and private SSL certs
            .build()?;

        let state = Arc::new(ProxyState {
            client: client.clone(),
            port,
        });

        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::HEAD, Method::OPTIONS])
            .allow_headers(Any);

        let app = Router::new()
            .route("/proxy/stream", get(handle_proxy_stream))
            .route("/health", get(|| async { "OK" }))
            .layer(cors)
            .with_state(state);

        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[Proxy] Server error: {}", e);
            }
        });

        println!("[Proxy] High-performance M3U8 proxy active on 127.0.0.1:{}", port);

        Ok(Self { port, _client: client })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn get_proxied_url(&self, target_url: &str, headers: &HashMap<String, String>) -> String {
        let headers_json = serde_json::to_string(headers).unwrap_or_default();
        format!(
            "http://127.0.0.1:{}/proxy/stream?url={}&headers={}",
            self.port,
            urlencoding::encode(target_url),
            urlencoding::encode(&headers_json)
        )
    }
}

struct ProxyState {
    client: Client,
    port: u16,
}

async fn handle_proxy_stream(
    axum::extract::State(state): axum::extract::State<Arc<ProxyState>>,
    Query(params): Query<ProxyQuery>,
    in_headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let target_url_str = &params.url;
    let base_url = Url::parse(target_url_str).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut req_builder = state.client.get(target_url_str);

    // Forward range header for smooth video seeking
    if let Some(range) = in_headers.get(header::RANGE) {
        req_builder = req_builder.header(header::RANGE, range);
    }

    // Parse custom headers passed in query
    let mut custom_headers_map: HashMap<String, String> = HashMap::new();
    if let Some(h_json) = &params.headers {
        if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(h_json) {
            custom_headers_map = map;
        }
    }

    // Default desktop user agent
    if !custom_headers_map.contains_key("User-Agent") && !custom_headers_map.contains_key("user-agent") {
        req_builder = req_builder.header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        );
    }

    for (k, v) in &custom_headers_map {
        if let Ok(hn) = HeaderName::from_bytes(k.as_bytes()) {
            if let Ok(hv) = HeaderValue::from_str(v) {
                req_builder = req_builder.header(hn, hv);
            }
        }
    }

    let upstream_res = req_builder.send().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let status = upstream_res.status();

    // Check if the response is an M3U8 playlist
    let content_type = upstream_res
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let is_m3u8 = target_url_str.contains(".m3u8")
        || content_type.contains("mpegurl")
        || content_type.contains("application/x-mpegurl");

    if is_m3u8 {
        let body_text = upstream_res.text().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
        let rewritten = rewrite_m3u8(&body_text, &base_url, state.port, &params.headers);

        let res = Response::builder()
            .status(status)
            .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(Body::from(rewritten))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(res)
    } else {
        // Stream video binary chunks directly
        let mut res_builder = Response::builder()
            .status(status)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .header(header::ACCEPT_RANGES, "bytes");

        if let Some(ct) = upstream_res.headers().get(header::CONTENT_TYPE) {
            res_builder = res_builder.header(header::CONTENT_TYPE, ct);
        }
        if let Some(cl) = upstream_res.headers().get(header::CONTENT_LENGTH) {
            res_builder = res_builder.header(header::CONTENT_LENGTH, cl);
        }
        if let Some(cr) = upstream_res.headers().get(header::CONTENT_RANGE) {
            res_builder = res_builder.header(header::CONTENT_RANGE, cr);
        }

        let stream = upstream_res.bytes_stream();
        let body = Body::from_stream(stream);

        let response = res_builder.body(body).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        Ok(response)
    }
}

fn rewrite_m3u8(content: &str, base_url: &Url, proxy_port: u16, headers_param: &Option<String>) -> String {
    let mut out = String::with_capacity(content.len() + 1024);
    let headers_query = headers_param
        .as_ref()
        .map(|h| format!("&headers={}", urlencoding::encode(h)))
        .unwrap_or_default();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            out.push('\n');
            continue;
        }

        // ── Normal line processing ─────────────────────────────────────────
        if trimmed.starts_with('#') {
            // Rewrite URI= inside tags (#EXT-X-KEY, #EXT-X-MAP, etc.)
            if trimmed.contains("URI=\"") {
                let rewritten_tag = rewrite_tag_uri(trimmed, base_url, proxy_port, &headers_query);
                out.push_str(&rewritten_tag);
                out.push('\n');
            } else {
                out.push_str(trimmed);
                out.push('\n');
            }
        } else {
            // Segment or sub-playlist URL — proxy it
            let absolute_url = match base_url.join(trimmed) {
                Ok(u) => u.to_string(),
                Err(_) => trimmed.to_string(),
            };

            let proxied = format!(
                "http://127.0.0.1:{}/proxy/stream?url={}{}",
                proxy_port,
                urlencoding::encode(&absolute_url),
                headers_query
            );
            out.push_str(&proxied);
            out.push('\n');
        }
    }
    out
}


fn rewrite_tag_uri(tag: &str, base_url: &Url, proxy_port: u16, headers_query: &str) -> String {
    let re = regex::Regex::new(r#"URI="([^"]+)""#).unwrap();
    re.replace_all(tag, |caps: &regex::Captures| {
        let raw_uri = &caps[1];
        let absolute_url = match base_url.join(raw_uri) {
            Ok(u) => u.to_string(),
            Err(_) => raw_uri.to_string(),
        };
        let proxied = format!(
            "http://127.0.0.1:{}/proxy/stream?url={}{}",
            proxy_port,
            urlencoding::encode(&absolute_url),
            headers_query
        );
        format!("URI=\"{}\"", proxied)
    })
    .to_string()
}
