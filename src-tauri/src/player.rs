use libmpv2::{
    events::{mpv_event_id, Event, PropertyData},
    mpv_end_file_reason, Format, Mpv,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tauri::{AppHandle, Emitter};

#[cfg(windows)]
use winapi::shared::{
    minwindef::{DWORD, UINT},
    windef::{HMONITOR, HWND},
    winerror::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS},
};
#[cfg(windows)]
use winapi::um::{
    wingdi::{
        DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_HEADER,
        DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME,
        QDC_ONLY_ACTIVE_PATHS,
    },
    winnt::LONG,
    winuser::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST,
    },
};

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn GetDisplayConfigBufferSizes(
        flags: UINT,
        num_path_array_elements: *mut UINT,
        num_mode_info_array_elements: *mut UINT,
    ) -> LONG;
    fn QueryDisplayConfig(
        flags: UINT,
        num_path_array_elements: *mut UINT,
        path_array: *mut DISPLAYCONFIG_PATH_INFO,
        num_mode_info_array_elements: *mut UINT,
        mode_info_array: *mut DISPLAYCONFIG_MODE_INFO,
        current_topology_id: *mut u32,
    ) -> LONG;
    fn DisplayConfigGetDeviceInfo(request_packet: *mut DISPLAYCONFIG_DEVICE_INFO_HEADER) -> LONG;
}

#[cfg(windows)]
const DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2: u32 = 15;
#[cfg(windows)]
const DISPLAYCONFIG_ADVANCED_COLOR_MODE_HDR: u32 = 2;

#[cfg(windows)]
#[repr(C)]
struct DisplayconfigGetAdvancedColorInfo2 {
    header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
    value: u32,
    color_encoding: u32,
    bits_per_color_channel: u32,
    active_color_mode: u32,
}

#[derive(Clone, Copy, Eq, PartialEq, Debug)]
pub enum DisplayOutputMode {
    Hdr,
    Sdr,
    Auto,
}

