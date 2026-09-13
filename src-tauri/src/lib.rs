pub mod database;
pub mod engine;
pub mod models;
pub mod player;
pub mod plugins;
pub mod providers;
pub mod proxy;
pub mod subtitles;
pub mod videoskip;

use database::Database;
use engine::EngineClient;
use models::{
    ExpandableShelf, ExtractorLink, ExtensionInfo, HomePageList, LoadResponse, PluginManifest,
    ProviderSearchResult, RepositoryEntry, RepositoryManifest, SearchChunkEvent, SearchHistoryItem,
    SearchMultiResult, SearchResponse, SkipInterval, SubtitleData, WatchHistoryItem, WatchlistItem,
};
use plugins::PluginManager;
use providers::ProviderRegistry;
use proxy::StreamProxy;
use std::sync::Arc;
use subtitles::SubtitleManager;
use tauri::{AppHandle, Emitter, Manager, State};
use videoskip::SkipManager;

pub struct AppState {
    pub db: Arc<Database>,
    pub proxy: Arc<StreamProxy>,
    pub plugin_manager: Arc<PluginManager>,
    pub engine: Arc<EngineClient>,
    pub providers: Arc<ProviderRegistry>,
    pub skip_manager: Arc<SkipManager>,
    pub subtitle_manager: Arc<SubtitleManager>,
    pub player: Arc<player::MpvPlayer>,
}

fn clean_alphanumeric(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).collect::<String>().to_lowercase()
}

fn normalize_provider_stem(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut without_parens = String::new();
    let mut depth = 0;
    for ch in lower.chars() {
        if ch == '(' || ch == '[' {
            depth += 1;
        } else if ch == ')' || ch == ']' {
            if depth > 0 { depth -= 1; }
        } else if depth == 0 {
            without_parens.push(ch);
        }
    }
    let stripped = without_parens
        .replace("provider", "")
        .replace("plugin", "")
        .replace("bdix", "");
    stripped.chars().filter(|c| c.is_alphanumeric()).collect()
}

fn is_manifest_provider_match(m: &PluginManifest, p_name: &str) -> bool {
    let stem_p = normalize_provider_stem(p_name);
    let stem_m = normalize_provider_stem(&m.name);
    let stem_m_id = normalize_provider_stem(&m.id);
    let stem_m_internal = m.internal_name.as_deref().map(normalize_provider_stem).unwrap_or_default();

    if stem_p.is_empty() {
        return false;
    }

    m.name.eq_ignore_ascii_case(p_name)
        || stem_p == stem_m
        || (!stem_m_internal.is_empty() && stem_p == stem_m_internal)
        || (!stem_m_id.is_empty() && (stem_m_id.starts_with(&stem_p) || stem_p.starts_with(&stem_m_id)))
        || (!stem_m.is_empty() && (stem_p.starts_with(&stem_m) || stem_m.starts_with(&stem_p)))
}

fn resolve_plugin_icon(
    name: &str,
    alt_name: Option<&str>,
    repo_plugins: &[PluginManifest],
) -> Option<String> {
    // 1. Exact match by name or internal name
    for rp in repo_plugins {
        if rp.icon_url.is_none() {
            continue;
        }
        if rp.name.eq_ignore_ascii_case(name)
            || alt_name.map_or(false, |a| rp.name.eq_ignore_ascii_case(a))
            || rp.internal_name.as_deref().map_or(false, |i| i.eq_ignore_ascii_case(name))
            || alt_name.map_or(false, |a| rp.internal_name.as_deref().map_or(false, |i| i.eq_ignore_ascii_case(a)))
        {
            return rp.icon_url.clone();
        }
    }

    // 2. Provider match helper (stems, prefixes)
    for rp in repo_plugins {
        if rp.icon_url.is_none() {
            continue;
        }
        if is_manifest_provider_match(rp, name) || alt_name.map_or(false, |a| is_manifest_provider_match(rp, a)) {
            return rp.icon_url.clone();
        }
    }

    // 3. Stem matching
    let name_stem = normalize_provider_stem(name);
    let alt_stem = alt_name.map(normalize_provider_stem).unwrap_or_default();
    for rp in repo_plugins {
        if rp.icon_url.is_none() {
            continue;
        }
        let rp_stem = normalize_provider_stem(&rp.name);
        if !rp_stem.is_empty() {
            if (!name_stem.is_empty() && (rp_stem == name_stem || name_stem.starts_with(&rp_stem) || rp_stem.starts_with(&name_stem)))
                || (!alt_stem.is_empty() && (rp_stem == alt_stem || alt_stem.starts_with(&rp_stem) || rp_stem.starts_with(&alt_stem)))
            {
                return rp.icon_url.clone();
            }
        }
    }

    // 4. Alphanumeric containment
    let clean_name = clean_alphanumeric(name);
    let clean_alt = alt_name.map(clean_alphanumeric).unwrap_or_default();
    for rp in repo_plugins {
        if rp.icon_url.is_none() {
            continue;
        }
        let clean_rp = clean_alphanumeric(&rp.name);
        if !clean_rp.is_empty() {
            if (!clean_name.is_empty() && (clean_name.contains(&clean_rp) || clean_rp.contains(&clean_name)))
                || (!clean_alt.is_empty() && (clean_alt.contains(&clean_rp) || clean_rp.contains(&clean_alt)))
            {
                return rp.icon_url.clone();
            }
        }
    }

    None
}

