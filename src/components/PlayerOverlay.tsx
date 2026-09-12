import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Episode, ExtractorLink, MpvTrack, SearchResponse, SkipInterval, SubtitleData } from '../types';
import {
  ArrowLeft,
  Check,
  Cpu,
  FastForward,
  Info,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  Sliders,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface PlayerDiagnostics {
  codec?: string;
  codec_profile?: string;
  pixel_format?: string;
  width?: number;
  height?: number;
  fps?: number;
  hwdec_configured?: string;
  hwdec_current?: string;
  video_output?: string;
  mpv_version?: string;
  ffmpeg_version?: string;
  recent_logs?: string[];
}

interface PlayerErrorPayload {
  message: string;
  reason: string;
  diagnostics: PlayerDiagnostics;
}

interface PlayerOverlayProps {
  item: SearchResponse;
  episode: Episode;
  links: ExtractorLink[];
  onClose: () => void;
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({ item, episode, links, onClose }) => {
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedUrlRef = useRef<string | null>(null);

  const [currentLinkIndex, setCurrentLinkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [bufferingPercent, setBufferingPercent] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHud, setShowHud] = useState(true);

  // Popover menus
  const [showServerPicker, setShowServerPicker] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  // Diagnostics & errors
  const [diagnosticsData, setDiagnosticsData] = useState<PlayerDiagnostics | null>(null);
  const [activeHwdec, setActiveHwdec] = useState<string>('auto');
  const [playbackError, setPlaybackError] = useState<PlayerErrorPayload | null>(null);

  // Tracks, speed, aspect ratio, buffering & sync
  const [tracks, setTracks] = useState<MpvTrack[]>([]);
  const [activeAid, setActiveAid] = useState<number>(0);
  const [activeSid, setActiveSid] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [panscanVal, setPanscanVal] = useState<number>(0.0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [subDelay, setSubDelay] = useState<number>(0.0);

  // Online external subtitles
  const [externalSubs, setExternalSubs] = useState<SubtitleData[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState<boolean>(false);

  // AniSkip & watch progress
  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
  const [currentSkip, setCurrentSkip] = useState<SkipInterval | null>(null);

  // Timeline hover tooltip & Center ripple feedback
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const [centerFeedback, setCenterFeedback] = useState<{
    type: 'play' | 'pause' | 'forward' | 'rewind' | 'speed' | 'volume';
    label?: string;
    id: number;
  } | null>(null);

  const activeLink = links[currentLinkIndex] || links[0];

  // ── HUD auto-hide ─────────────────────────────────────────────────────────
  const resetHudTimer = () => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHud(false), 3200);
  };

  useEffect(() => {
    resetHudTimer();
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep HUD alive while popups or menus are open
  useEffect(() => {
    if (showServerPicker || showDiagnostics || showSubMenu || showAudioMenu || playbackError) {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setShowHud(true);
    }
  }, [showServerPicker, showDiagnostics, showSubMenu, showAudioMenu, playbackError]);

  // ── Center ripple feedback trigger ────────────────────────────────────────
  const triggerFeedback = (
    type: 'play' | 'pause' | 'forward' | 'rewind' | 'speed' | 'volume',
    label?: string
  ) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCenterFeedback({ type, label, id: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setCenterFeedback(null);
    }, 600);
  };

  // ── Normalize track list from MPV ──────────────────────────────────────────
  const normalizeTrackList = (raw: unknown): MpvTrack[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((t: any) => ({
      id: Number(t.id),
      type: t.type,
      src_id: t['src-id'] ?? t.src_id,
      title: t.title || undefined,
      lang: t.lang || undefined,
      codec: t.codec || undefined,
      selected: Boolean(t.selected),
      default: Boolean(t.default),
      audio_channels: t['audio-channels'] ?? t.audio_channels,
    }));
  };

  // ── Native MPV Playback Loading ───────────────────────────────────────────
  useEffect(() => {
    if (!activeLink?.url) return;
    if (loadedUrlRef.current === activeLink.url) return;
    loadedUrlRef.current = activeLink.url;

    setPlaybackError(null);
    setIsVideoReady(false);
    setIsBuffering(true);
    setBufferedTime(0);

    const title = `${item.name} · ${episode.name || `Episode ${episode.episode}`}`;
    console.log('[PlayerOverlay] Loading stream in native MPV:', activeLink.url);
    invoke('player_load', {
      url: activeLink.url,
      title,
      headers: activeLink.headers || null,
    }).catch((e: unknown) => {
      console.error('[PlayerOverlay] Failed to load stream in native MPV:', e);
    });
  }, [activeLink?.url]);

  // ── Listen to Native Player Events ────────────────────────────────────────
  useEffect(() => {
    let unlistenTime: (() => void) | undefined;
    let unlistenDur: (() => void) | undefined;
    let unlistenPaused: (() => void) | undefined;
    let unlistenBuffering: (() => void) | undefined;
    let unlistenBufferingPct: (() => void) | undefined;
    let unlistenHwdec: (() => void) | undefined;
    let unlistenTrackList: (() => void) | undefined;
    let unlistenAid: (() => void) | undefined;
    let unlistenSid: (() => void) | undefined;
    let unlistenSpeed: (() => void) | undefined;
    let unlistenCache: (() => void) | undefined;
    let unlistenSubDelay: (() => void) | undefined;
    let unlistenVideoReady: (() => void) | undefined;
    let unlistenFileLoaded: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;
    let unlistenEnded: (() => void) | undefined;

    async function initEvents() {
      unlistenTime = await listen<number>('player://time-pos', (e) => {
        if (typeof e.payload === 'number') {
          setCurrentTime(e.payload);
          if (e.payload > 0) {
            setIsVideoReady(true);
            setIsBuffering(false);
          }
        }
      });

      unlistenDur = await listen<number>('player://duration', (e) => {
        if (typeof e.payload === 'number') {
          setDuration(e.payload);
        }
      });

      unlistenPaused = await listen<boolean>('player://paused', (e) => {
        setIsPlaying(!e.payload);
      });

      unlistenBuffering = await listen<boolean>('player://paused-for-cache', (e) => {
        setIsBuffering(Boolean(e.payload));
      });

      unlistenBufferingPct = await listen<number>('player://buffering-percent', (e) => {
        if (typeof e.payload === 'number') {
          setBufferingPercent(e.payload);
        }
      });

      unlistenHwdec = await listen<string>('player://hwdec', (e) => {
        if (e.payload) {
          setActiveHwdec(e.payload);
        }
      });

      unlistenVideoReady = await listen<{ load_id?: number; ready: boolean }>('player://video-ready', (e) => {
        if (e.payload?.ready) {
          setIsVideoReady(true);
          setIsBuffering(false);
        }
      });

      unlistenTrackList = await listen<unknown>('player://track-list', (e) => {
        const parsed = normalizeTrackList(e.payload);
        if (parsed.length > 0) {
          setTracks(parsed);
          const selAudio = parsed.find((t) => t.type === 'audio' && t.selected);
          if (selAudio) setActiveAid(selAudio.id);
          const selSub = parsed.find((t) => t.type === 'sub' && t.selected);
          if (selSub) setActiveSid(selSub.id);
        }
      });

      unlistenAid = await listen<number>('player://aid', (e) => {
        if (typeof e.payload === 'number') {
          setActiveAid(e.payload);
        }
      });

      unlistenSid = await listen<number>('player://sid', (e) => {
        if (typeof e.payload === 'number') {
          setActiveSid(e.payload);
        }
      });

      unlistenSpeed = await listen<number>('player://speed', (e) => {
        if (typeof e.payload === 'number') {
          setPlaybackSpeed(e.payload);
        }
      });

      unlistenCache = await listen<number>('player://cache-time', (e) => {
        if (typeof e.payload === 'number') {
          setBufferedTime(e.payload);
        }
      });

      unlistenSubDelay = await listen<number>('player://sub-delay', (e) => {
        if (typeof e.payload === 'number') {
          setSubDelay(e.payload);
        }
      });

      unlistenFileLoaded = await listen('player://file-loaded', () => {
        invoke('player_get_tracks')
          .then((res) => {
            const parsed = normalizeTrackList(res);
            if (parsed.length > 0) setTracks(parsed);
          })
          .catch(() => {});
      });

      unlistenError = await listen<PlayerErrorPayload>('player://error', (e) => {
        console.error('[PlayerOverlay] Native playback error received:', e.payload);
        setPlaybackError(e.payload);
        setIsPlaying(false);
        setIsBuffering(false);
      });

      unlistenEnded = await listen('player://ended', () => {
        setIsPlaying(false);
      });

      // Initial track list fetch
      invoke('player_get_tracks')
        .then((res) => {
          const parsed = normalizeTrackList(res);
          if (parsed.length > 0) setTracks(parsed);
        })
        .catch(() => {});
    }

    initEvents();

    return () => {
      if (unlistenTime) unlistenTime();
      if (unlistenDur) unlistenDur();
      if (unlistenPaused) unlistenPaused();
      if (unlistenBuffering) unlistenBuffering();
      if (unlistenBufferingPct) unlistenBufferingPct();
      if (unlistenHwdec) unlistenHwdec();
      if (unlistenVideoReady) unlistenVideoReady();
      if (unlistenTrackList) unlistenTrackList();
      if (unlistenAid) unlistenAid();
      if (unlistenSid) unlistenSid();
      if (unlistenSpeed) unlistenSpeed();
      if (unlistenCache) unlistenCache();
      if (unlistenSubDelay) unlistenSubDelay();
      if (unlistenFileLoaded) unlistenFileLoaded();
      if (unlistenError) unlistenError();
      if (unlistenEnded) unlistenEnded();
    };
  }, []);

  // ── AniSkip ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadSkip() {
      try {
        const intervals: SkipInterval[] = await invoke('get_anime_skip', {
          malId: 5114,
          episodeNum: episode.episode,
          episodeLength: duration > 0 ? duration : 1440,
        });
        setSkipIntervals(intervals);
      } catch (e) {
        console.error('AniSkip error:', e);
      }
    }
    loadSkip();
  }, [episode, duration]);

  useEffect(() => {
    const matched = skipIntervals.find((s) => currentTime >= s.start && currentTime <= s.end);
    setCurrentSkip(matched || null);
  }, [currentTime, skipIntervals]);

  // ── Watch progress ────────────────────────────────────────────────────────
  useEffect(() => {
    const saveProgress = () => {
      if (duration > 0 && currentTime > 0) {
        invoke('save_watch_progress', {
          item: {
            media_id: item.url,
            provider_id: item.api_name,
            title: item.name,
            poster_url: item.poster_url,
            episode_num: episode.episode,
            season_num: episode.season,
            episode_name: episode.name,
            position_ms: Math.floor(currentTime * 1000),
            duration_ms: Math.floor(duration * 1000),
            last_watched_at: Date.now(),
            is_completed: currentTime / duration > 0.9,
          },
        }).catch(() => {});
      }
    };
    const interval = setInterval(saveProgress, 5000);
    return () => {
      clearInterval(interval);
      saveProgress();
    };
  }, [currentTime, duration, item, episode]);

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetHudTimer();

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((prev) => {
            const n = Math.min(1, Math.round((prev + 0.05) * 100) / 100);
            invoke('player_set_volume', { volume: n * 100 });
            triggerFeedback('volume', `${Math.round(n * 100)}%`);
            return n;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((prev) => {
            const n = Math.max(0, Math.round((prev - 0.05) * 100) / 100);
            invoke('player_set_volume', { volume: n * 100 });
            triggerFeedback('volume', `${Math.round(n * 100)}%`);
            return n;
          });
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          toggleDiagnostics();
          break;
        case '[': {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          if (currIdx > 0) {
            const next = speeds[currIdx - 1];
            changeSpeed(next);
          }
          break;
        }
        case ']': {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          if (currIdx !== -1 && currIdx < speeds.length - 1) {
            const next = speeds[currIdx + 1];
            changeSpeed(next);
          }
          break;
        }
        case 'g':
        case 'G':
          e.preventDefault();
          adjustSubDelay(-0.1);
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          adjustSubDelay(0.1);
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          togglePanscan();
          break;
        case 'Escape':
          e.preventDefault();
          if (showDiagnostics) {
            setShowDiagnostics(false);
          } else if (showSubMenu) {
            setShowSubMenu(false);
          } else if (showAudioMenu) {
            setShowAudioMenu(false);
          } else if (showServerPicker) {
            setShowServerPicker(false);
          } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            handleClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    isVideoReady,
    isMuted,
    showDiagnostics,
    showSubMenu,
    showAudioMenu,
    showServerPicker,
    playbackSpeed,
    subDelay,
    panscanVal,
  ]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!isVideoReady) return;
    if (isPlaying) {
      invoke('player_pause');
      setIsPlaying(false);
      triggerFeedback('pause');
    } else {
      invoke('player_play');
      setIsPlaying(true);
      triggerFeedback('play');
    }
  };

  const seekRelative = (offset: number) => {
    invoke('player_seek_relative', { offset });
    triggerFeedback(offset > 0 ? 'forward' : 'rewind');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    invoke('player_set_mute', { muted: next });
    triggerFeedback('volume', next ? 'Muted' : `${Math.round(volume * 100)}%`);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleClose = () => {
    invoke('player_stop').catch(() => {});
    onClose();
  };

  const handleSkipAction = () => {
    if (currentSkip) {
      invoke('player_seek', { position: currentSkip.end });
      triggerFeedback('forward');
      setCurrentSkip(null);
    }
  };

  const toggleDiagnostics = async () => {
    if (!showDiagnostics) {
      try {
        const diag: PlayerDiagnostics = await invoke('player_get_diagnostics');
        setDiagnosticsData(diag);
      } catch (err) {
        console.error('Failed to get diagnostics:', err);
      }
    }
    setShowDiagnostics(!showDiagnostics);
  };

  const changeSpeed = (spd: number) => {
    invoke('player_set_speed', { speed: spd });
    setPlaybackSpeed(spd);
    triggerFeedback('speed', `${spd}x`);
  };

  const togglePanscan = () => {
    const next = panscanVal === 0.0 ? 1.0 : 0.0;
    invoke('player_set_panscan', { panscan: next });
    setPanscanVal(next);
  };

  const adjustSubDelay = (delta: number) => {
    const next = Math.round((subDelay + delta) * 10) / 10;
    invoke('player_set_subtitle_delay', { delay: next });
    setSubDelay(next);
  };

  const resetSubDelay = () => {
    invoke('player_set_subtitle_delay', { delay: 0.0 });
    setSubDelay(0.0);
  };

  const handleSearchExternalSubs = async () => {
    setIsLoadingSubs(true);
    try {
      const res: SubtitleData[] = await invoke('search_subtitles', {
        query: item.name,
        lang: 'en',
      });
      setExternalSubs(res);
    } catch (e) {
      console.error('Failed to search subtitles:', e);
    } finally {
      setIsLoadingSubs(false);
    }
  };

  const handleAddExternalSub = async (sub: SubtitleData) => {
    try {
      await invoke('player_add_subtitle', { urlOrPath: sub.url });
      setShowSubMenu(false);
    } catch (e) {
      console.error('Failed to add external subtitle:', e);
    }
  };

  // Timeline hover handlers
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = (relX / rect.width) * 100;
    const time = (pct / 100) * duration;
    setHoverPercent(pct);
    setHoverTime(time);
  };

  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filter embedded tracks
  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const subTracks = tracks.filter((t) => t.type === 'sub');

  return (
    <div
      className={`player-container${showHud ? ' hud-active' : ''}`}
      onMouseMove={resetHudTimer}
    >
      {/* Click surface for Play/Pause and Double Click Fullscreen */}
      <div
        className="player-video-surface"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Stremio-Style Buffering Spinner */}
      {(!isVideoReady || isBuffering) && (
        <div className="player-buffering-overlay">
          <div className="player-buffering-spinner" />
          {bufferingPercent > 0 && bufferingPercent < 100 && (
            <div className="player-buffering-pct">{Math.round(bufferingPercent)}%</div>
          )}
        </div>
      )}

      {/* Center Feedback Ripple */}
      {centerFeedback && (
        <div key={centerFeedback.id} className="player-center-ripple">
          {centerFeedback.type === 'play' && <Play size={36} fill="#fff" />}
          {centerFeedback.type === 'pause' && <Pause size={36} />}
          {centerFeedback.type === 'forward' && <RotateCw size={36} />}
          {centerFeedback.type === 'rewind' && <RotateCcw size={36} />}
          {centerFeedback.type === 'speed' && (
            <span style={{ fontSize: '18px', fontWeight: 800 }}>{centerFeedback.label}</span>
          )}
          {centerFeedback.type === 'volume' && (
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{centerFeedback.label}</span>
          )}
        </div>
      )}

      {/* AniSkip Button */}
      {currentSkip && (
        <button className="player-skip-pill" onClick={handleSkipAction}>
          <FastForward size={16} />
          {currentSkip.skip_type.toUpperCase().includes('ED') ? 'Skip Ending' : 'Skip Opening'}
        </button>
      )}

      {/* Diagnostics Modal */}
      {showDiagnostics && diagnosticsData && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            right: '40px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#f8fafc',
            fontSize: '12.5px',
            fontFamily: 'monospace',
            zIndex: 400,
            width: '380px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: '13.5px',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Cpu size={16} /> Native MPV Diagnostics
            </span>
            <button
              onClick={() => setShowDiagnostics(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr',
              rowGap: '6px',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: '#94a3b8' }}>Codec:</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
              {diagnosticsData.codec || 'Detecting…'}
            </span>

            <span style={{ color: '#94a3b8' }}>Profile:</span>
            <span>{diagnosticsData.codec_profile || 'Unknown'}</span>

            <span style={{ color: '#94a3b8' }}>Pixel Format:</span>
            <span>{diagnosticsData.pixel_format || 'Unknown'}</span>

            <span style={{ color: '#94a3b8' }}>Resolution:</span>
            <span>
              {diagnosticsData.width && diagnosticsData.height
                ? `${diagnosticsData.width} × ${diagnosticsData.height}`
                : 'Detecting…'}
            </span>

            <span style={{ color: '#94a3b8' }}>FPS:</span>
            <span>{diagnosticsData.fps ? diagnosticsData.fps.toFixed(2) : 'Variable'}</span>

            <span style={{ color: '#94a3b8' }}>HW Decoder:</span>
            <span
              style={{
                color:
                  diagnosticsData.hwdec_current && diagnosticsData.hwdec_current !== 'no'
                    ? '#4ade80'
                    : '#facc15',
                fontWeight: 700,
              }}
            >
              {diagnosticsData.hwdec_current || 'auto'} ({diagnosticsData.hwdec_configured || 'auto'})
            </span>

            <span style={{ color: '#94a3b8' }}>Video Output:</span>
            <span>{diagnosticsData.video_output || 'gpu-next (D3D11)'}</span>

            <span style={{ color: '#94a3b8' }}>MPV Core:</span>
            <span>{diagnosticsData.mpv_version || 'Embedded'}</span>
          </div>
        </div>
      )}

      {/* Playback Error Detailed Modal */}
      {playbackError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5, 7, 13, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px',
            zIndex: 500,
          }}
        >
          <div
            style={{
              background: '#0d1117',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              padding: '24px 28px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '12px',
              }}
            >
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <X size={22} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  Playback Initialization Failed
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Reason: {playbackError.reason}
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#fca5a5',
                marginBottom: '16px',
                lineHeight: 1.4,
              }}
            >
              {playbackError.message}
            </div>

            <div
              style={{
                background: '#161b22',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                fontFamily: 'monospace',
                marginBottom: '18px',
                display: 'grid',
                gridTemplateColumns: '130px 1fr',
                rowGap: '4px',
              }}
            >
              <span style={{ color: '#64748b' }}>Codec:</span>
              <span>{playbackError.diagnostics.codec || 'Unavailable'}</span>
              <span style={{ color: '#64748b' }}>HWDEC Active:</span>
              <span>{playbackError.diagnostics.hwdec_current || 'none'}</span>
              <span style={{ color: '#64748b' }}>Resolution:</span>
              <span>
                {playbackError.diagnostics.width
                  ? `${playbackError.diagnostics.width}x${playbackError.diagnostics.height}`
                  : 'N/A'}
              </span>
              <span style={{ color: '#64748b' }}>VO Backend:</span>
              <span>{playbackError.diagnostics.video_output || 'gpu-next'}</span>
            </div>

            {playbackError.diagnostics.recent_logs &&
              playbackError.diagnostics.recent_logs.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      fontWeight: 700,
                      marginBottom: '6px',
                    }}
                  >
                    RECENT ENGINE LOGS:
                  </div>
                  <div
                    style={{
                      background: '#07090e',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      maxHeight: '100px',
                      overflowY: 'auto',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#f87171',
                    }}
                  >
                    {playbackError.diagnostics.recent_logs.slice(-5).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              {currentLinkIndex + 1 < links.length && (
                <button
                  onClick={() => {
                    setPlaybackError(null);
                    setCurrentLinkIndex((i) => i + 1);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try Next Mirror ({links[currentLinkIndex + 1]?.name || 'Mirror'})
                </button>
              )}
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  padding: '8px 18px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtitles & Sync Popover */}
      {showSubMenu && (
        <div className="player-popover-card" style={{ right: '80px' }} onClick={(e) => e.stopPropagation()}>
          <div className="player-popover-header">
            <span className="player-popover-title">Subtitles & Audio</span>
            <button
              onClick={() => setShowSubMenu(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Subtitle list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Embedded Subtitles
            </div>

            {/* Off Option */}
            <button
              className={`player-track-item${activeSid === 0 ? ' active' : ''}`}
              onClick={() => {
                invoke('player_set_subtitle_track', { sid: 0 });
                setActiveSid(0);
              }}
            >
              <span>Subtitles Off</span>
              {activeSid === 0 && <Check size={16} color="#a855f7" />}
            </button>

            {subTracks.map((tr) => (
              <button
                key={tr.id}
                className={`player-track-item${activeSid === tr.id ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_subtitle_track', { sid: tr.id });
                  setActiveSid(tr.id);
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>{tr.title || tr.lang?.toUpperCase() || `Subtitle #${tr.id}`}</span>
                  {tr.lang && (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {tr.lang.toUpperCase()} {tr.codec ? `• ${tr.codec}` : ''}
                    </span>
                  )}
                </div>
                {activeSid === tr.id && <Check size={16} color="#a855f7" />}
              </button>
            ))}

            {subTracks.length === 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 0' }}>
                No embedded subtitles found.
              </div>
            )}
          </div>

          {/* Subtitle Delay Adjuster */}
          {activeSid !== 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Subtitle Sync Delay
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: subDelay === 0 ? '#cbd5e1' : '#38bdf8',
                  }}
                >
                  {subDelay > 0 ? `+${subDelay.toFixed(1)}s` : `${subDelay.toFixed(1)}s`}
                </span>
              </div>
              <div className="player-pills-row">
                <button className="player-pill" onClick={() => adjustSubDelay(-0.5)}>
                  -0.5s
                </button>
                <button className="player-pill" onClick={() => adjustSubDelay(-0.1)}>
                  -0.1s
                </button>
                <button className="player-pill" onClick={resetSubDelay}>
                  Reset
                </button>
                <button className="player-pill" onClick={() => adjustSubDelay(0.1)}>
                  +0.1s
                </button>
                <button className="player-pill" onClick={() => adjustSubDelay(0.5)}>
                  +0.5s
                </button>
              </div>
            </div>
          )}

          {/* External Subtitles */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <button
              onClick={handleSearchExternalSubs}
              disabled={isLoadingSubs}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#cbd5e1',
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Subtitles size={14} />
              <span>{isLoadingSubs ? 'Searching Subtitles…' : 'Search Online Subtitles'}</span>
            </button>

            {externalSubs.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
              >
                {externalSubs.map((sub, idx) => (
                  <button
                    key={idx}
                    className="player-track-item"
                    onClick={() => handleAddExternalSub(sub)}
                  >
                    <span>
                      {sub.language || `Subtitle ${idx + 1}`} ({sub.format})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio & Settings Popover */}
      {showAudioMenu && (
        <div className="player-popover-card" style={{ right: '40px' }} onClick={(e) => e.stopPropagation()}>
          <div className="player-popover-header">
            <span className="player-popover-title">Audio & Settings</span>
            <button
              onClick={() => setShowAudioMenu(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Audio Tracks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Audio Track
            </div>
            {audioTracks.map((tr) => (
              <button
                key={tr.id}
                className={`player-track-item${activeAid === tr.id ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_audio_track', { aid: tr.id });
                  setActiveAid(tr.id);
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>{tr.title || tr.lang?.toUpperCase() || `Audio Track #${tr.id}`}</span>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      display: 'flex',
                      gap: '6px',
                    }}
                  >
                    {tr.lang && <span>{tr.lang.toUpperCase()}</span>}
                    {tr.codec && <span>• {tr.codec.toUpperCase()}</span>}
                    {tr.audio_channels && <span>({tr.audio_channels} ch)</span>}
                  </div>
                </div>
                {activeAid === tr.id && <Check size={16} color="#a855f7" />}
              </button>
            ))}

            {audioTracks.length === 0 && (
              <div style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 0' }}>
                Default Audio Stream
              </div>
            )}
          </div>

          {/* Playback Speed */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Playback Speed
            </div>
            <div className="player-pills-row">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                <button
                  key={spd}
                  className={`player-pill${playbackSpeed === spd ? ' active' : ''}`}
                  onClick={() => changeSpeed(spd)}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio / Zoom */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Aspect Ratio / Fit
            </div>
            <div className="player-pills-row">
              <button
                className={`player-pill${panscanVal === 0 ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_panscan', { panscan: 0.0 });
                  setPanscanVal(0);
                }}
              >
                Fit (Normal)
              </button>
              <button
                className={`player-pill${panscanVal === 1 ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_panscan', { panscan: 1.0 });
                  setPanscanVal(1);
                }}
              >
                Fill (Crop / Zoom)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player HUD */}
      <div className={`player-hud${showHud ? ' visible' : ''}`}>
        {/* ── Top bar ── */}
        <div className="player-top" onClick={(e) => e.stopPropagation()}>
          {/* Back button + title text */}
          <div className="player-title-box">
            <button
              onClick={handleClose}
              className="player-ctrl-btn primary"
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="player-title-text">
              <div className="player-title">{item.name}</div>
              <div className="player-subtitle">
                {episode.name
                  ? `${episode.name} (Episode ${episode.episode})`
                  : `Episode ${episode.episode}`}{' '}
                • {activeLink?.name || 'Default Mirror'}
              </div>
            </div>
          </div>

          {/* Top Right: Hardware Decoder Badge + Server Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* HWDEC Status Pill & Diagnostics Toggle */}
            <button
              onClick={toggleDiagnostics}
              title="Click to view MPV Video Diagnostics (Press 'D')"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: activeHwdec && activeHwdec !== 'no' ? '#4ade80' : '#facc15',
                padding: '6px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.5px',
              }}
            >
              <Cpu size={14} />
              <span>HW: {activeHwdec.toUpperCase()}</span>
              <Info size={12} style={{ opacity: 0.7 }} />
            </button>

            {/* Server picker */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => {
                  setShowServerPicker(!showServerPicker);
                  setShowSubMenu(false);
                  setShowAudioMenu(false);
                }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Server size={16} />
                <span>{activeLink?.source || 'Servers'}</span>
              </button>

              {showServerPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    background: '#161b26',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    padding: '8px',
                    width: '260px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#64748b',
                      fontWeight: 700,
                      padding: '4px 8px',
                    }}
                  >
                    AVAILABLE STREAM MIRRORS
                  </div>
                  {links.map((link, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentLinkIndex(idx);
                        setShowServerPicker(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background:
                          currentLinkIndex === idx ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                        color: currentLinkIndex === idx ? '#fff' : '#cbd5e1',
                        border: 'none',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{link.name}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{link.quality}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom controls ── */}
        <div className="player-bottom" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar with buffered cache and hover timestamp tooltip */}
          <div
            className="player-timeline-wrap"
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
            onClick={(e) => {
              if (duration === 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              const target = Math.max(0, Math.min(duration, pos * duration));
              setCurrentTime(target);
              invoke('player_seek', { position: target });
            }}
          >
            {/* Buffered bar */}
            <div
              className="player-timeline-buffered"
              style={{
                width: `${
                  duration > 0
                    ? Math.min(100, ((currentTime + bufferedTime) / duration) * 100)
                    : 0
                }%`,
              }}
            />

            {/* Played progress bar */}
            <div
              className="player-timeline-progress"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />

            {/* Hover tooltip */}
            {hoverTime !== null && (
              <div
                className="player-timeline-tooltip"
                style={{ left: `${hoverPercent}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Controls row */}
          <div className="player-controls-row">
            {/* Left group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Play / Pause */}
              <button className="player-ctrl-btn primary" onClick={togglePlay}>
                {isPlaying ? <Pause size={24} /> : <Play size={24} fill="#fff" />}
              </button>

              {/* Rewind 10s */}
              <button
                className="player-ctrl-btn"
                onClick={() => seekRelative(-10)}
                title="Rewind 10s (Left Arrow / J)"
              >
                <RotateCcw size={20} />
              </button>

              {/* Forward 10s */}
              <button
                className="player-ctrl-btn"
                onClick={() => seekRelative(10)}
                title="Forward 10s (Right Arrow / L)"
              >
                <RotateCw size={20} />
              </button>

              {/* Volume */}
              <div className="player-volume-row">
                <button
                  className="player-ctrl-btn"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  className="player-volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    setIsMuted(false);
                    invoke('player_set_volume', { volume: val * 100 });
                    invoke('player_set_mute', { muted: false });
                  }}
                />
              </div>

              {/* Time display */}
              <span className="player-time">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Subtitles */}
              <button
                className="player-ctrl-btn"
                onClick={() => {
                  setShowSubMenu(!showSubMenu);
                  setShowAudioMenu(false);
                  setShowServerPicker(false);
                }}
                title="Subtitles & Sync"
                style={{
                  background:
                    showSubMenu || activeSid !== 0 ? 'rgba(99, 102, 241, 0.3)' : undefined,
                  color: showSubMenu || activeSid !== 0 ? 'var(--primary)' : undefined,
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <Subtitles size={20} />
              </button>

              {/* Audio & Settings */}
              <button
                className="player-ctrl-btn"
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowSubMenu(false);
                  setShowServerPicker(false);
                }}
                title="Audio Tracks & Playback Settings"
                style={{
                  background: showAudioMenu ? 'rgba(99, 102, 241, 0.3)' : undefined,
                  color: showAudioMenu ? 'var(--primary)' : undefined,
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <Sliders size={20} />
              </button>

              {/* Fullscreen */}
              <button
                className="player-ctrl-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