#[derive(Clone, Copy, Eq, PartialEq, Debug)]
struct DisplayOutputState {
    mode: DisplayOutputMode,
    scale_percent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerDiagnostics {
    pub codec: Option<String>,
    pub codec_profile: Option<String>,
    pub pixel_format: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub fps: Option<f64>,
    pub hwdec_configured: Option<String>,
    pub hwdec_current: Option<String>,
    pub video_output: Option<String>,
    pub mpv_version: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub uma_detected: bool,
    pub gpu_video_processing_supported: bool,
    pub gpu_video_processing_enabled: bool,
    pub display_hdr_active: bool,
    pub recent_logs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerErrorPayload {
    pub message: String,
    pub reason: String,
    pub diagnostics: PlayerDiagnostics,
}

#[derive(Debug, Default)]
struct VideoReadyState {
    next_load_id: u64,
    current_load_id: Option<u64>,
    pending_load_ids: VecDeque<u64>,
    active_load_id: Option<u64>,
    file_loaded_id: Option<u64>,
    ready_sent_id: Option<u64>,
}

impl VideoReadyState {
    fn begin_transition(&mut self, loads_file: bool) -> u64 {
        self.next_load_id += 1;
        self.current_load_id = Some(self.next_load_id);
        self.file_loaded_id = None;
        self.ready_sent_id = None;
        if loads_file {
            self.pending_load_ids.push_back(self.next_load_id);
        }
        self.next_load_id
    }

    fn start_file(&mut self) {
        self.active_load_id = self.pending_load_ids.pop_front();
        self.file_loaded_id = None;
    }

    fn file_loaded(&mut self) {
        if self.active_load_id == self.current_load_id {
            self.file_loaded_id = self.active_load_id;
        }
    }

    fn playback_restarted(&mut self) -> Option<u64> {
        let load_id = self.current_load_id?;
        if self.file_loaded_id != Some(load_id) || self.ready_sent_id == Some(load_id) {
            return None;
        }
        self.ready_sent_id = Some(load_id);
        Some(load_id)
    }
}

pub struct MpvPlayer {
    mpv: Arc<Mutex<Option<Mpv>>>,
    recent_logs: Arc<Mutex<VecDeque<String>>>,
    is_playing: Arc<AtomicBool>,
    video_ready_state: Arc<Mutex<VideoReadyState>>,
    gpu_video_processing: Arc<AtomicBool>,
    is_hdr_active_flag: Arc<AtomicBool>,
    hwnd: i64,
    app_handle: AppHandle,
}

impl MpvPlayer {
    pub fn new(hwnd: i64, app_handle: AppHandle) -> Result<Self, String> {
        println!("[Player] Initializing MPV with HWND: {:x} ({})", hwnd, hwnd);
        let mpv = Mpv::with_initializer(|init| {
            if hwnd != 0 {
                match init.set_property("wid", hwnd) {
                    Ok(_) => println!("[Player] Successfully set MPV 'wid' to {}", hwnd),
                    Err(e) => eprintln!("[Player] FAILED to set MPV 'wid' to {}: {:?}", hwnd, e),
                }
            } else {
                eprintln!("[Player] WARNING: HWND is 0! MPV will not be attached to window!");
            }
            let _ = init.set_property("title", "CloudStream Desktop");
            let _ = init.set_property("audio-client-name", "CloudStream");
            let _ = init.set_property("terminal", "yes");
            let _ = init.set_property("idle", "yes");
            let _ = init.set_property("force-window", "yes");
            let _ = init.set_property("background-color", "#000000");
            let _ = init.set_property("alpha", "no");
            let _ = init.set_property("keepaspect", "yes");
            let _ = init.set_property("vo", "gpu-next,gpu,");
            let _ = init.set_property("gpu-context", "d3d11");
            let _ = init.set_property("d3d11-output-format", "auto");
            let _ = init.set_property("d3d11-output-csp", "auto");
            let _ = init.set_property("target-colorspace-hint", "auto");
            let _ = init.set_property("target-colorspace-hint-mode", "target");
            let _ = init.set_property("tone-mapping", "bt.2390");
            let _ = init.set_property("dither-depth", "auto");

            // Smart GPU architecture detection (from stremio-shell-ng):
            // If UMA (integrated GPU / APU) is detected, setting heavy spline36 + deband shaders
            // overloads the GPU render pass, causing dropped frames and A/V desync.
            // On UMA we use profile=fast; on dedicated GPUs we enable high-quality scalers.
            let is_uma = crate::gpu_video_processing::unified_memory_architecture();
            if is_uma {
                println!("[Player] Unified Memory Architecture (iGPU/APU) detected -> Applying 'profile=fast' to prevent A/V desync.");
                let _ = init.set_property("profile", "fast");
            } else {
                println!("[Player] Dedicated GPU detected -> Applying high-quality scaling (spline36 + deband).");
                let _ = init.set_property("deband", "yes");
                let _ = init.set_property("scale", "spline36");
                let _ = init.set_property("cscale", "spline36");
            }

            // Hardware decoding: defaults to auto
            let _ = init.set_property("hwdec", "auto");

            // Robust stream reconnection (from stremio-shell-ng)
            let _ = init.set_property(
                "stream-lavf-o",
                "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_on_http_error=%23%408,429,500,502,503,504,reconnect_delay_max=15",
            );

            // A/V Sync and frame drop prevention:
            // framedrop=vo drops late frames to prevent video falling behind audio.
            // video-sync=audio ensures audio clock is master.
            // hr-seek-framedrop prevents audio timestamp reset freezes during seeks.
            let _ = init.set_property("framedrop", "vo");
            let _ = init.set_property("video-sync", "audio");
            let _ = init.set_property("audio-pitch-correction", "yes");
            let _ = init.set_property("hr-seek", "default");
            let _ = init.set_property("hr-seek-framedrop", "yes");

            // Demuxer caching & streaming buffer optimizations:
            let _ = init.set_property("cache", "yes");
            let _ = init.set_property("demuxer-max-bytes", "150MiB");
            let _ = init.set_property("demuxer-max-back-bytes", "50MiB");
            let _ = init.set_property("demuxer-readahead-secs", "30");
            let _ = init.set_property("demuxer-hysteresis-secs", "3");
            let _ = init.set_property("stream-buffer-size", "512KiB");

            let _ = init.set_property("quiet", "yes");

            #[cfg(debug_assertions)]
            let _ = init.set_property("msg-level", "all=no,cplayer=debug");
            #[cfg(not(debug_assertions))]
            let _ = init.set_property("msg-level", "all=no");

            Ok(())
        })
        .map_err(|e| format!("Failed to initialize MPV: {:?}", e))?;

        let mpv_client = mpv
            .create_client(None)
            .map_err(|e| format!("Failed to create MPV event client: {:?}", e))?;

        let _ = mpv_client.disable_deprecated_events();
        let _ = mpv_client.enable_event(mpv_event_id::LogMessage);

        let recent_logs = Arc::new(Mutex::new(VecDeque::with_capacity(100)));
        let is_playing = Arc::new(AtomicBool::new(false));
        let video_ready_state = Arc::new(Mutex::new(VideoReadyState::default()));
        let gpu_video_processing = Arc::new(AtomicBool::new(false));
        let is_hdr_active_flag = Arc::new(AtomicBool::new(false));

        let recent_logs_thread = Arc::clone(&recent_logs);
        let is_playing_thread = Arc::clone(&is_playing);
        let video_ready_state_thread = Arc::clone(&video_ready_state);

        let mpv_shared = Arc::new(Mutex::new(Some(mpv)));
        let mpv_diag_ref = Arc::clone(&mpv_shared);
        let app_handle_thread = app_handle.clone();

        // Background display monitoring thread (from stremio-shell-ng):
        // Detects HDR / SDR active state on the display hosting the player window and adapts color space.
        #[cfg(windows)]
        if hwnd != 0 {
            let mpv_display = Arc::clone(&mpv_shared);
            let gpu_vp_display = Arc::clone(&gpu_video_processing);
            let is_hdr_display = Arc::clone(&is_hdr_active_flag);
            thread::spawn(move || {
                let mut last_state = None;
                loop {
                    thread::sleep(std::time::Duration::from_millis(500));
                    let Ok(guard) = mpv_display.lock() else { break; };
                    let Some(ref mpv) = *guard else { continue; };
                    let state = current_display_output_state(mpv, hwnd as HWND);
                    let gpu = gpu_vp_display.load(Ordering::Relaxed);
                    let is_hdr = state.mode == DisplayOutputMode::Hdr;
                    is_hdr_display.store(is_hdr, Ordering::Relaxed);
                    if last_state != Some((state, gpu)) {
                        apply_display_output_mode(mpv, state, gpu);
                        last_state = Some((state, gpu));
                    }
                }
            });
        }

        let is_hdr_for_events = Arc::clone(&is_hdr_active_flag);
        let gpu_vp_for_events = Arc::clone(&gpu_video_processing);

        thread::spawn(move || {
            let app_handle = app_handle_thread;
            let _ = mpv_client.observe_property("time-pos", Format::Double, 0);
            let _ = mpv_client.observe_property("duration", Format::Double, 0);
            let _ = mpv_client.observe_property("pause", Format::Flag, 0);
            let _ = mpv_client.observe_property("paused-for-cache", Format::Flag, 0);
            let _ = mpv_client.observe_property("cache-buffering-state", Format::Double, 0);
            let _ = mpv_client.observe_property("eof-reached", Format::Flag, 0);
            let _ = mpv_client.observe_property("hwdec-current", Format::String, 0);
            let _ = mpv_client.observe_property("video-params", Format::String, 0);
            let _ = mpv_client.observe_property("track-list", Format::String, 0);
            let _ = mpv_client.observe_property("aid", Format::Int64, 0);
            let _ = mpv_client.observe_property("sid", Format::Int64, 0);
            let _ = mpv_client.observe_property("speed", Format::Double, 0);
            let _ = mpv_client.observe_property("demuxer-cache-time", Format::Double, 0);
            let _ = mpv_client.observe_property("sub-delay", Format::Double, 0);
            let _ = mpv_client.observe_property("panscan", Format::Double, 0);

            loop {
                let event = match mpv_client.wait_event(0.05) {
                    Some(Ok(ev)) => ev,
                    Some(Err(err)) => {
                        eprintln!("[MPV Event Error] {:?}", err);
                        continue;
                    }
                    None => continue,
                };

                match event {
                    Event::LogMessage {
                        prefix,
                        level,
                        text,
                        ..
                    } => {
                        let line = format!("[{}] {}: {}", level, prefix, text.trim_end());
                        let mut logs = recent_logs_thread.lock().unwrap();
                        if logs.len() >= 100 {
                            logs.pop_front();
                        }
                        logs.push_back(line);
                    }
                    Event::PropertyChange { name, change, .. } => match name {
                        "time-pos" => {
                            if let PropertyData::Double(d) = change {
                                let _ = app_handle.emit("player://time-pos", d);
                            }
                        }
                        "duration" => {
                            if let PropertyData::Double(d) = change {
                                println!("[MPV] Duration detected: {:.2}s", d);
                                let _ = app_handle.emit("player://duration", d);
                            }
                        }
                        "pause" => {
                            if let PropertyData::Flag(paused) = change {
                                is_playing_thread.store(!paused, Ordering::Relaxed);
                                let _ = app_handle.emit("player://paused", paused);
                            }
                        }
                        "paused-for-cache" => {
                            if let PropertyData::Flag(buffering) = change {
                                let _ = app_handle.emit("player://paused-for-cache", buffering);
                            }
                        }
                        "cache-buffering-state" => {
                            if let PropertyData::Double(pct) = change {
                                let _ = app_handle.emit("player://buffering-percent", pct);
                            }
                        }
                        "hwdec-current" => {
                            let hw = match change {
                                PropertyData::Str(s) => Some(s.to_string()),
                                PropertyData::OsdStr(s) => Some(s.to_string()),
                                _ => None,
                            };
                            if let Some(h) = hw {
                                println!("[MPV] Active Hardware Decoder: {}", h);
                                let _ = app_handle.emit("player://hwdec", h);
                            }
                        }
                        "video-params" => {
                            let vp = match change {
                                PropertyData::Str(s) => Some(s.to_string()),
                                PropertyData::OsdStr(s) => Some(s.to_string()),
                                _ => None,
                            };
                            if let Some(v) = vp {
                                let _ = app_handle.emit("player://video-params", v);
                            }
                        }
                        "track-list" => {
                            let list_str = match change {
                                PropertyData::Str(s) => Some(s.to_string()),
                                PropertyData::OsdStr(s) => Some(s.to_string()),
                                _ => None,
                            };
                            if let Some(s) = list_str {
                                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                                    let _ = app_handle.emit("player://track-list", val);
                                }
                            }
                        }
                        "aid" => {
                            if let PropertyData::Int64(id) = change {
                                let _ = app_handle.emit("player://aid", id);
                            }
                        }
                        "sid" => {
                            if let PropertyData::Int64(id) = change {
                                let _ = app_handle.emit("player://sid", id);
                            }
                        }
                        "speed" => {
                            if let PropertyData::Double(s) = change {
                                let _ = app_handle.emit("player://speed", s);
                            }
                        }
                        "demuxer-cache-time" => {
                            if let PropertyData::Double(c) = change {
                                let _ = app_handle.emit("player://cache-time", c);
                            }
                        }
                        "sub-delay" => {
                            if let PropertyData::Double(d) = change {
                                let _ = app_handle.emit("player://sub-delay", d);
                            }
                        }
                        "panscan" => {
                            if let PropertyData::Double(p) = change {
                                let _ = app_handle.emit("player://panscan", p);
                            }
                        }
                        _ => {}
                    },
                    Event::StartFile => {
                        println!("[MPV Event] StartFile");
                        video_ready_state_thread.lock().unwrap().start_file();
                        let _ = app_handle.emit("player://start-file", ());
                        let _ = app_handle.emit(
                            "player://video-ready",
                            serde_json::json!({ "ready": false }),
                        );
                    }
                    Event::FileLoaded => {
                        println!("[MPV Event] FileLoaded");
                        video_ready_state_thread.lock().unwrap().file_loaded();
                        let _ = app_handle.emit("player://file-loaded", ());
                        if let Ok(guard) = mpv_diag_ref.lock() {
                            if let Some(ref mpv) = *guard {
                                if let Ok(s) = mpv.get_property::<String>("track-list") {
                                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&s) {
                                        let _ = app_handle.emit("player://track-list", val);
                                    }
                                }
                            }
                        }
                    }
                    Event::PlaybackRestart => {
                        println!("[MPV Event] PlaybackRestart");
                        let load_id = video_ready_state_thread
                            .lock()
                            .unwrap()
                            .playback_restarted();
                        if let Some(load_id) = load_id {
                            let app = app_handle.clone();
                            // Allow Direct3D 11 swapchain to present the first frame before declaring ready
                            thread::spawn(move || {
                                thread::sleep(std::time::Duration::from_millis(120));
                                let _ = app.emit(
                                    "player://video-ready",
                                    serde_json::json!({ "load_id": load_id, "ready": true }),
                                );
                            });
                        }
                        let _ = app_handle.emit("player://playback-restart", ());
                    }
                    Event::EndFile(reason) => {
                        println!("[MPV Event] EndFile with reason: {:?}", reason);
                        if reason == mpv_end_file_reason::Eof {
                            is_playing_thread.store(false, Ordering::Relaxed);
                            let _ = app_handle.emit(
                                "player://ended",
                                serde_json::json!({ "reason": "eof" }),
                            );
                        } else if reason == mpv_end_file_reason::Error {
                            let diag = Self::collect_diagnostics(
                                &mpv_diag_ref,
                                &recent_logs_thread,
                                gpu_vp_for_events.load(Ordering::Relaxed),
                                is_hdr_for_events.load(Ordering::Relaxed),
                            );
                            eprintln!("[MPV Error Event] Playback failed! Collected Diagnostics: {:?}", diag);
                            let payload = PlayerErrorPayload {
                                message: "Native MPV playback encountered an unrecoverable decoding/network error.".to_string(),
                                reason: format!("MPV EndFile reason: {:?}", reason),
                                diagnostics: diag,
                            };
                            let _ = app_handle.emit("player://error", payload);
                        }
                    }
                    Event::Shutdown => {
                        println!("[MPV Event] Shutdown");
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(Self {
            mpv: mpv_shared,
            recent_logs,
            is_playing,
            video_ready_state,
            gpu_video_processing,
            is_hdr_active_flag,
            hwnd,
            app_handle,
        })
    }

    fn collect_diagnostics(
        mpv_shared: &Arc<Mutex<Option<Mpv>>>,
        recent_logs: &Arc<Mutex<VecDeque<String>>>,
        gpu_video_processing_enabled: bool,
        display_hdr_active: bool,
    ) -> PlayerDiagnostics {
        let guard = mpv_shared.lock().unwrap();
        let logs: Vec<String> = recent_logs.lock().unwrap().iter().cloned().collect();

        let uma_detected = crate::gpu_video_processing::unified_memory_architecture();
        let gpu_video_processing_supported =
            crate::gpu_video_processing::gpu_video_processing_supported();

        let Some(ref mpv) = *guard else {
            return PlayerDiagnostics {
                recent_logs: logs,
                uma_detected,
                gpu_video_processing_supported,
                gpu_video_processing_enabled,
                display_hdr_active,
                ..Default::default()
            };
        };

        let codec = mpv.get_property::<String>("video-codec").ok();
        let codec_profile = mpv.get_property::<String>("video-format").ok();
        let pixel_format = mpv.get_property::<String>("video-format").ok();
        let width = mpv.get_property::<i64>("width").ok();
        let height = mpv.get_property::<i64>("height").ok();
        let fps = mpv.get_property::<f64>("container-fps").ok();
        let hwdec_configured = mpv.get_property::<String>("hwdec").ok();
        let hwdec_current = mpv.get_property::<String>("hwdec-current").ok();
        let video_output = mpv.get_property::<String>("vo").ok();
        let mpv_version = mpv.get_property::<String>("mpv-version").ok();
        let ffmpeg_version = mpv.get_property::<String>("ffmpeg-version").ok();

        PlayerDiagnostics {
            codec,
            codec_profile,
            pixel_format,
            width,
            height,
            fps,
            hwdec_configured,
            hwdec_current,
            video_output,
            mpv_version,
            ffmpeg_version,
            uma_detected,
            gpu_video_processing_supported,
            gpu_video_processing_enabled,
            display_hdr_active,
            recent_logs: logs,
        }
    }

    pub fn load(
        &self,
        url: &str,
        title: Option<&str>,
        headers: Option<HashMap<String, String>>,
        start_time: Option<f64>,
    ) -> Result<(), String> {
        println!("[Player] load called with URL: '{}', title: '{:?}', start_time: '{:?}'", url, title, start_time);
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;

        if let Some(st) = start_time {
            if st > 2.0 {
                println!("[Player] Setting start time to: {:.2}s", st);
                let _ = mpv.set_property("start", format!("{:.2}", st).as_str());
            } else {
                let _ = mpv.set_property("start", "none");
            }
        } else {
            let _ = mpv.set_property("start", "none");
        }

        if let Some(ref h_map) = headers {
            if let Some(ua) = h_map.get("User-Agent").or_else(|| h_map.get("user-agent")) {
                let _ = mpv.set_property("user-agent", ua.as_str());
            }
            if let Some(ref_hdr) = h_map.get("Referer").or_else(|| h_map.get("referer")) {
                let _ = mpv.set_property("referrer", ref_hdr.as_str());
            }
            let fields: Vec<String> = h_map
                .iter()
                .filter(|(k, _)| !k.eq_ignore_ascii_case("user-agent") && !k.eq_ignore_ascii_case("referer"))
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect();
            if !fields.is_empty() {
                let fields_str = fields.join(",");
                let _ = mpv.set_property("http-header-fields", fields_str.as_str());
            }
        }

        if let Some(t) = title {
            let _ = mpv.set_property("title", t);
        }

        let load_id = self.video_ready_state.lock().unwrap().begin_transition(true);
        let _ = self.app_handle.emit(
            "player://video-ready",
            serde_json::json!({ "load_id": load_id, "ready": false }),
        );
        let cmd_res = mpv.command("loadfile", &[url, "replace"]);
        println!("[Player] mpv.command('loadfile') result: {:?}", cmd_res);
        cmd_res.map_err(|e| format!("Failed to load file in MPV: {:?}", e))?;

        self.is_playing.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn play(&self) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        mpv.set_property("pause", false)
            .map_err(|e| format!("Failed to play: {:?}", e))?;
        self.is_playing.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn pause(&self) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        mpv.set_property("pause", true)
            .map_err(|e| format!("Failed to pause: {:?}", e))?;
        self.is_playing.store(false, Ordering::Relaxed);
        Ok(())
    }

    pub fn seek(&self, position: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let pos_str = position.to_string();
        mpv.command("seek", &[&pos_str, "absolute"])
            .map_err(|e| format!("Failed to seek: {:?}", e))
    }

    pub fn seek_relative(&self, offset: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let offset_str = offset.to_string();
        mpv.command("seek", &[&offset_str, "relative"])
            .map_err(|e| format!("Failed to seek relative: {:?}", e))
    }

    pub fn set_volume(&self, volume: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let clamped = volume.clamp(0.0, 100.0);
        mpv.set_property("volume", clamped)
            .map_err(|e| format!("Failed to set volume: {:?}", e))
    }

    pub fn set_mute(&self, muted: bool) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        mpv.set_property("mute", muted)
            .map_err(|e| format!("Failed to set mute: {:?}", e))
    }

    pub fn set_audio_track(&self, aid: i64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        if aid == -1 {
            mpv.set_property("aid", "auto")
                .map_err(|e| format!("Failed to set audio track to auto: {:?}", e))
        } else if aid <= 0 {
            mpv.set_property("aid", "no")
                .map_err(|e| format!("Failed to disable audio track: {:?}", e))
        } else {
            mpv.set_property("aid", aid)
                .map_err(|e| format!("Failed to set audio track: {:?}", e))
        }
    }

    pub fn set_subtitle_track(&self, sid: i64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        if sid == -1 {
            mpv.set_property("sid", "auto")
                .map_err(|e| format!("Failed to set subtitle track to auto: {:?}", e))
        } else if sid <= 0 {
            mpv.set_property("sid", "no")
                .map_err(|e| format!("Failed to disable subtitle track: {:?}", e))
        } else {
            mpv.set_property("sid", sid)
                .map_err(|e| format!("Failed to set subtitle track: {:?}", e))
        }
    }

    pub fn set_preferred_languages(&self, slang: Option<&str>, alang: Option<&str>) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        if let Some(s) = slang {
            let _ = mpv.set_property("slang", s);
        }
        if let Some(a) = alang {
            let _ = mpv.set_property("alang", a);
        }
        Ok(())
    }

    pub fn set_subtitle_delay(&self, delay: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        mpv.set_property("sub-delay", delay)
            .map_err(|e| format!("Failed to set subtitle delay: {:?}", e))
    }

    pub fn set_speed(&self, speed: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let clamped = speed.clamp(0.25, 4.0);
        mpv.set_property("speed", clamped)
            .map_err(|e| format!("Failed to set speed: {:?}", e))
    }

    pub fn set_panscan(&self, panscan: f64) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let clamped = panscan.clamp(0.0, 1.0);
        mpv.set_property("panscan", clamped)
            .map_err(|e| format!("Failed to set panscan: {:?}", e))
    }

    pub fn add_subtitle(&self, url_or_path: &str) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        mpv.command("sub-add", &[url_or_path, "select"])
            .map_err(|e| format!("Failed to add subtitle: {:?}", e))
    }

    pub fn get_tracks(&self) -> Result<serde_json::Value, String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let str_val: String = mpv
            .get_property("track-list")
            .map_err(|e| format!("Failed to get track list: {:?}", e))?;
        serde_json::from_str(&str_val)
            .map_err(|e| format!("Failed to parse track list: {:?}", e))
    }