async fn resolve_provider_name(state: &State<'_, AppState>, provider: Option<String>) -> Option<String> {
    if let Some(req) = provider {
        if req == "all" || req == "All" || req == "random" || req == "none" || req.is_empty() {
            Some(req)
        } else {
            let engine_providers = state.engine.get_providers().await.unwrap_or_default();

            // 1. Check real providers first (non-placeholder)
            let real_providers: Vec<_> = engine_providers
                .iter()
                .filter(|p| !p.main_url.contains("cloudstream.app"))
                .collect();

            if let Some(matched) = real_providers.iter().find(|p| p.name.eq_ignore_ascii_case(&req)) {
                return Some(matched.name.clone());
            }

            // 2. Stem-based match against real providers (e.g. "CastleTvProvider" -> "Castle TV (Use VLC)")
            let req_stem = normalize_provider_stem(&req);
            if !req_stem.is_empty() {
                if let Some(matched) = real_providers.iter().find(|p| {
                    let p_stem = normalize_provider_stem(&p.name);
                    p_stem == req_stem || p_stem.starts_with(&req_stem) || req_stem.starts_with(&p_stem)
                }) {
                    return Some(matched.name.clone());
                }
            }

            // 3. Exact match against any provider
            if let Some(matched) = engine_providers.iter().find(|p| p.name.eq_ignore_ascii_case(&req)) {
                return Some(matched.name.clone());
            }

            // 4. Fallback: clean alphanumeric match
            let clean_req = clean_alphanumeric(&req);
            if let Some(matched) = engine_providers.iter().find(|p| clean_alphanumeric(&p.name) == clean_req) {
                return Some(matched.name.clone());
            }

            Some(req)
        }
    } else {
        None
    }
}

#[tauri::command]
async fn get_available_extensions(state: State<'_, AppState>) -> Result<Vec<ExtensionInfo>, String> {
    let mut list = Vec::new();

    let installed_manifests = state.plugin_manager.list_installed_plugins().unwrap_or_default();
    if installed_manifests.is_empty() {
        return Ok(list);
    }

    let repo_plugins = state.db.get_all_repository_plugins().unwrap_or_default();

    let engine_providers = state.engine.get_providers().await.unwrap_or_default();
    let mut matched_manifest_ids = std::collections::HashSet::new();

    if !engine_providers.is_empty() {
        // Filter out dummy placeholder APIs (those pointing to cloudstream.app if real APIs exist)
        let real_providers: Vec<_> = engine_providers
            .iter()
            .filter(|p| !p.main_url.contains("cloudstream.app"))
            .collect();
        let providers_to_use = if real_providers.is_empty() {
            engine_providers.iter().collect::<Vec<_>>()
        } else {
            real_providers
        };

        for p in providers_to_use {
            let manifest = installed_manifests.iter().find(|m| {
                is_manifest_provider_match(m, &p.name)
            });

            let icon_url = manifest
                .and_then(|m| m.icon_url.clone())
                .or_else(|| resolve_plugin_icon(&p.name, manifest.map(|m| m.name.as_str()), &repo_plugins));

            if let Some(m) = manifest {
                matched_manifest_ids.insert(m.id.clone());
                list.push(ExtensionInfo {
                    id: p.name.to_lowercase().replace(' ', "_"),
                    name: p.name.clone(),
                    is_builtin: false,
                    version: Some(format!("v{}", m.version)),
                    supported_types: if p.supported_types.is_empty() {
                        if m.tv_types.is_empty() {
                            vec!["Movie".to_string(), "TvSeries".to_string()]
                        } else {
                            m.tv_types.clone()
                        }
                    } else {
                        p.supported_types.clone()
                    },
                    icon_url,
                    description: m.description.clone()
                        .or_else(|| Some(format!("Dynamic .cs3 extension ({})", p.lang))),
                    language: Some(p.lang.clone()),
                    has_main_page: Some(p.has_main_page),
                });
            }
        }
    }

    // Include any installed plugins that haven't registered with engine yet
    for inst in installed_manifests {
        if !matched_manifest_ids.contains(&inst.id) {
            let icon_url = inst.icon_url
                .or_else(|| resolve_plugin_icon(&inst.name, inst.internal_name.as_deref(), &repo_plugins));
            list.push(ExtensionInfo {
                id: inst.id,
                name: inst.name,
                is_builtin: false,
                version: Some(format!("v{}", inst.version)),
                supported_types: if inst.tv_types.is_empty() {
                    vec!["Movie".to_string(), "TvSeries".to_string()]
                } else {
                    inst.tv_types
                },
                icon_url,
                description: inst.description,
                language: inst.language,
                has_main_page: Some(true),
            });
        }
    }

    Ok(list)
}

