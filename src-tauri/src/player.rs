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
            let _ = init.set_property("keepaspect", "yes");
            let _ = init.set_property("vo", "gpu-next,gpu,");
            let _ = init.set_property("gpu-context", "d3d11");
            let _ = init.set_property("d3d11-output-format", "auto");
            let _ = init.set_property("d3d11-output-csp", "auto");
            let _ = init.set_property("target-colorspace-hint", "auto");
            let _ = init.set_property("target-colorspace-hint-mode", "target");
            let _ = init.set_property("tone-mapping", "bt.2390");
            let _ = init.set_property("dither-depth", "auto");
            let _ = init.set_property("deband", "yes");
            let _ = init.set_property("scale", "spline36");
            let _ = init.set_property("cscale", "spline36");
            let _ = init.set_property("hwdec", "auto");
            let _ = init.set_property(
                "stream-lavf-o",
                "reconnect=1,reconnect_streamed=1,reconnect_on_network_error=1,reconnect_on_http_error=%23%408,429,500,502,503,504,reconnect_delay_max=15",
            );
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

        let recent_logs_thread = Arc::clone(&recent_logs);
        let is_playing_thread = Arc::clone(&is_playing);
        let video_ready_state_thread = Arc::clone(&video_ready_state);

        let mpv_shared = Arc::new(Mutex::new(Some(mpv)));
        let mpv_diag_ref = Arc::clone(&mpv_shared);

        thread::spawn(move || {
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
                        if let Some(id) = load_id {
                            println!("[MPV Event] PlaybackRestart ready confirmation for load_id: {}", id);
                            let _ = app_handle.emit(
                                "player://video-ready",
                                serde_json::json!({ "load_id": id, "ready": true }),
                            );
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
                            let diag = Self::collect_diagnostics(&mpv_diag_ref, &recent_logs_thread);
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
        })
    }

    fn collect_diagnostics(
        mpv_shared: &Arc<Mutex<Option<Mpv>>>,
        recent_logs: &Arc<Mutex<VecDeque<String>>>,
    ) -> PlayerDiagnostics {
        let guard = mpv_shared.lock().unwrap();
        let logs: Vec<String> = recent_logs.lock().unwrap().iter().cloned().collect();

        let Some(ref mpv) = *guard else {
            return PlayerDiagnostics {
                recent_logs: logs,
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
            recent_logs: logs,
        }
    }

    pub fn load(
        &self,
        url: &str,
        title: Option<&str>,
        headers: Option<HashMap<String, String>>,
    ) -> Result<(), String> {
        println!("[Player] load called with URL: '{}', title: '{:?}'", url, title);
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;

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

        self.video_ready_state.lock().unwrap().begin_transition(true);
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
        if aid <= 0 {
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
        if sid <= 0 {
            mpv.set_property("sid", "no")
                .map_err(|e| format!("Failed to disable subtitle track: {:?}", e))
        } else {
            mpv.set_property("sid", sid)
                .map_err(|e| format!("Failed to set subtitle track: {:?}", e))
        }
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

    pub fn stop(&self) -> Result<(), String> {
        println!("[Player] stop called");
        let guard = self.mpv.lock().unwrap();
        let mpv = guard.as_ref().ok_or("MPV not initialized")?;
        self.video_ready_state.lock().unwrap().begin_transition(false);
        let res = mpv.command("stop", &[]);
        println!("[Player] mpv.command('stop') result: {:?}", res);
        self.is_playing.store(false, Ordering::Relaxed);
        Ok(())
    }

    pub fn get_diagnostics(&self) -> PlayerDiagnostics {
        Self::collect_diagnostics(&self.mpv, &self.recent_logs)
    }
}