    pub fn set_hwdec(&self, mode: &str) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let hwdec_val = match mode {
            "hardware" => "auto-safe",
            "software" => "no",
            _ => "auto",
        };
        println!("[Player] Setting hwdec to '{}' (requested mode: '{}')", hwdec_val, mode);
        mpv.set_property("hwdec", hwdec_val)
            .map_err(|e| format!("Failed to set hwdec: {:?}", e))
    }

    pub fn set_render_profile(&self, profile: &str) -> Result<(), String> {
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        println!("[Player] Setting render profile: '{}'", profile);
        match profile {
            "fast" => {
                let _ = mpv.set_property("profile", "fast");
                let _ = mpv.set_property("deband", "no");
            }
            "high_quality" => {
                let _ = mpv.set_property("deband", "yes");
                let _ = mpv.set_property("scale", "spline36");
                let _ = mpv.set_property("cscale", "spline36");
            }
            _ => {
                if crate::gpu_video_processing::unified_memory_architecture() {
                    let _ = mpv.set_property("profile", "fast");
                    let _ = mpv.set_property("deband", "no");
                } else {
                    let _ = mpv.set_property("deband", "yes");
                    let _ = mpv.set_property("scale", "spline36");
                    let _ = mpv.set_property("cscale", "spline36");
                }
            }
        }
        Ok(())
    }

    pub fn set_gpu_video_processing(&self, enabled: bool) -> Result<(), String> {
        self.gpu_video_processing.store(enabled, Ordering::Relaxed);
        println!("[Player] GPU video processing (RTX Super Resolution / True HDR) toggled: {}", enabled);
        #[cfg(windows)]
        if self.hwnd != 0 {
            let guard = self.mpv.lock().unwrap();
            if let Some(ref mpv) = *guard {
                let state = current_display_output_state(mpv, self.hwnd as HWND);
                apply_display_output_mode(mpv, state, enabled);
            }
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        println!("[Player] stop called");
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        let load_id = self.video_ready_state.lock().unwrap().begin_transition(false);
        let _ = self.app_handle.emit(
            "player://video-ready",
            serde_json::json!({ "load_id": load_id, "ready": false }),
        );
        let res = mpv.command("stop", &[]);
        println!("[Player] mpv.command('stop') result: {:?}", res);
        self.is_playing.store(false, Ordering::Relaxed);
        Ok(())
    }

    pub fn get_diagnostics(&self) -> PlayerDiagnostics {
        Self::collect_diagnostics(
            &self.mpv,
            &self.recent_logs,
            self.gpu_video_processing.load(Ordering::Relaxed),
            self.is_hdr_active_flag.load(Ordering::Relaxed),
        )
    }
}