#[tauri::command]
async fn get_home_catalog(
    provider: Option<String>,
    page: Option<i32>,
    state: State<'_, AppState>,
) -> Result<Vec<HomePageList>, String> {
    let installed = state.plugin_manager.list_installed_plugins().unwrap_or_default();
    let page_num = page.unwrap_or(1);
    let resolved = resolve_provider_name(&state, provider).await;
    let mut catalog = if installed.is_empty() {
        Vec::new()
    } else {
        state.providers.get_home_page(resolved.as_deref(), page_num).await
    };

    // Prepend "Continue Watching" only on page 1 if any history exists
    if page_num == 1 {
        if let Ok(history) = state.db.get_watch_history(20) {
            if !history.is_empty() {
                let continue_items: Vec<SearchResponse> = history
                    .into_iter()
                    .filter(|h| !h.is_completed && h.position_ms > 10000)
                    .map(|h| SearchResponse {
                        name: if let Some(ep) = h.episode_num {
                            format!("{} (S{}E{})", h.title, h.season_num.unwrap_or(1), ep)
                        } else {
                            h.title
                        },
                        url: h.media_id,
                        api_name: h.provider_id,
                        tv_type: models::TvType::Movie,
                        poster_url: h.poster_url,
                        year: None,
                        score: None,
                        dub_status: None,
                        latest_episode: h.episode_num,
                        quality: None,
                        season: h.season_num,
                        episode: h.episode_num,
                    })
                    .collect();

                if !continue_items.is_empty() {
                    catalog.insert(
                        0,
                        HomePageList {
                            name: "Continue Watching".to_string(),
                            list: continue_items,
                            is_horizontal: true,
                        },
                    );
                }
            }
        }
    }

    Ok(catalog)
}

