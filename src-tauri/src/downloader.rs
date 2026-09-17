use crate::database::{Database, DownloadDbRecord};
use crate::directories::{format_bytes, get_dir_size_and_count, resolve_download_dir};
use anyhow::Result;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, RANGE};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::broadcast;
use tokio::sync::Mutex;
use tokio::time::timeout;

// ── Configuration constants ────────────────────────────────────────────────

/// How long to wait for the initial response before giving up.
const CONNECT_TIMEOUT_SECS: u64 = 30;

/// How long to wait for a single chunk before treating the connection as stalled.
const CHUNK_READ_TIMEOUT_SECS: u64 = 30;

/// Maximum number of chunk-level retries before marking the download as failed.
const MAX_CHUNK_RETRIES: u32 = 8;

/// Maximum retries per HLS segment.
const MAX_SEGMENT_RETRIES: u32 = 5;

/// How often (ms) to emit download-progress events to the frontend.
const PROGRESS_EMIT_INTERVAL_MS: u64 = 400;

/// How often (ms) to recalculate speed.
const SPEED_CHECK_INTERVAL_MS: u64 = 500;

// ── Public API types ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub id: Option<String>,
    pub parent_id: String,
    pub url: String,
    pub source_api: String,
    pub media_title: String,
    pub episode_title: Option<String>,
    pub season_num: Option<i32>,
    pub episode_num: Option<i32>,
    pub tv_type: String,
    pub poster_url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub custom_download_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItem {
    pub id: String,
    pub parent_id: String,
    pub url: String,
    pub source_api: String,
    pub media_title: String,
    pub episode_title: Option<String>,
    pub season_num: Option<i32>,
    pub episode_num: Option<i32>,
    pub tv_type: String,
    pub poster_url: Option<String>,
    pub file_path: String,
    pub total_bytes: u64,
    pub downloaded_bytes: u64,
    pub formatted_total: String,
    pub formatted_downloaded: String,
    pub status: String,
    pub error_message: Option<String>,
    pub speed_bytes_per_sec: u64,
    pub formatted_speed: String,
    pub eta_seconds: u64,
    pub progress_pct: f64,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub formatted_speed: String,
    pub eta_seconds: u64,
    pub progress_pct: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageDiskInfo {
    pub total_space_bytes: u64,
    pub available_space_bytes: u64,
    pub used_space_bytes: u64,
    pub cloudstream_download_bytes: u64,
    pub formatted_total: String,
    pub formatted_available: String,
    pub formatted_used: String,
    pub formatted_cloudstream: String,
    pub download_path: String,
}

#[derive(Clone, Debug)]
enum DownloadSignal {
    Pause,
    Cancel,
}

// ── DownloadManager ────────────────────────────────────────────────────────

pub struct DownloadManager {
    db: Arc<Database>,
    app_handle: AppHandle,
    client: Client,
    signals: Arc<Mutex<HashMap<String, broadcast::Sender<DownloadSignal>>>>,
    speeds: Arc<Mutex<HashMap<String, (u64, u64)>>>,
    active_downloads: Arc<AtomicUsize>,
}

impl DownloadManager {
    pub fn new(db: Arc<Database>, app_handle: AppHandle) -> Self {
        let client = Client::builder()
            .danger_accept_invalid_certs(true)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .connect_timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
            // NOTE: We do NOT set a global read timeout here because we manage
            // per-chunk timeouts manually. A global timeout would kill long downloads.
            .tcp_keepalive(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            db,
            app_handle,
            client,
            signals: Arc::new(Mutex::new(HashMap::new())),
            speeds: Arc::new(Mutex::new(HashMap::new())),
            active_downloads: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Enqueues and starts a video download.
    pub async fn start_download(&self, req: DownloadRequest) -> Result<String, String> {
        let id = req.id.clone().unwrap_or_else(|| {
            let clean_parent = sanitize_filename(&req.parent_id);
            let s = req.season_num.unwrap_or(0);
            let e = req.episode_num.unwrap_or(0);
            format!("{}_s{}_e_{}", clean_parent, s, e)
        });

        let base_dir = resolve_download_dir(req.custom_download_path.as_deref());
        let file_path = determine_target_filepath(&base_dir, &req);

        if let Some(parent) = file_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Serialise custom headers so they can be restored on resume.
        let headers_json = req
            .headers
            .as_ref()
            .and_then(|h| serde_json::to_string(h).ok());

        let record = DownloadDbRecord {
            id: id.clone(),
            parent_id: req.parent_id.clone(),
            url: req.url.clone(),
            source_api: req.source_api.clone(),
            media_title: req.media_title.clone(),
            episode_title: req.episode_title.clone(),
            season_num: req.season_num,
            episode_num: req.episode_num,
            tv_type: req.tv_type.clone(),
            poster_url: req.poster_url.clone(),
            file_path: file_path.to_string_lossy().to_string(),
            total_bytes: 0,
            downloaded_bytes: 0,
            status: "pending".to_string(),
            error_message: None,
            headers_json,
            created_at: chrono::Utc::now().timestamp_millis(),
            completed_at: None,
        };

        self.db
            .upsert_download(&record)
            .map_err(|e| format!("Failed to record download in database: {}", e))?;

        let (tx, rx) = broadcast::channel::<DownloadSignal>(4);
        {
            let mut signals = self.signals.lock().await;
            signals.insert(id.clone(), tx);
        }

        let db_clone = self.db.clone();
        let app_handle_clone = self.app_handle.clone();
        let client_clone = self.client.clone();
        let signals_map = self.signals.clone();
        let speeds_map = self.speeds.clone();
        let active_counter = self.active_downloads.clone();
        let req_clone = req.clone();
        let id_clone = id.clone();
        let target_path_clone = file_path.clone();

        tauri::async_runtime::spawn(async move {
            active_counter.fetch_add(1, Ordering::SeqCst);
            let result = run_download_loop(
                id_clone.clone(),
                req_clone,
                target_path_clone,
                db_clone.clone(),
                app_handle_clone.clone(),
                client_clone,
                rx,
                speeds_map.clone(),
            )
            .await;

            active_counter.fetch_sub(1, Ordering::SeqCst);
            let mut sigs = signals_map.lock().await;
            sigs.remove(&id_clone);
            let mut speeds = speeds_map.lock().await;
            speeds.remove(&id_clone);

            if let Err(e) = result {
                eprintln!("[DownloadManager] Download failed for {}: {}", id_clone, e);
                let _ = db_clone.update_download_progress(
                    &id_clone,
                    0,
                    0,
                    "failed",
                    Some(&e),
                    None,
                );
                let _ = app_handle_clone.emit(
                    "download-status",
                    serde_json::json!({
                        "id": id_clone,
                        "status": "failed",
                        "error": e
                    }),
                );
            }
        });

        Ok(id)
    }

    /// Pause an active download.
    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let signals = self.signals.lock().await;
        if let Some(tx) = signals.get(id) {
            let _ = tx.send(DownloadSignal::Pause);
        }
        let _ = self
            .db
            .update_download_progress(id, 0, 0, "paused", None, None);
        let _ = self.app_handle.emit(
            "download-status",
            serde_json::json!({ "id": id, "status": "paused" }),
        );
        Ok(())
    }

    /// Resume a paused download, restoring stored custom headers.
    pub async fn resume_download(&self, id: &str) -> Result<(), String> {
        let record = self
            .db
            .get_download_by_id(id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Download with id {} not found", id))?;

        if record.status == "completed" {
            return Ok(());
        }

        // Restore headers that were saved at initial enqueue time.
        let headers: Option<HashMap<String, String>> = record
            .headers_json
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok());

        let req = DownloadRequest {
            id: Some(record.id.clone()),
            parent_id: record.parent_id,
            url: record.url,
            source_api: record.source_api,
            media_title: record.media_title,
            episode_title: record.episode_title,
            season_num: record.season_num,
            episode_num: record.episode_num,
            tv_type: record.tv_type,
            poster_url: record.poster_url,
            headers,
            custom_download_path: None,
        };

        self.start_download(req).await.map(|_| ())
    }

    /// Cancel download and optionally remove partial file.
    pub async fn cancel_download(&self, id: &str, delete_file: bool) -> Result<(), String> {
        {
            let signals = self.signals.lock().await;
            if let Some(tx) = signals.get(id) {
                let _ = tx.send(DownloadSignal::Cancel);
            }
        }

        if let Ok(Some(record)) = self.db.get_download_by_id(id) {
            if delete_file {
                let p = PathBuf::from(&record.file_path);
                let part_file = p.with_extension(format!(
                    "{}.part",
                    p.extension()
                        .unwrap_or_default()
                        .to_string_lossy()
                ));
                let _ = fs::remove_file(&p);
                let _ = fs::remove_file(&part_file);
            }
        }

        let _ = self.db.delete_download(id);
        let _ = self.app_handle.emit(
            "download-status",
            serde_json::json!({ "id": id, "status": "cancelled" }),
        );
        Ok(())
    }

    /// Retry a failed download.
    pub async fn retry_download(&self, id: &str) -> Result<(), String> {
        self.resume_download(id).await
    }

    /// Returns list of all downloads with live speeds, sizes, and ETA.
    pub async fn get_downloads(&self) -> Result<Vec<DownloadItem>, String> {
        let records = self.db.get_all_downloads().map_err(|e| e.to_string())?;
        let speeds = self.speeds.lock().await;

        let mut items = Vec::new();
        for r in records {
            let (speed, eta) = speeds.get(&r.id).copied().unwrap_or((0, 0));

            let mut downloaded = r.downloaded_bytes;
            let target_path = PathBuf::from(&r.file_path);
            let part_path = target_path.with_extension(format!(
                "{}.part",
                target_path
                    .extension()
                    .unwrap_or_default()
                    .to_string_lossy()
            ));

            if r.status == "completed" && target_path.exists() {
                if let Ok(meta) = target_path.metadata() {
                    downloaded = meta.len();
                }
            } else if part_path.exists() {
                if let Ok(meta) = part_path.metadata() {
                    downloaded = meta.len();
                }
            }

            let total = if r.total_bytes > 0 {
                r.total_bytes
            } else {
                downloaded
            };
            let progress_pct = if total > 0 {
                ((downloaded as f64 / total as f64) * 100.0).min(100.0)
            } else {
                0.0
            };

            items.push(DownloadItem {
                id: r.id,
                parent_id: r.parent_id,
                url: r.url,
                source_api: r.source_api,
                media_title: r.media_title,
                episode_title: r.episode_title,
                season_num: r.season_num,
                episode_num: r.episode_num,
                tv_type: r.tv_type,
                poster_url: r.poster_url,
                file_path: r.file_path,
                total_bytes: total,
                downloaded_bytes: downloaded,
                formatted_total: format_bytes(total),
                formatted_downloaded: format_bytes(downloaded),
                status: r.status,
                error_message: r.error_message,
                speed_bytes_per_sec: speed,
                formatted_speed: if speed > 0 {
                    format!("{}/s", format_bytes(speed))
                } else {
                    "".to_string()
                },
                eta_seconds: eta,
                progress_pct,
                created_at: r.created_at,
                completed_at: r.completed_at,
            });
        }

        Ok(items)
    }

    pub async fn delete_download(&self, id: &str, delete_file: bool) -> Result<(), String> {
        self.cancel_download(id, delete_file).await
    }

    pub async fn delete_downloads_batch(
        &self,
        ids: Vec<String>,
        delete_files: bool,
    ) -> Result<(), String> {
        for id in &ids {
            let _ = self.cancel_download(id, delete_files).await;
        }
        Ok(())
    }

    pub async fn get_storage_disk_info(
        &self,
        custom_path: Option<String>,
    ) -> Result<StorageDiskInfo, String> {
        let download_dir = resolve_download_dir(custom_path.as_deref());
        let _ = fs::create_dir_all(&download_dir);

        let (cloudstream_bytes, _) = get_dir_size_and_count(&download_dir);

        let (available_bytes, total_bytes) = get_disk_space(&download_dir)
            .unwrap_or((100 * 1024 * 1024 * 1024, 500 * 1024 * 1024 * 1024));

        let used_bytes = total_bytes.saturating_sub(available_bytes);

        Ok(StorageDiskInfo {
            total_space_bytes: total_bytes,
            available_space_bytes: available_bytes,
            used_space_bytes: used_bytes,
            cloudstream_download_bytes: cloudstream_bytes,
            formatted_total: format_bytes(total_bytes),
            formatted_available: format_bytes(available_bytes),
            formatted_used: format_bytes(used_bytes),
            formatted_cloudstream: format_bytes(cloudstream_bytes),
            download_path: download_dir.to_string_lossy().to_string(),
        })
    }
}

// ── Download loop (direct HTTP streaming) ─────────────────────────────────

/// Main download worker. Dispatches to HLS or direct-stream sub-routines.
async fn run_download_loop(
    id: String,
    req: DownloadRequest,
    target_path: PathBuf,
    db: Arc<Database>,
    app_handle: AppHandle,
    client: Client,
    mut signal_rx: broadcast::Receiver<DownloadSignal>,
    speeds_map: Arc<Mutex<HashMap<String, (u64, u64)>>>,
) -> Result<(), String> {
    let part_path = target_path.with_extension(format!(
        "{}.part",
        target_path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
    ));

    let _ = db.update_download_progress(&id, 0, 0, "downloading", None, None);
    let _ = app_handle.emit(
        "download-status",
        serde_json::json!({ "id": &id, "status": "downloading" }),
    );

    let is_m3u8 = req.url.contains(".m3u8")
        || req.url.contains("/m3u8")
        || req.url.contains("index.m3u8");

    if is_m3u8 {
        return download_hls_stream(
            &id,
            &req,
            &part_path,
            &target_path,
            &db,
            &app_handle,
            &client,
            &mut signal_rx,
            &speeds_map,
        )
        .await;
    }

    download_direct_stream(
        &id,
        &req,
        &part_path,
        &target_path,
        &db,
        &app_handle,
        &client,
        &mut signal_rx,
        &speeds_map,
    )
    .await
}

/// Streams a direct MP4/MKV/WebM with byte-range resume, per-chunk read
/// timeout, and exponential-backoff retry on chunk errors.
async fn download_direct_stream(
    id: &str,
    req: &DownloadRequest,
    part_path: &Path,
    target_path: &Path,
    db: &Arc<Database>,
    app_handle: &AppHandle,
    client: &Client,
    signal_rx: &mut broadcast::Receiver<DownloadSignal>,
    speeds_map: &Arc<Mutex<HashMap<String, (u64, u64)>>>,
) -> Result<(), String> {
    let mut downloaded_offset = if part_path.exists() {
        fs::metadata(part_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut chunk_retry_count = 0u32;

    // Outer retry loop – re-opens the HTTP connection from the current offset
    // whenever we hit a chunk decode error or read stall.
    'connection: loop {
        let mut headers = build_headers(req.headers.as_ref());

        if downloaded_offset > 0 {
            let range_val = format!("bytes={}-", downloaded_offset);
            if let Ok(hv) = HeaderValue::from_str(&range_val) {
                headers.insert(RANGE, hv);
            }
        }

        let mut response = match client.get(&req.url).headers(headers.clone()).send().await {
            Ok(r) => r,
            Err(e) => {
                chunk_retry_count += 1;
                if chunk_retry_count > MAX_CHUNK_RETRIES {
                    return Err(format!("Network request failed after {} retries: {}", MAX_CHUNK_RETRIES, e));
                }
                let delay = backoff_delay(chunk_retry_count);
                eprintln!("[Downloader] Connection error (attempt {}), retrying in {:?}: {}", chunk_retry_count, delay, e);
                tokio::time::sleep(delay).await;
                continue 'connection;
            }
        };

        // If server rejected the Range header, restart from zero.
        if !response.status().is_success() && response.status().as_u16() != 206 {
            if downloaded_offset > 0 {
                eprintln!(
                    "[Downloader] Server returned {} for ranged request, restarting from zero.",
                    response.status()
                );
                downloaded_offset = 0;
                let _ = fs::remove_file(part_path);
                headers.remove(RANGE);
                response = match client.get(&req.url).headers(headers).send().await {
                    Ok(r) => r,
                    Err(e) => return Err(format!("Network request retry failed: {}", e)),
                };
            } else {
                return Err(format!(
                    "Server returned error status: {}",
                    response.status()
                ));
            }
        }

        let total_bytes = response
            .content_length()
            .map(|cl| cl + downloaded_offset)
            .unwrap_or(0);

        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .append(downloaded_offset > 0)
            .open(part_path)
            .map_err(|e| format!("Failed to open part file: {}", e))?;

        if downloaded_offset > 0 {
            let _ = file.seek(SeekFrom::End(0));
        }

        let mut current_downloaded = downloaded_offset;
        let mut last_emit = Instant::now();
        let mut last_speed_check = Instant::now();
        let mut bytes_since_speed_check = 0u64;
        let mut current_speed = 0u64;

        // Inner chunk loop
        loop {
            // Check pause / cancel before blocking on the next chunk.
            if let Ok(signal) = signal_rx.try_recv() {
                match signal {
                    DownloadSignal::Pause => {
                        let _ = file.flush();
                        let _ = db.update_download_progress(
                            id,
                            current_downloaded,
                            total_bytes,
                            "paused",
                            None,
                            None,
                        );
                        return Ok(());
                    }
                    DownloadSignal::Cancel => {
                        let _ = file.flush();
                        return Ok(());
                    }
                }
            }

            // Apply per-chunk read timeout.
            let chunk_result = timeout(
                Duration::from_secs(CHUNK_READ_TIMEOUT_SECS),
                response.chunk(),
            )
            .await;

            let chunk = match chunk_result {
                Ok(Ok(Some(c))) => {
                    // Successful chunk – reset retry counter.
                    chunk_retry_count = 0;
                    c
                }
                Ok(Ok(None)) => {
                    // Stream finished normally.
                    break;
                }
                Ok(Err(e)) => {
                    // Chunk decode error – retry with backoff from current offset.
                    chunk_retry_count += 1;
                    if chunk_retry_count > MAX_CHUNK_RETRIES {
                        let _ = file.flush();
                        return Err(format!(
                            "Chunk decode failed after {} retries: {}",
                            MAX_CHUNK_RETRIES, e
                        ));
                    }
                    let delay = backoff_delay(chunk_retry_count);
                    eprintln!(
                        "[Downloader] Chunk error (attempt {}), reconnecting in {:?}: {}",
                        chunk_retry_count, delay, e
                    );
                    let _ = file.flush();
                    // Save progress so resume starts from the right byte.
                    let _ = db.update_download_progress(
                        id,
                        current_downloaded,
                        total_bytes,
                        "downloading",
                        None,
                        None,
                    );
                    downloaded_offset = current_downloaded;
                    tokio::time::sleep(delay).await;
                    continue 'connection;
                }
                Err(_elapsed) => {
                    // Read timed out – treat as stall, reconnect.
                    chunk_retry_count += 1;
                    if chunk_retry_count > MAX_CHUNK_RETRIES {
                        let _ = file.flush();
                        return Err(format!(
                            "Stream stalled for {}s after {} retries",
                            CHUNK_READ_TIMEOUT_SECS, MAX_CHUNK_RETRIES
                        ));
                    }
                    let delay = backoff_delay(chunk_retry_count);
                    eprintln!(
                        "[Downloader] Stream stalled (attempt {}), reconnecting in {:?}",
                        chunk_retry_count, delay
                    );
                    let _ = file.flush();
                    let _ = db.update_download_progress(
                        id,
                        current_downloaded,
                        total_bytes,
                        "downloading",
                        None,
                        None,
                    );
                    downloaded_offset = current_downloaded;
                    tokio::time::sleep(delay).await;
                    continue 'connection;
                }
            };

            file.write_all(&chunk)
                .map_err(|e| format!("Disk write error: {}", e))?;

            let chunk_len = chunk.len() as u64;
            current_downloaded += chunk_len;
            bytes_since_speed_check += chunk_len;

            // Speed update.
            let speed_elapsed = last_speed_check.elapsed().as_millis();
            if speed_elapsed >= SPEED_CHECK_INTERVAL_MS as u128 {
                let elapsed_secs = speed_elapsed as f64 / 1000.0;
                current_speed = (bytes_since_speed_check as f64 / elapsed_secs) as u64;
                bytes_since_speed_check = 0;
                last_speed_check = Instant::now();

                let eta = if current_speed > 0 && total_bytes > current_downloaded {
                    (total_bytes - current_downloaded) / current_speed
                } else {
                    0
                };
                let mut speeds = speeds_map.lock().await;
                speeds.insert(id.to_string(), (current_speed, eta));
            }

            // Progress emit.
            if last_emit.elapsed() >= Duration::from_millis(PROGRESS_EMIT_INTERVAL_MS) {
                let progress_pct = if total_bytes > 0 {
                    ((current_downloaded as f64 / total_bytes as f64) * 100.0).min(100.0)
                } else {
                    0.0
                };
                let eta = if current_speed > 0 && total_bytes > current_downloaded {
                    (total_bytes - current_downloaded) / current_speed
                } else {
                    0
                };

                let payload = DownloadProgressPayload {
                    id: id.to_string(),
                    downloaded_bytes: current_downloaded,
                    total_bytes,
                    speed_bytes_per_sec: current_speed,
                    formatted_speed: if current_speed > 0 {
                        format!("{}/s", format_bytes(current_speed))
                    } else {
                        "".to_string()
                    },
                    eta_seconds: eta,
                    progress_pct,
                    status: "downloading".to_string(),
                };

                let _ = app_handle.emit("download-progress", &payload);
                let _ = db.update_download_progress(
                    id,
                    current_downloaded,
                    total_bytes,
                    "downloading",
                    None,
                    None,
                );
                last_emit = Instant::now();
            }
        }

        // Stream ended cleanly – finalise the file.
        file.flush()
            .map_err(|e| format!("Failed to flush file: {}", e))?;
        drop(file);

        if target_path.exists() {
            let _ = fs::remove_file(target_path);
        }
        fs::rename(part_path, target_path)
            .map_err(|e| format!("Failed to finalize downloaded file: {}", e))?;

        let final_bytes = fs::metadata(target_path)
            .map(|m| m.len())
            .unwrap_or(current_downloaded);
        let now = chrono::Utc::now().timestamp_millis();
        let _ = db.update_download_progress(
            id,
            final_bytes,
            final_bytes,
            "completed",
            None,
            Some(now),
        );
        let _ = app_handle.emit(
            "download-status",
            serde_json::json!({
                "id": id,
                "status": "completed",
                "file_path": target_path.to_string_lossy()
            }),
        );

        return Ok(());
    }
}

// ── HLS / M3U8 downloader ─────────────────────────────────────────────────

/// Downloads an HLS stream by fetching and concatenating individual TS/AAC
/// segments. Supports:
///   - Master playlist resolution (picks highest-bandwidth variant)
///   - Resume by skipping already-written segments (tracked via `.hls_idx` file)
///   - Per-segment retry with exponential backoff
async fn download_hls_stream(
    id: &str,
    req: &DownloadRequest,
    part_path: &Path,
    target_path: &Path,
    db: &Arc<Database>,
    app_handle: &AppHandle,
    client: &Client,
    signal_rx: &mut broadcast::Receiver<DownloadSignal>,
    speeds_map: &Arc<Mutex<HashMap<String, (u64, u64)>>>,
) -> Result<(), String> {
    let custom_headers = build_headers(req.headers.as_ref());

    // Fetch the initial playlist URL (may be a master or media playlist).
    let playlist_text = fetch_text_with_retry(client, &req.url, &custom_headers, MAX_SEGMENT_RETRIES)
        .await
        .map_err(|e| format!("Failed to fetch M3U8 playlist: {}", e))?;

    // Resolve to a media playlist (if the URL pointed at a master).
    let (media_playlist_url, media_playlist_text) =
        resolve_media_playlist(client, &req.url, &playlist_text, &custom_headers).await?;

    let base_url = media_playlist_url
        .rsplit_once('/')
        .map(|(b, _)| b)
        .unwrap_or(&media_playlist_url);

    let segment_urls = parse_segment_urls(&media_playlist_text, base_url, &media_playlist_url);
    if segment_urls.is_empty() {
        return Err("No video segments found in M3U8 stream".to_string());
    }

    let total_segments = segment_urls.len();

    // Resume support: read how many segments were already written.
    let idx_path = part_path.with_extension("hls_idx");
    let start_segment = if idx_path.exists() {
        fs::read_to_string(&idx_path)
            .ok()
            .and_then(|s| s.trim().parse::<usize>().ok())
            .unwrap_or(0)
    } else {
        0
    };

    // On fresh start, truncate part file; on resume, append.
    let mut file = if start_segment == 0 {
        OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(part_path)
            .map_err(|e| format!("Failed to create part file: {}", e))?
    } else {
        OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(part_path)
            .map_err(|e| format!("Failed to open part file for append: {}", e))?
    };

    let mut downloaded_bytes = if start_segment > 0 {
        fs::metadata(part_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0u64
    };

    let mut last_speed_check = Instant::now();
    let mut bytes_since_check = 0u64;
    let mut current_speed = 0u64;

    for (idx, seg_url) in segment_urls.iter().enumerate() {
        // Skip already-downloaded segments (resume).
        if idx < start_segment {
            continue;
        }

        // Check pause / cancel.
        if let Ok(sig) = signal_rx.try_recv() {
            match sig {
                DownloadSignal::Pause => {
                    let _ = file.flush();
                    // Save resume index.
                    let _ = fs::write(&idx_path, idx.to_string());
                    let _ = db.update_download_progress(
                        id,
                        downloaded_bytes,
                        // Estimate total as proportional to downloaded so far.
                        downloaded_bytes * total_segments as u64 / idx.max(1) as u64,
                        "paused",
                        None,
                        None,
                    );
                    return Ok(());
                }
                DownloadSignal::Cancel => {
                    let _ = file.flush();
                    return Ok(());
                }
            }
        }

        // Download segment with retry.
        let seg_bytes = fetch_bytes_with_retry(client, seg_url, &custom_headers, MAX_SEGMENT_RETRIES)
            .await
            .map_err(|e| {
                format!("Failed to download segment {} after {} retries: {}", idx + 1, MAX_SEGMENT_RETRIES, e)
            })?;

        let blen = seg_bytes.len() as u64;
        downloaded_bytes += blen;
        bytes_since_check += blen;

        file.write_all(&seg_bytes)
            .map_err(|e| format!("Disk write error on segment {}: {}", idx + 1, e))?;

        // Persist resume index after each successful segment.
        let _ = fs::write(&idx_path, (idx + 1).to_string());

        // Speed calculation.
        let speed_elapsed_ms = last_speed_check.elapsed().as_millis();
        if speed_elapsed_ms >= SPEED_CHECK_INTERVAL_MS as u128 {
            let elapsed_secs = speed_elapsed_ms as f64 / 1000.0;
            current_speed = (bytes_since_check as f64 / elapsed_secs) as u64;
            bytes_since_check = 0;
            last_speed_check = Instant::now();

            let remaining = total_segments.saturating_sub(idx + 1);
            let avg_seg_bytes = if idx > 0 {
                downloaded_bytes / (idx as u64 + 1)
            } else {
                downloaded_bytes
            };
            let eta = if current_speed > 0 {
                (remaining as u64 * avg_seg_bytes) / current_speed
            } else {
                0
            };

            let mut speeds = speeds_map.lock().await;
            speeds.insert(id.to_string(), (current_speed, eta));
        }

        // Estimate total bytes based on average segment size.
        let estimated_total = if idx > 0 {
            downloaded_bytes * total_segments as u64 / (idx as u64 + 1)
        } else {
            downloaded_bytes * total_segments as u64
        };

        let progress_pct = ((idx + 1) as f64 / total_segments as f64 * 100.0).min(100.0);
        let payload = DownloadProgressPayload {
            id: id.to_string(),
            downloaded_bytes,
            total_bytes: estimated_total,
            speed_bytes_per_sec: current_speed,
            formatted_speed: if current_speed > 0 {
                format!("{}/s", format_bytes(current_speed))
            } else {
                "".to_string()
            },
            eta_seconds: {
                let remaining = total_segments.saturating_sub(idx + 1);
                let avg = if idx > 0 { downloaded_bytes / (idx as u64 + 1) } else { 0 };
                if current_speed > 0 { remaining as u64 * avg / current_speed } else { 0 }
            },
            progress_pct,
            status: "downloading".to_string(),
        };

        let _ = app_handle.emit("download-progress", &payload);
        let _ = db.update_download_progress(
            id,
            downloaded_bytes,
            estimated_total,
            "downloading",
            None,
            None,
        );
    }

    file.flush()
        .map_err(|e| format!("Failed to flush HLS file: {}", e))?;
    drop(file);

    // Remove the resume-index file on success.
    let _ = fs::remove_file(&idx_path);

    if target_path.exists() {
        let _ = fs::remove_file(target_path);
    }
    fs::rename(part_path, target_path)
        .map_err(|e| format!("Failed to finalize HLS file: {}", e))?;

    let now = chrono::Utc::now().timestamp_millis();
    let _ = db.update_download_progress(
        id,
        downloaded_bytes,
        downloaded_bytes,
        "completed",
        None,
        Some(now),
    );
    let _ = app_handle.emit(
        "download-status",
        serde_json::json!({
            "id": id,
            "status": "completed",
            "file_path": target_path.to_string_lossy()
        }),
    );

    Ok(())
}

// ── HLS helper functions ───────────────────────────────────────────────────

/// If `text` is a master playlist (contains variant streams), fetch and return
/// the highest-bandwidth variant's URL and its playlist text.
/// Otherwise returns the input URL + text unchanged.
async fn resolve_media_playlist(
    client: &Client,
    original_url: &str,
    text: &str,
    headers: &HeaderMap,
) -> Result<(String, String), String> {
    if !text.contains("#EXT-X-STREAM-INF") {
        return Ok((original_url.to_string(), text.to_string()));
    }

    // Parse master playlist: find highest BANDWIDTH variant.
    let base = original_url.rsplit_once('/').map(|(b, _)| b).unwrap_or(original_url);
    let mut best_bandwidth = 0u64;
    let mut best_url = String::new();

    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();
        if line.starts_with("#EXT-X-STREAM-INF") {
            let bandwidth = line
                .split(',')
                .find_map(|part| {
                    let p = part.trim();
                    if p.starts_with("BANDWIDTH=") {
                        p.trim_start_matches("BANDWIDTH=").parse::<u64>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0);

            if i + 1 < lines.len() {
                let variant_line = lines[i + 1].trim();
                if !variant_line.is_empty() && !variant_line.starts_with('#') {
                    if bandwidth >= best_bandwidth {
                        best_bandwidth = bandwidth;
                        best_url = if variant_line.starts_with("http://")
                            || variant_line.starts_with("https://")
                        {
                            variant_line.to_string()
                        } else if variant_line.starts_with('/') {
                            if let Ok(parsed) = url::Url::parse(original_url) {
                                format!(
                                    "{}://{}{}",
                                    parsed.scheme(),
                                    parsed.host_str().unwrap_or_default(),
                                    variant_line
                                )
                            } else {
                                format!("{}/{}", base, variant_line)
                            }
                        } else {
                            format!("{}/{}", base, variant_line)
                        };
                    }
                }
            }
        }
        i += 1;
    }

    if best_url.is_empty() {
        return Ok((original_url.to_string(), text.to_string()));
    }

    let media_text = fetch_text_with_retry(client, &best_url, headers, MAX_SEGMENT_RETRIES)
        .await
        .map_err(|e| format!("Failed to fetch variant playlist: {}", e))?;

    Ok((best_url, media_text))
}

/// Parses segment URLs from an HLS media playlist.
fn parse_segment_urls(playlist: &str, base_url: &str, playlist_url: &str) -> Vec<String> {
    let mut urls = Vec::new();
    for line in playlist.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let full_url = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            trimmed.to_string()
        } else if trimmed.starts_with('/') {
            if let Ok(parsed) = url::Url::parse(playlist_url) {
                format!(
                    "{}://{}{}",
                    parsed.scheme(),
                    parsed.host_str().unwrap_or_default(),
                    trimmed
                )
            } else {
                format!("{}/{}", base_url, trimmed)
            }
        } else {
            format!("{}/{}", base_url, trimmed)
        };
        urls.push(full_url);
    }
    urls
}

// ── Retry helpers ──────────────────────────────────────────────────────────

/// Fetch a URL body as text, with up to `retries` attempts.
async fn fetch_text_with_retry(
    client: &Client,
    url: &str,
    headers: &HeaderMap,
    retries: u32,
) -> Result<String, String> {
    let mut last_err = String::new();
    for attempt in 0..=retries {
        if attempt > 0 {
            tokio::time::sleep(backoff_delay(attempt)).await;
        }
        match client.get(url).headers(headers.clone()).send().await {
            Ok(resp) => {
                match timeout(Duration::from_secs(30), resp.text()).await {
                    Ok(Ok(text)) => return Ok(text),
                    Ok(Err(e)) => last_err = e.to_string(),
                    Err(_) => last_err = "read timeout".to_string(),
                }
            }
            Err(e) => last_err = e.to_string(),
        }
        eprintln!("[Downloader] fetch_text attempt {}/{}: {}", attempt + 1, retries + 1, last_err);
    }
    Err(last_err)
}

/// Fetch a URL body as bytes, with up to `retries` attempts.
async fn fetch_bytes_with_retry(
    client: &Client,
    url: &str,
    headers: &HeaderMap,
    retries: u32,
) -> Result<Vec<u8>, String> {
    let mut last_err = String::new();
    for attempt in 0..=retries {
        if attempt > 0 {
            tokio::time::sleep(backoff_delay(attempt)).await;
        }
        match client.get(url).headers(headers.clone()).send().await {
            Ok(resp) => {
                match timeout(Duration::from_secs(CHUNK_READ_TIMEOUT_SECS * 4), resp.bytes()).await {
                    Ok(Ok(b)) => return Ok(b.to_vec()),
                    Ok(Err(e)) => last_err = e.to_string(),
                    Err(_) => last_err = "segment read timeout".to_string(),
                }
            }
            Err(e) => last_err = e.to_string(),
        }
        eprintln!("[Downloader] fetch_bytes attempt {}/{}: {}", attempt + 1, retries + 1, last_err);
    }
    Err(last_err)
}

/// Returns an exponential backoff delay capped at 30 seconds.
fn backoff_delay(attempt: u32) -> Duration {
    let base_ms = 500u64;
    let cap_ms = 30_000u64;
    let ms = (base_ms * (1u64 << attempt.min(6))).min(cap_ms);
    Duration::from_millis(ms)
}

/// Builds a `HeaderMap` from an optional custom-headers map.
fn build_headers(custom: Option<&HashMap<String, String>>) -> HeaderMap {
    let mut map = HeaderMap::new();
    if let Some(h) = custom {
        for (k, v) in h {
            if let (Ok(hk), Ok(hv)) =
                (HeaderName::from_bytes(k.as_bytes()), HeaderValue::from_str(v))
            {
                map.insert(hk, hv);
            }
        }
    }
    map
}

// ── File path helpers ──────────────────────────────────────────────────────

fn determine_target_filepath(base_dir: &Path, req: &DownloadRequest) -> PathBuf {
    let clean_title = sanitize_filename(&req.media_title);
    let is_series = req.tv_type.eq_ignore_ascii_case("TvSeries")
        || req.tv_type.eq_ignore_ascii_case("Anime")
        || req.tv_type.eq_ignore_ascii_case("AsianDrama")
        || req.season_num.is_some()
        || req.episode_num.is_some();

    let ext = if req.url.contains(".mkv") {
        "mkv"
    } else if req.url.contains(".webm") {
        "webm"
    } else {
        "mp4"
    };

    if is_series {
        let season = req.season_num.unwrap_or(1);
        let ep = req.episode_num.unwrap_or(1);
        let ep_title = req
            .episode_title
            .as_deref()
            .map(sanitize_filename)
            .unwrap_or_else(|| format!("Episode {}", ep));
        let filename = format!(
            "{} - S{:02}E{:02} - {}.{}",
            clean_title, season, ep, ep_title, ext
        );
        base_dir
            .join("Series")
            .join(&clean_title)
            .join(format!("Season {}", season))
            .join(filename)
    } else {
        let filename = format!("{}.{}", clean_title, ext);
        base_dir.join("Movies").join(&clean_title).join(filename)
    }
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

// ── Disk space ────────────────────────────────────────────────────────────

#[cfg(windows)]
fn get_disk_space(path: &Path) -> Option<(u64, u64)> {
    use std::os::windows::ffi::OsStrExt;
    let wide_path: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut free_bytes_available: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut total_free_bytes: u64 = 0;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    unsafe {
        if GetDiskFreeSpaceExW(
            wide_path.as_ptr(),
            &mut free_bytes_available,
            &mut total_bytes,
            &mut total_free_bytes,
        ) != 0
        {
            Some((free_bytes_available, total_bytes))
        } else {
            None
        }
    }
}

#[cfg(not(windows))]
fn get_disk_space(_path: &Path) -> Option<(u64, u64)> {
    None
}