// ── Display Output & Color Management Helpers (from stremio-shell-ng) ───────

#[cfg(windows)]
fn current_display_output_state(mpv: &Mpv, window_handle: HWND) -> DisplayOutputState {
    DisplayOutputState {
        mode: current_display_output_mode(window_handle),
        scale_percent: current_video_filter_scale(mpv, window_handle),
    }
}

#[cfg(windows)]
fn current_display_output_mode(window_handle: HWND) -> DisplayOutputMode {
    let monitor = unsafe { MonitorFromWindow(window_handle, MONITOR_DEFAULTTONEAREST) };
    match monitor_hdr_active(monitor) {
        Some(true) => DisplayOutputMode::Hdr,
        Some(false) => DisplayOutputMode::Sdr,
        None => DisplayOutputMode::Auto,
    }
}

#[cfg(windows)]
fn current_video_filter_scale(mpv: &Mpv, window_handle: HWND) -> u32 {
    let Some(video_height) = current_video_height(mpv) else {
        return 100;
    };
    let Some(display_height) = current_monitor_height(window_handle) else {
        return 100;
    };
    if video_height <= 0.0 || display_height <= video_height {
        return 100;
    }

    ((display_height / video_height).min(4.0) * 100.0).round() as u32
}

fn current_video_height(mpv: &Mpv) -> Option<f64> {
    let video_params = mpv.get_property::<String>("video-params").ok()?;
    let video_params = serde_json::from_str::<serde_json::Value>(&video_params).ok()?;
    video_params.get("h").and_then(serde_json::Value::as_f64)
}

