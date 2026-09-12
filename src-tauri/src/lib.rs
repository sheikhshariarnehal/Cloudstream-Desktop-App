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
    ExtractorLink, ExtensionInfo, HomePageList, LoadResponse, PluginManifest, RepositoryEntry,
    RepositoryManifest, SearchResponse, SkipInterval, SubtitleData, WatchHistoryItem, WatchlistItem,
};
use plugins::PluginManager;
use providers::ProviderRegistry;
use proxy::StreamProxy;
use std::sync::Arc;
use subtitles::SubtitleManager;
use tauri::{Manager, State};
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

#[tauri::command]
async fn get_available_extensions(state: State<'_, AppState>) -> Result<Vec<ExtensionInfo>, String> {
    let mut list = Vec::new();

    // Unified "All Extensions" option
    list.push(ExtensionInfo {
        id: "all".to_string(),
        name: "All Extensions".to_string(),
        is_builtin: true,
        version: Some("Combined".to_string()),
        supported_types: vec!["Movie".to_string(), "TvSeries".to_string(), "Anime".to_string()],
        icon_url: None,
        description: Some("Unified feeds across all installed extensions".to_string()),
    });

    let installed_manifests = state.plugin_manager.list_installed_plugins().unwrap_or_default();
    let engine_providers = state.engine.get_providers().await.unwrap_or_default();

    if !engine_providers.is_empty() {
        for p in engine_providers {
            let manifest = installed_manifests.iter().find(|m| {
                m.name.eq_ignore_ascii_case(&p.name) ||
                m.internal_name.as_deref().unwrap_or("").eq_ignore_ascii_case(&p.name)
            });

            list.push(ExtensionInfo {
                id: p.name.to_lowercase().replace(' ', "_"),
                name: p.name.clone(),
                is_builtin: false,
                version: manifest.map(|m| format!("v{}", m.version)),
                supported_types: if p.supported_types.is_empty() {
                    vec!["Movie".to_string(), "TvSeries".to_string()]
                } else {
                    p.supported_types
                },
                icon_url: manifest.and_then(|m| m.icon_url.clone()),
                description: manifest.and_then(|m| m.description.clone())
                    .or_else(|| Some(format!("Dynamic .cs3 extension ({})", p.lang))),
            });
        }
    } else {
        // Fallback to installed manifests if engine providers list is still loading
        for inst in installed_manifests {
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
                icon_url: inst.icon_url,
                description: inst.description,
            });
        }
    }

    Ok(list)
}

#[tauri::command]
async fn get_home_catalog(
    provider: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<HomePageList>, String> {
    let mut catalog = state.providers.get_home_page(provider.as_deref()).await;

    // Prepend "Continue Watching" if any history exists
    if let Ok(history) = state.db.get_watch_history(10) {
        if !history.is_empty() {
            let continue_items: Vec<SearchResponse> = history
                .into_iter()
                .filter(|h| !h.is_completed && h.position_ms > 15000)
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

    Ok(catalog)
}

#[tauri::command]
async fn search_media(
    query: String,
    provider: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResponse>, String> {
    Ok(state.providers.search(&query, provider.as_deref()).await)
}

#[tauri::command]
async fn load_media(provider: String, url: String, state: State<'_, AppState>) -> Result<LoadResponse, String> {
    state
        .providers
        .load(&provider, &url)
        .await
        .map_err(|e| format!("Failed to load media: {}", e))
}

#[tauri::command]
async fn load_links(provider: String, data: String, state: State<'_, AppState>) -> Result<Vec<ExtractorLink>, String> {
    let raw_links = state
        .providers
        .load_links(&provider, &data)
        .await
        .map_err(|e| format!("Failed to extract links: {}", e))?;

    println!("[load_links] Extracted {} stream links for provider '{}'", raw_links.len(), provider);
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
    let mut repos = state.db.get_repositories().map_err(|e| e.to_string())?;
    if repos.is_empty() {
        let presets = vec![
            ("Nehal's Server (BDIX & CloudStream)", "https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/repo.json"),
            ("Hexated Providers", "https://raw.githubusercontent.com/Hexated/cloudstream-extensions-hexated/master/repo.json"),
            ("CloudStream Multilingual", "https://raw.githubusercontent.com/recloudstream/cloudstream-extensions-multilingual/master/repo.json"),
        ];

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        for (name, url) in presets {
            let entry = RepositoryEntry {
                name: name.to_string(),
                url: url.to_string(),
                icon_url: None,
                manifest_version: Some(1),
                plugin_count: 0,
                added_at: now,
            };
            let _ = state.db.save_repository(&entry, "{}");
        }
        repos = state.db.get_repositories().map_err(|e| e.to_string())?;
    }
    Ok(repos)
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
    state.plugin_manager.list_installed_plugins().map_err(|e| e.to_string())
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
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.player.load(&url, title.as_deref(), headers)
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
            
            // Launch background check to ensure .cs3 headless engine is running
            let engine_init = engine.clone();
            tauri::async_runtime::spawn(async move {
                engine_init.ensure_running().await;
            });

            let providers = Arc::new(ProviderRegistry::new(engine.clone(), plugin_manager.clone()));
            let skip_manager = Arc::new(SkipManager::new());
            let subtitle_manager = Arc::new(SubtitleManager::new());

            let main_window = app.get_webview_window("main").expect("main window not found");
            #[cfg(windows)]
            let hwnd = match main_window.hwnd() {
                Ok(h) => {
                    let val = (h.0 as usize) as i64;
                    println!("[Player] main_window.hwnd() succeeded: {:?}, raw i64: {}", h, val);
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
            search_media,
            load_media,
            load_links,
            save_watch_progress,
            get_watch_history,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