/// CloudStream `ExpandableHomepageList` parity:
/// Returns shelves wrapped with pagination state (currentPage=1, hasNext from engine).
/// The engine's /main_page response doesn't yet expose has_next per-shelf, so we
/// conservatively set has_next=true for non-empty shelves (real data parity).
#[tauri::command]
async fn get_home_shelves(
    provider: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ExpandableShelf>, String> {
    let installed = state.plugin_manager.list_installed_plugins().unwrap_or_default();
    if installed.is_empty() {
        return Ok(Vec::new());
    }

    let resolved = resolve_provider_name(&state, provider).await;
    let provider_arg = resolved.as_deref();
    let raw = state.providers.get_home_page(provider_arg, 1).await;

    let shelves: Vec<ExpandableShelf> = raw
        .into_iter()
        .filter(|s| !s.list.is_empty())
        .map(|shelf| {
            let has_next = shelf.list.len() >= 10; // assume more exist if full page returned
            ExpandableShelf {
                list: shelf,
                current_page: 1,
                has_next,
            }
        })
        .collect();

    Ok(shelves)
}

/// CloudStream `expand(categoryName)` parity:
/// Fetches the next page for a single shelf and returns only the new items.
#[tauri::command]
async fn expand_shelf(
    provider: Option<String>,
    shelf_name: String,
    page: i32,
    state: State<'_, AppState>,
) -> Result<ExpandableShelf, String> {
    let resolved = resolve_provider_name(&state, provider).await;
    let provider_arg = resolved.as_deref();
    let all_shelves = state.providers.get_home_page(provider_arg, page).await;

    // Find the shelf by name in the page-N response
    let shelf = all_shelves
        .into_iter()
        .find(|s| s.name == shelf_name)
        .unwrap_or_else(|| HomePageList {
            name: shelf_name.clone(),
            list: vec![],
            is_horizontal: true,
        });

    let has_next = shelf.list.len() >= 10;
    Ok(ExpandableShelf {
        list: shelf,
        current_page: page,
        has_next,
    })
}

#[tauri::command]
async fn search_media(
    query: String,
    provider: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResponse>, String> {
    let installed = state.plugin_manager.list_installed_plugins().unwrap_or_default();
    if installed.is_empty() {
        return Ok(Vec::new());
    }
    let resolved = resolve_provider_name(&state, provider).await;
    Ok(state.providers.search(&query, resolved.as_deref()).await)
}

#[tauri::command]
async fn search_media_multi(
    query: String,
    providers: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<SearchMultiResult, String> {
    let q = query.trim();
    if q.len() <= 1 {
        return Ok(SearchMultiResult {
            grouped: Vec::new(),
            bundled: Vec::new(),
        });
    }

    let target_providers: Vec<String> = match providers {
        Some(list)
            if !list.is_empty()
                && !list.contains(&"all".to_string())
                && !list.contains(&"All".to_string())
                && !list.contains(&"All Extensions".to_string()) =>
        {
            list
        }
        _ => {
            let installed = state.plugin_manager.list_installed_plugins().unwrap_or_default();
            if installed.is_empty() {
                Vec::new()
            } else {
                let engine_providers = state.engine.get_providers().await.unwrap_or_default();
                engine_providers
                    .into_iter()
                    .filter(|p| {
                        installed.iter().any(|m| {
                            m.name.eq_ignore_ascii_case(&p.name) ||
                            m.internal_name.as_deref().unwrap_or("").eq_ignore_ascii_case(&p.name) ||
                            p.name.to_lowercase().replace(' ', "_") == m.id.to_lowercase() ||
                            p.name.to_lowercase().contains(&m.name.to_lowercase()) ||
                            m.name.to_lowercase().contains(&p.name.to_lowercase())
                        })
                    })
                    .map(|p| p.name)
                    .collect()
            }
        }
    };

    println!(
        "[search_media_multi] Searching '{}' across {} providers: {:?}",
        q,
        target_providers.len(),
        target_providers
    );

    let all_items: Vec<SearchResponse> = if !target_providers.is_empty() {
        let mut handles = Vec::new();
        for p in target_providers {
            let providers_ref = state.providers.clone();
            let q_clone = q.to_string();
            let p_clone = p.clone();
            handles.push(tokio::spawn(async move {
                match tokio::time::timeout(
                    std::time::Duration::from_secs(7),
                    providers_ref.search(&q_clone, Some(&p_clone)),
                )
                .await
                {
                    Ok(mut items) => {
                        for it in &mut items {
                            if it.api_name.trim().is_empty() {
                                it.api_name = p_clone.clone();
                            }
                        }
                        if !items.is_empty() {
                            println!(
                                "[search_media_multi] Provider '{}' returned {} items",
                                p_clone,
                                items.len()
                            );
                        }
                        items
                    }
                    Err(_) => {
                        eprintln!(
                            "[search_media_multi] Provider '{}' timed out after 7s",
                            p_clone
                        );
                        Vec::new()
                    }
                }
            }));
        }

        let mut collected = Vec::new();
        for handle in handles {
            if let Ok(res) = handle.await {
                collected.extend(res);
            }
        }
        collected
    } else {
        state.providers.search(q, None).await
    };

    println!(
        "[search_media_multi] Total media collected for '{}': {}",
        q,
        all_items.len()
    );

    let mut map: std::collections::BTreeMap<String, Vec<SearchResponse>> = std::collections::BTreeMap::new();
    for item in all_items {
        let key = if item.api_name.trim().is_empty() {
            "Other".to_string()
        } else {
            item.api_name.clone()
        };
        map.entry(key).or_default().push(item);
    }

    let mut grouped = Vec::new();
    for (provider, items) in map {
        grouped.push(ProviderSearchResult {
            provider,
            items,
            current_page: 1,
            has_next: false,
        });
    }

    // CloudStream Round-Robin interleaving algorithm
    let mut bundled = Vec::new();
    let lists: Vec<&[SearchResponse]> = grouped.iter().map(|g| g.items.as_slice()).collect();
    let mut idx = 0;
    loop {
        let mut added = 0;
        for list in &lists {
            if list.len() > idx {
                bundled.push(list[idx].clone());
                added += 1;
            }
        }
        if added == 0 {
            break;
        }
        idx += 1;
    }

    Ok(SearchMultiResult { grouped, bundled })
}

#[tauri::command]
async fn search_media_stream(
    app: AppHandle,
    query: String,
    providers: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<SearchMultiResult, String> {
    let q = query.trim().to_string();
    if q.len() <= 1 {
        return Ok(SearchMultiResult {
            grouped: Vec::new(),
            bundled: Vec::new(),
        });
    }

    let target_providers: Vec<String> = match providers {
        Some(list)
            if !list.is_empty()
                && !list.contains(&"all".to_string())
                && !list.contains(&"All".to_string())
                && !list.contains(&"All Extensions".to_string()) =>
        {
            list
        }
        _ => {
            let engine_providers = state.engine.get_providers().await.unwrap_or_default();
            if !engine_providers.is_empty() {
                engine_providers.into_iter().map(|p| p.name).collect()
            } else {
                state
                    .plugin_manager
                    .list_installed_plugins()
                    .unwrap_or_default()
                    .into_iter()
                    .map(|p| p.name)
                    .collect()
            }
        }
    };

    let total_count = target_providers.len();
    println!(
        "[search_media_stream] Streaming search for '{}' across {} providers",
        q, total_count
    );

    let completed_counter = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let mut handles = Vec::new();

    for p in target_providers {
        let providers_ref = state.providers.clone();
        let q_clone = q.clone();
        let p_clone = p.clone();
        let app_clone = app.clone();
        let counter_clone = completed_counter.clone();

        handles.push(tokio::spawn(async move {
            let res = tokio::time::timeout(
                std::time::Duration::from_secs(7),
                providers_ref.search(&q_clone, Some(&p_clone)),
            )
            .await;

            let items = match res {
                Ok(mut list) => {
                    // Distinct items by URL within this provider (parity with CloudStream Android)
                    let mut seen = std::collections::HashSet::new();
                    list.retain(|it| seen.insert(it.url.clone()));
                    for it in &mut list {
                        if it.api_name.trim().is_empty() {
                            it.api_name = p_clone.clone();
                        }
                    }
                    list
                }
                Err(_) => {
                    eprintln!(
                        "[search_media_stream] Provider '{}' search timed out after 7s",
                        p_clone
                    );
                    Vec::new()
                }
            };

            let completed = counter_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
            let is_done = completed >= total_count;

            // Immediately emit progressive chunk to frontend
            let chunk = SearchChunkEvent {
                query: q_clone,
                provider: p_clone,
                items: items.clone(),
                completed_count: completed,
                total_count,
                is_done,
            };
            let _ = app_clone.emit("search://chunk", chunk);

            items
        }));
    }

    let mut all_items: Vec<SearchResponse> = Vec::new();
    for handle in handles {
        if let Ok(res) = handle.await {
            all_items.extend(res);
        }
    }

    let mut map: std::collections::BTreeMap<String, Vec<SearchResponse>> = std::collections::BTreeMap::new();
    for item in all_items {
        let key = if item.api_name.trim().is_empty() {
            "Other".to_string()
        } else {
            item.api_name.clone()
        };
        map.entry(key).or_default().push(item);
    }

    let mut grouped = Vec::new();
    for (provider, items) in map {
        grouped.push(ProviderSearchResult {
            provider,
            items,
            current_page: 1,
            has_next: false,
        });
    }

    // CloudStream Round-Robin interleaving algorithm with cross-provider URL deduplication
    let mut bundled = Vec::new();
    let mut seen_urls = std::collections::HashSet::new();
    let lists: Vec<&[SearchResponse]> = grouped.iter().map(|g| g.items.as_slice()).collect();
    let mut idx = 0;
    loop {
        let mut added = 0;
        for list in &lists {
            if list.len() > idx {
                let item = &list[idx];
                if seen_urls.insert(item.url.clone()) {
                    bundled.push(item.clone());
                }
                added += 1;
            }
        }
        if added == 0 {
            break;
        }
        idx += 1;
    }

    let _ = app.emit(
        "search://complete",
        serde_json::json!({
            "query": q,
            "total_items": bundled.len(),
            "total_providers": grouped.len(),
        }),
    );

    Ok(SearchMultiResult { grouped, bundled })
}

#[tauri::command]
async fn get_search_suggestions(query: String) -> Result<Vec<String>, String> {
    let q = query.trim();
    if q.len() < 2 {
        return Ok(Vec::new());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(2000))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.themoviedb.org/3/search/multi?api_key=e6333b32409e02a4a6eba6fb7ff866bb&query={}&language=en-US",
        urlencoding::encode(q)
    );

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return Ok(Vec::new()),
    };

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let json: serde_json::Value = resp.json().await.unwrap_or_default();
    let mut suggestions = Vec::new();

    if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
        for item in results {
            let media_type = item.get("media_type").and_then(|m| m.as_str()).unwrap_or_default();
            if media_type == "movie" || media_type == "tv" {
                let title = item.get("title").or_else(|| item.get("name"))
                    .and_then(|t| t.as_str())
                    .map(|s| s.trim().to_string());
                if let Some(t) = title {
                    if !t.is_empty() && !suggestions.contains(&t) {
                        suggestions.push(t);
                        if suggestions.len() >= 10 {
                            break;
                        }
                    }
                }
            }
        }
    }
    Ok(suggestions)
}

#[tauri::command]
async fn get_search_history(
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchHistoryItem>, String> {
    state.db.get_search_history(limit.unwrap_or(20)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_search_history(
    item: SearchHistoryItem,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.add_search_history(&item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_search_history_item(
    key: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.remove_search_history_item(&key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_search_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_search_history().map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_media(provider: String, url: String, state: State<'_, AppState>) -> Result<LoadResponse, String> {
    let resolved = resolve_provider_name(&state, Some(provider.clone())).await.unwrap_or(provider);
    state
        .providers
        .load(&resolved, &url)
        .await
        .map_err(|e| format!("Failed to load media: {}", e))
}

#[tauri::command]
async fn load_links(provider: String, data: String, state: State<'_, AppState>) -> Result<Vec<ExtractorLink>, String> {
    let resolved = resolve_provider_name(&state, Some(provider.clone())).await.unwrap_or(provider);
    let raw_links = state
        .providers
        .load_links(&resolved, &data)
        .await
        .map_err(|e| format!("Failed to extract links: {}", e))?;

    println!("[load_links] Extracted {} stream links for provider '{}'", raw_links.len(), resolved);
    for (i, link) in raw_links.iter().enumerate() {
        println!(
            "[load_links] #{}: name='{}', quality={:?}, is_m3u8={}, url='{}'",
            i, link.name, link.quality, link.is_m3u8, link.url
        );
    }

    Ok(raw_links)
}

#[tauri::command]
async fn save_watch_progress(item: WatchHistoryItem, state: State<'_, AppState>) -> Result<(), String> {
    state.db.save_watch_progress(&item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_watch_history(limit: usize, state: State<'_, AppState>) -> Result<Vec<WatchHistoryItem>, String> {
    state.db.get_watch_history(limit).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_progress(media_id: String, state: State<'_, AppState>) -> Result<Option<WatchHistoryItem>, String> {
    state.db.get_progress_for_media(&media_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_media_watch_history(media_id: String, state: State<'_, AppState>) -> Result<Vec<WatchHistoryItem>, String> {
    state.db.get_media_watch_history(&media_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_watch_history(state: State<'_, AppState>) -> Result<(), String> {
    state.db.clear_watch_history().map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_watch_history_item(media_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_watch_history_item(&media_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_watchlist(state: State<'_, AppState>) -> Result<Vec<WatchlistItem>, String> {
    state.db.get_watchlist().map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_watchlist_item(item: WatchlistItem, state: State<'_, AppState>) -> Result<(), String> {
    state.db.set_watchlist_item(&item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_watchlist_item(media_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.remove_from_watchlist(&media_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_repositories(state: State<'_, AppState>) -> Result<Vec<RepositoryEntry>, String> {
    state.db.get_repositories().map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_repository(url: String, name: Option<String>, state: State<'_, AppState>) -> Result<RepositoryEntry, String> {
    let manifest = state.plugin_manager.fetch_repository(&url).await.map_err(|e| e.to_string())?;
    let repo_name = name.filter(|n| !n.trim().is_empty()).unwrap_or_else(|| manifest.name.clone());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let entry = RepositoryEntry {
        name: repo_name,
        url: manifest.url.clone(),
        icon_url: None,
        manifest_version: manifest.manifest_version,
        plugin_count: manifest.plugins.len(),
        added_at: now,
    };

    let manifest_json = serde_json::to_string(&manifest).unwrap_or_default();
    state.db.save_repository(&entry, &manifest_json).map_err(|e| e.to_string())?;
    Ok(entry)
}

#[tauri::command]
async fn delete_repository(url: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_repository(&url).map_err(|e| e.to_string())
}

#[tauri::command]
async fn sync_repositories(state: State<'_, AppState>) -> Result<Vec<RepositoryEntry>, String> {
    let repos = state.db.get_repositories().map_err(|e| e.to_string())?;
    for repo in &repos {
        if let Ok(manifest) = state.plugin_manager.fetch_repository(&repo.url).await {
            let entry = RepositoryEntry {
                name: manifest.name.clone(),
                url: repo.url.clone(),
                icon_url: repo.icon_url.clone(),
                manifest_version: manifest.manifest_version,
                plugin_count: manifest.plugins.len(),
                added_at: repo.added_at,
            };
            let manifest_json = serde_json::to_string(&manifest).unwrap_or_default();
            let _ = state.db.save_repository(&entry, &manifest_json);
        }
    }
    state.db.get_repositories().map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_repository(url: String, state: State<'_, AppState>) -> Result<RepositoryManifest, String> {
    state
        .plugin_manager
        .fetch_repository(&url)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn install_plugin(manifest: PluginManifest, state: State<'_, AppState>) -> Result<String, String> {
    let path = state
        .plugin_manager
        .install_plugin(&manifest)
        .await
        .map_err(|e| e.to_string())?;
    
    // Notify .cs3 engine to load the new plugin into memory immediately
    let _ = state.engine.reload().await;
    
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn install_plugin_from_file(file_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let path = state
        .plugin_manager
        .install_plugin_from_local_file(&file_path)
        .map_err(|e| e.to_string())?;
    
    // Notify .cs3 engine to load the new plugin into memory immediately
    let _ = state.engine.reload().await;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn install_all_plugins(plugins: Vec<PluginManifest>, state: State<'_, AppState>) -> Result<usize, String> {
    let mut count = 0;
    for p in plugins {
        if state.plugin_manager.install_plugin(&p).await.is_ok() {
            count += 1;
        }
    }
    let _ = state.engine.reload().await;
    Ok(count)
}

#[tauri::command]
async fn list_installed_plugins(state: State<'_, AppState>) -> Result<Vec<PluginManifest>, String> {
    let mut list = state.plugin_manager.list_installed_plugins().map_err(|e| e.to_string())?;
    let repo_plugins = state.db.get_all_repository_plugins().unwrap_or_default();
    for item in &mut list {
        if item.icon_url.is_none() {
            item.icon_url = resolve_plugin_icon(&item.name, item.internal_name.as_deref(), &repo_plugins);
        }
    }
    Ok(list)
}

#[tauri::command]
async fn delete_plugin(name: String, state: State<'_, AppState>) -> Result<(), String> {
    state.plugin_manager.delete_plugin(&name).map_err(|e| e.to_string())?;
    let _ = state.engine.reload().await;
    Ok(())
}

#[tauri::command]
async fn get_anime_skip(
    mal_id: i64,
    episode_num: i32,
    episode_length: f64,
    state: State<'_, AppState>,
) -> Result<Vec<SkipInterval>, String> {
    state
        .skip_manager
        .get_anime_skip(mal_id, episode_num, episode_length)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_subtitles(query: String, lang: Option<String>, state: State<'_, AppState>) -> Result<Vec<SubtitleData>, String> {
    state
        .subtitle_manager
        .search_subtitles(&query, lang.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_proxy_port(state: State<'_, AppState>) -> u16 {
    state.proxy.port()
}

#[tauri::command]
async fn player_load(
    url: String,
    title: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    start_time: Option<f64>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.player.load(&url, title.as_deref(), headers, start_time)
}

#[tauri::command]
async fn player_play(state: State<'_, AppState>) -> Result<(), String> {
    state.player.play()
}

#[tauri::command]
async fn player_pause(state: State<'_, AppState>) -> Result<(), String> {
    state.player.pause()
}

#[tauri::command]
async fn player_seek(position: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.seek(position)
}

#[tauri::command]
async fn player_seek_relative(offset: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.seek_relative(offset)
}

#[tauri::command]
async fn player_set_volume(volume: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_volume(volume)
}

#[tauri::command]
async fn player_set_mute(muted: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_mute(muted)
}

#[tauri::command]
async fn player_stop(state: State<'_, AppState>) -> Result<(), String> {
    state.player.stop()
}

#[tauri::command]
async fn player_get_diagnostics(state: State<'_, AppState>) -> Result<player::PlayerDiagnostics, String> {
    Ok(state.player.get_diagnostics())
}

#[tauri::command]
async fn player_set_audio_track(aid: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_audio_track(aid)
}

#[tauri::command]
async fn player_set_subtitle_track(sid: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_subtitle_track(sid)
}

#[tauri::command]
async fn player_set_subtitle_delay(delay: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_subtitle_delay(delay)
}

#[tauri::command]
async fn player_set_speed(speed: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_speed(speed)
}

#[tauri::command]
async fn player_set_panscan(panscan: f64, state: State<'_, AppState>) -> Result<(), String> {
    state.player.set_panscan(panscan)
}

#[tauri::command]
async fn player_add_subtitle(url_or_path: String, state: State<'_, AppState>) -> Result<(), String> {
    state.player.add_subtitle(&url_or_path)
}

#[tauri::command]
async fn player_get_tracks(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state.player.get_tracks()
}

#[tauri::command]
async fn player_set_preferred_languages(
    slang: Option<String>,
    alang: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .player
        .set_preferred_languages(slang.as_deref(), alang.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap().join(".data"));

            let db_path = app_data_dir.join("cloudstream.db");
            let db = Arc::new(Database::new(db_path).expect("Failed to initialize SQLite database"));

            let proxy = tauri::async_runtime::block_on(async {
                StreamProxy::start().await.expect("Failed to start M3U8 proxy")
            });

            let plugin_manager = Arc::new(PluginManager::new(app_data_dir));
            let engine = Arc::new(EngineClient::new(None));
            
            // Launch background check to ensure .cs3 headless engine is running.
            // After the engine is fully ready (providers loaded), emit 'engine-ready'
            // so the frontend can reload the home catalog without a manual refresh.
            let engine_init = engine.clone();
            let app_handle_for_engine = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                engine_init.ensure_running().await;
                // Signal frontend: engine + plugins are ready
                println!("[EngineClient] Emitting engine-ready event to frontend");
                let _ = app_handle_for_engine.emit("engine-ready", ());
            });

            let providers = Arc::new(ProviderRegistry::new(engine.clone(), plugin_manager.clone()));
            let skip_manager = Arc::new(SkipManager::new());
            let subtitle_manager = Arc::new(SubtitleManager::new());

            let main_window = app.get_webview_window("main").expect("main window not found");
            if let Some(icon) = app.default_window_icon() {
                let _ = main_window.set_icon(icon.clone());
            }
            #[cfg(windows)]
            let hwnd = match main_window.hwnd() {
                Ok(h) => {
                    let val = (h.0 as usize) as i64;
                    println!("[Player] main_window.hwnd() succeeded: {:?}, raw i64: {}", h, val);
                    unsafe {
                        apply_window_theme(val);
                    }
                    val
                }
                Err(e) => {
                    eprintln!("[Player] main_window.hwnd() error: {:?}", e);
                    0i64
                }
            };
            #[cfg(not(windows))]
            let hwnd = 0i64;

            let player = Arc::new(
                player::MpvPlayer::new(hwnd, app.handle().clone())
                    .expect("Failed to initialize native MPV player"),
            );

            app.manage(AppState {
                db,
                proxy: Arc::new(proxy),
                plugin_manager,
                engine,
                providers,
                skip_manager,
                subtitle_manager,
                player,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_available_extensions,
            get_home_catalog,
            get_home_shelves,
            expand_shelf,
            search_media,
            search_media_multi,
            search_media_stream,
            get_search_suggestions,
            add_search_history,
            get_search_history,
            remove_search_history_item,
            clear_search_history,
            load_media,
            load_links,
            save_watch_progress,
            get_watch_history,
            get_media_progress,
            get_media_watch_history,
            clear_watch_history,
            remove_watch_history_item,
            get_watchlist,
            set_watchlist_item,
            remove_watchlist_item,
            get_repositories,
            add_repository,
            delete_repository,
            sync_repositories,
            fetch_repository,
            install_plugin,
            install_plugin_from_file,
            install_all_plugins,
            list_installed_plugins,
            delete_plugin,
            get_anime_skip,
            search_subtitles,
            get_proxy_port,
            player_load,
            player_play,
            player_pause,
            player_seek,
            player_seek_relative,
            player_set_volume,
            player_set_mute,
            player_stop,
            player_get_diagnostics,
            player_set_audio_track,
            player_set_subtitle_track,
            player_set_subtitle_delay,
            player_set_speed,
            player_set_panscan,
            player_add_subtitle,
            player_get_tracks,
            player_set_preferred_languages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(windows)]
unsafe fn apply_window_theme(hwnd_val: i64) {
    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut std::ffi::c_void,
            dwAttribute: u32,
            pvAttribute: *const std::ffi::c_void,
            cbAttribute: u32,
        ) -> i32;
    }

    if hwnd_val == 0 {
        return;
    }

    let hwnd_ptr = hwnd_val as usize as *mut std::ffi::c_void;

    // DWMWA_USE_IMMERSIVE_DARK_MODE = 20
    let dark_mode: i32 = 1;
    let _ = DwmSetWindowAttribute(
        hwnd_ptr,
        20,
        &dark_mode as *const _ as *const std::ffi::c_void,
        std::mem::size_of::<i32>() as u32,
    );

    // DWMWA_CAPTION_COLOR = 35 (COLORREF format: 0x00BBGGRR)
    // Blend with Stremio top edge #19173A => RGB(25, 23, 58) => B=0x3A, G=0x17, R=0x19
    let caption_color: u32 = 0x003A1719;
    let _ = DwmSetWindowAttribute(
        hwnd_ptr,
        35,
        &caption_color as *const _ as *const std::ffi::c_void,
        std::mem::size_of::<u32>() as u32,
    );

    // DWMWA_TEXT_COLOR = 36 (White / light lavender)
    let text_color: u32 = 0x00f8f8f8;
    let _ = DwmSetWindowAttribute(
        hwnd_ptr,
        36,
        &text_color as *const _ as *const std::ffi::c_void,
        std::mem::size_of::<u32>() as u32,
    );
}