#[cfg(windows)]
fn current_monitor_height(window_handle: HWND) -> Option<f64> {
    let monitor = unsafe { MonitorFromWindow(window_handle, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return None;
    }

    let mut monitor_info: MONITORINFO = unsafe { std::mem::zeroed() };
    monitor_info.cbSize = std::mem::size_of::<MONITORINFO>() as DWORD;
    if unsafe { GetMonitorInfoW(monitor, &mut monitor_info) } == 0 {
        return None;
    }

    Some((monitor_info.rcMonitor.bottom - monitor_info.rcMonitor.top) as f64)
}

fn apply_display_output_mode(mpv: &Mpv, state: DisplayOutputState, gpu_video_processing: bool) {
    let vf = if gpu_video_processing {
        let scale = state.scale_percent as f64 / 100.0;
        let mut vf = format!("d3d11vpp=scaling-mode=nvidia:scale={scale:.2}");
        if state.mode == DisplayOutputMode::Hdr {
            vf.push_str(":format=x2bgr10:nvidia-true-hdr");
        }
        vf
    } else {
        String::new()
    };
    let color = match state.mode {
        DisplayOutputMode::Hdr | DisplayOutputMode::Auto => [
            ("d3d11-output-csp", "auto"),
            ("target-colorspace-hint", "auto"),
            ("target-trc", "auto"),
            ("target-prim", "auto"),
        ],
        DisplayOutputMode::Sdr => [
            ("d3d11-output-csp", "srgb"),
            ("target-colorspace-hint", "yes"),
            ("target-trc", "srgb"),
            ("target-prim", "bt.709"),
        ],
    };

    for (name, value) in std::iter::once(("vf", vf.as_str())).chain(color) {
        if let Err(error) = mpv.set_property(name, value) {
            eprintln!("mpv: cannot set {name}={value}: {error:?}");
        }
    }
}

#[cfg(windows)]
fn monitor_hdr_active(monitor: HMONITOR) -> Option<bool> {
    if monitor.is_null() {
        return None;
    }

    let device_name = monitor_device_name(monitor)?;
    for path in active_display_paths()? {
        let Some(source_name) = display_source_name(&path) else {
            continue;
        };
        if source_name.viewGdiDeviceName != device_name {
            continue;
        }

        return display_hdr_active(&path);
    }

    None
}

#[cfg(windows)]
fn monitor_device_name(monitor: HMONITOR) -> Option<[u16; 32]> {
    let mut monitor_info: MONITORINFOEXW = unsafe { std::mem::zeroed() };
    monitor_info.cbSize = std::mem::size_of::<MONITORINFOEXW>() as DWORD;

    let result =
        unsafe { GetMonitorInfoW(monitor, &mut monitor_info as *mut _ as *mut MONITORINFO) };
    if result == 0 {
        None
    } else {
        Some(monitor_info.szDevice)
    }
}

#[cfg(windows)]
fn active_display_paths() -> Option<Vec<DISPLAYCONFIG_PATH_INFO>> {
    for _ in 0..3 {
        let mut path_count = 0;
        let mut mode_count = 0;
        let buffer_status = unsafe {
            GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
        };
        if buffer_status != ERROR_SUCCESS as LONG {
            return None;
        }

        let mut paths =
            vec![unsafe { std::mem::zeroed::<DISPLAYCONFIG_PATH_INFO>() }; path_count as usize];
        let mut modes =
            vec![unsafe { std::mem::zeroed::<DISPLAYCONFIG_MODE_INFO>() }; mode_count as usize];
        let query_status = unsafe {
            QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                std::ptr::null_mut(),
            )
        };

        if query_status == ERROR_SUCCESS as LONG {
            paths.truncate(path_count as usize);
            return Some(paths);
        }
        if query_status != ERROR_INSUFFICIENT_BUFFER as LONG {
            return None;
        }
    }

    None
}

#[cfg(windows)]
fn display_source_name(path: &DISPLAYCONFIG_PATH_INFO) -> Option<DISPLAYCONFIG_SOURCE_DEVICE_NAME> {
    let mut source_name: DISPLAYCONFIG_SOURCE_DEVICE_NAME = unsafe { std::mem::zeroed() };
    source_name.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
        _type: DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
        size: std::mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32,
        adapterId: path.sourceInfo.adapterId,
        id: path.sourceInfo.id,
    };

    let status = unsafe { DisplayConfigGetDeviceInfo(&mut source_name.header) };
    if status == ERROR_SUCCESS as LONG {
        Some(source_name)
    } else {
        None
    }
}

#[cfg(windows)]
fn display_hdr_active(path: &DISPLAYCONFIG_PATH_INFO) -> Option<bool> {
    let mut color_info: DisplayconfigGetAdvancedColorInfo2 = unsafe { std::mem::zeroed() };
    color_info.header = DISPLAYCONFIG_DEVICE_INFO_HEADER {
        _type: DISPLAYCONFIG_DEVICE_INFO_GET_ADVANCED_COLOR_INFO_2,
        size: std::mem::size_of::<DisplayconfigGetAdvancedColorInfo2>() as u32,
        adapterId: path.targetInfo.adapterId,
        id: path.targetInfo.id,
    };

    let status = unsafe { DisplayConfigGetDeviceInfo(&mut color_info.header) };
    if status == ERROR_SUCCESS as LONG {
        Some(color_info.active_color_mode == DISPLAYCONFIG_ADVANCED_COLOR_MODE_HDR)
    } else {
        None
    }
}