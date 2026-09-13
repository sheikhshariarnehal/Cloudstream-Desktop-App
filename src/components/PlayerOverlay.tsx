import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Episode,
  ExtractorLink,
  LoadResponse,
  MpvTrack,
  SearchResponse,
  SkipInterval,
  SubtitleData,
  WatchHistoryItem,
} from '../types';
import {
  ChevronLeft,
  Check,
  Cpu,
  FastForward,
  Headphones,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  Sliders,
  Sparkles,
  Subtitles,
  Volume2,
  VolumeX,
  X,
  SkipBack,
  SkipForward,
  ListVideo,
  Search,
  Crop,
  Clock,
  Zap,
  Globe,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  LANGUAGES,
  formatTrackLabel,
  getAutoSelectAudio,
  getAutoSelectSubtitle,
} from '../utils/subtitleHelper';
import { useSettings } from '../hooks/useSettings';

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
  uma_detected?: boolean;
  gpu_video_processing_supported?: boolean;
  gpu_video_processing_enabled?: boolean;
  display_hdr_active?: boolean;
  recent_logs?: string[];
}

interface PlayerErrorPayload {
  message: string;
  reason: string;
  diagnostics: PlayerDiagnostics;
}

export interface PlayerOverlayProps {
  item: SearchResponse;
  episode: Episode;
  links: ExtractorLink[];
  allEpisodes?: Episode[];
  mediaDetails?: LoadResponse;
  startTime?: number;
  onClose: () => void;
  onSelectEpisode?: (ep: Episode) => Promise<void> | void;
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({
  item,
  episode,
  links,
  allEpisodes,
  mediaDetails,
  startTime,
  onClose,
  onSelectEpisode,
}) => {
  const { settings } = useSettings();
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metadataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingSpeedRef = useRef<boolean>(false);
  const loadedUrlRef = useRef<string | null>(null);

  // Resume & Timeline Tracking Refs
  const targetResumeTimeRef = useRef<number>(startTime ?? 0);
  const hasResumedRef = useRef<boolean>(false);
  const isResumingRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // ── Dynamic Episode & Stream Links State ──────────────────────────────────
  const [currentEpisode, setCurrentEpisode] = useState<Episode>(episode);
  const [currentLinks, setCurrentLinks] = useState<ExtractorLink[]>(links);
  const [currentLinkIndex, setCurrentLinkIndex] = useState(0);
  const [isExtractingEpisode, setIsExtractingEpisode] = useState(false);

  // Fallback links history to prevent infinite failover loop
  const attemptedLinkIndicesRef = useRef<Set<number>>(new Set());

  // ── Playback State ────────────────────────────────────────────────────────
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

  // ── Modals, Overlays & Popovers ───────────────────────────────────────────
  const [showServerPicker, setShowServerPicker] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showOnlineSubModal, setShowOnlineSubModal] = useState(false);
  const [showPausedMetadata, setShowPausedMetadata] = useState(false);

  // Next episode countdown overlay
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  // Diagnostics & errors
  const [diagnosticsData, setDiagnosticsData] = useState<PlayerDiagnostics | null>(null);
  const [playbackError, setPlaybackError] = useState<PlayerErrorPayload | null>(null);
  const [failoverNotice, setFailoverNotice] = useState<string | null>(null);

  // Tracks, speed, aspect ratio, buffering & sync
  const [tracks, setTracks] = useState<MpvTrack[]>([]);
  const [activeAid, setActiveAid] = useState<number>(0);
  const [activeSid, setActiveSid] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [normalSpeedBeforeHold, setNormalSpeedBeforeHold] = useState<number>(1.0);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState<boolean>(false);
  const [panscanVal, setPanscanVal] = useState<number>(0.0);
  const [bufferedTime, setBufferedTime] = useState<number>(0);
  const [subDelay, setSubDelay] = useState<number>(0.0);

  // Auto Track states (CloudStream architecture)
  const [isAutoSub, setIsAutoSub] = useState<boolean>(() => {
    const saved = localStorage.getItem('player_auto_sub');
    return saved !== null ? saved === 'true' : true;
  });
  const [isAutoAudio, setIsAutoAudio] = useState<boolean>(() => {
    const saved = localStorage.getItem('player_auto_audio');
    return saved !== null ? saved === 'true' : true;
  });
  const [preferredSubLang] = useState<string>(() => {
    return localStorage.getItem('player_preferred_sub_lang') || 'en';
  });
  const [autoSkipIntroOutro, setAutoSkipIntroOutro] = useState<boolean>(() => {
    const saved = localStorage.getItem('player_auto_skip_intro');
    return saved !== null ? saved === 'true' : false;
  });

  // Synchronize player optimization settings (HWDEC, Render Profile, RTX VSR) with native MPV
  useEffect(() => {
    if (settings.hardwareAcceleration) {
      invoke('player_set_hwdec', { mode: settings.hardwareAcceleration }).catch(console.error);
    }
    if (settings.renderProfile) {
      invoke('player_set_render_profile', { profile: settings.renderProfile }).catch(console.error);
    }
    if (settings.gpuVideoProcessing !== undefined) {
      invoke('player_set_gpu_video_processing', { enabled: settings.gpuVideoProcessing }).catch(console.error);
    }
  }, [settings.hardwareAcceleration, settings.renderProfile, settings.gpuVideoProcessing]);

  // Online external subtitles
  const [onlineSubQuery, setOnlineSubQuery] = useState('');
  const [onlineSubLang, setOnlineSubLang] = useState(preferredSubLang || 'en');
  const [onlineSubResults, setOnlineSubResults] = useState<SubtitleData[]>([]);
  const [isSearchingOnlineSubs, setIsSearchingOnlineSubs] = useState(false);
  const [externalSubs, setExternalSubs] = useState<SubtitleData[]>([]);

  // AniSkip & watch progress
  const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
  const [currentSkip, setCurrentSkip] = useState<SkipInterval | null>(null);

  // Drawer filtering
  const [drawerSeason, setDrawerSeason] = useState<number>(episode.season || 1);
  const [drawerSearch, setDrawerSearch] = useState('');

  // Timeline hover tooltip & Center ripple feedback
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPercent, setHoverPercent] = useState<number>(0);
  const [centerFeedback, setCenterFeedback] = useState<{
    type: 'play' | 'pause' | 'forward' | 'rewind' | 'speed' | 'volume' | 'aspect';
    label?: string;
    id: number;
  } | null>(null);

  const activeLink = currentLinks[currentLinkIndex] || currentLinks[0];

  // Loading backdrop lifecycle
  const [backdropMounted, setBackdropMounted] = useState(true);
  const [backdropFading, setBackdropFading] = useState(false);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Load target resume time for current episode if not provided via props or when switching episode
  useEffect(() => {
    let isCancelled = false;

    async function checkResumeTime() {
      // If startTime was provided directly in props for the initial episode
      if (startTime !== undefined && startTime > 2 && currentEpisode.episode === episode.episode) {
        targetResumeTimeRef.current = startTime;
        hasResumedRef.current = false;
        return;
      }

      try {
        const histList: WatchHistoryItem[] = await invoke('get_media_watch_history', {
          mediaId: item.url,
        });
        if (isCancelled) return;

        const epNum = currentEpisode.episode;
        const sNum = currentEpisode.season || 1;
        const match = histList.find(
          (h) => (h.episode_num ?? 1) === epNum && (h.season_num ?? 1) === sNum
        );

        if (
          match &&
          match.position_ms > 3000 &&
          !match.is_completed &&
          (match.duration_ms === 0 || match.position_ms / match.duration_ms < 0.95)
        ) {
          const sec = match.position_ms / 1000;
          console.log(`[PlayerOverlay] Found saved progress for S${sNum}E${epNum}: ${sec}s`);
          targetResumeTimeRef.current = sec;
          hasResumedRef.current = false;
        } else {
          targetResumeTimeRef.current = 0;
          hasResumedRef.current = true;
        }
      } catch (err) {
        console.error('[PlayerOverlay] Failed to fetch watch history for resume:', err);
      }
    }

    checkResumeTime();

    return () => {
      isCancelled = true;
    };
  }, [item.url, currentEpisode, startTime, episode.episode]);

  // Determine if video is actively playing or in a no-video state (loading, error, extracting, ended)
  const isNoVideo = !isVideoReady || Boolean(playbackError) || isExtractingEpisode;

  // Solid Backdrop lifecycle: keep mounted and solid whenever no video is playing
  useEffect(() => {
    if (isVideoReady && !isNoVideo) {
      setBackdropFading(true);
      const timer = setTimeout(() => {
        setBackdropMounted(false);
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setBackdropMounted(true);
      setBackdropFading(false);
    }
  }, [isVideoReady, isNoVideo]);

  // ── Episodes Calculations (CloudStream Parity) ───────────────────────────
  const episodesList = useMemo(() => {
    if (allEpisodes && allEpisodes.length > 0) return allEpisodes;
    if (mediaDetails?.episodes && mediaDetails.episodes.length > 0) return mediaDetails.episodes;
    return [episode];
  }, [allEpisodes, mediaDetails, episode]);

  const hasMultipleEpisodes = episodesList.length > 1;

  const currentEpIndex = useMemo(() => {
    return episodesList.findIndex(
      (e) =>
        (e.season || 1) === (currentEpisode.season || 1) &&
        e.episode === currentEpisode.episode
    );
  }, [episodesList, currentEpisode]);

  const hasPrevEp = currentEpIndex > 0;
  const hasNextEp = currentEpIndex !== -1 && currentEpIndex < episodesList.length - 1;
  const prevEp = hasPrevEp ? episodesList[currentEpIndex - 1] : null;
  const nextEp = hasNextEp ? episodesList[currentEpIndex + 1] : null;

  const drawerSeasons = useMemo(() => {
    const sNums = Array.from(new Set(episodesList.map((e) => e.season || 1))).sort((a, b) => a - b);
    return sNums.length > 0 ? sNums : [1];
  }, [episodesList]);

  const drawerEpisodes = useMemo(() => {
    let list = episodesList.filter((e) => (e.season || 1) === drawerSeason);
    if (drawerSearch.trim()) {
      const q = drawerSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.episode.toString() === q ||
          `ep ${e.episode}`.includes(q) ||
          `episode ${e.episode}`.includes(q) ||
          (e.name && e.name.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => a.episode - b.episode);
  }, [episodesList, drawerSeason, drawerSearch]);

  // ── HUD auto-hide ─────────────────────────────────────────────────────────
  const resetHudTimer = () => {
    setShowHud(true);
    setShowPausedMetadata(false);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowHud(false);
      // If paused, schedule metadata scrim after controls hide (CloudStream scheduleMetadataVisibility)
      if (!isPlaying && isVideoReady) {
        setShowPausedMetadata(true);
      }
    }, 3200);
  };

  useEffect(() => {
    resetHudTimer();
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Keep HUD alive while popups, server picker or settings are open (drawer has its own dedicated UI)
  useEffect(() => {
    const isAnyModalOpen =
      showServerPicker ||
      showDiagnostics ||
      showSubMenu ||
      showAudioMenu ||
      showSettingsMenu ||
      showDelayModal ||
      showOnlineSubModal ||
      nextCountdown !== null ||
      playbackError !== null;

    if (isAnyModalOpen) {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      setShowHud(true);
      setShowPausedMetadata(false);
    }
  }, [
    showServerPicker,
    showDiagnostics,
    showSubMenu,
    showAudioMenu,
    showSettingsMenu,
    showDelayModal,
    showOnlineSubModal,
    nextCountdown,
    playbackError,
  ]);

  // Cleanly dismiss paused metadata scrim when episode drawer opens
  useEffect(() => {
    if (showEpisodeDrawer) {
      setShowPausedMetadata(false);
    }
  }, [showEpisodeDrawer]);

  // ── Center ripple feedback trigger ────────────────────────────────────────
  const triggerFeedback = (
    type: 'play' | 'pause' | 'forward' | 'rewind' | 'speed' | 'volume' | 'aspect',
    label?: string
  ) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setCenterFeedback({ type, label, id: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setCenterFeedback(null);
    }, 650);
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

  // ── Episode Switching Function ────────────────────────────────────────────
  const handleSwitchEpisode = async (targetEp: Episode) => {
    if (
      targetEp.episode === currentEpisode.episode &&
      (targetEp.season || 1) === (currentEpisode.season || 1)
    ) {
      setShowEpisodeDrawer(false);
      return;
    }

    setIsExtractingEpisode(true);
    setNextCountdown(null);
    setShowEpisodeDrawer(false);
    try {
      if (onSelectEpisode) {
        await onSelectEpisode(targetEp);
      } else {
        const newLinks: ExtractorLink[] = await invoke('load_links', {
          provider: item.api_name,
          data: targetEp.data,
        });
        if (newLinks && newLinks.length > 0) {
          setCurrentEpisode(targetEp);
          setCurrentLinks(newLinks);
          setCurrentLinkIndex(0);
          attemptedLinkIndicesRef.current.clear();
          setCurrentTime(0);
          setDuration(0);
          setIsVideoReady(false);
          setIsBuffering(true);
        } else {
          alert(`No stream links found for Episode ${targetEp.episode}`);
        }
      }
    } catch (err) {
      console.error('[PlayerOverlay] Failed to load episode:', err);
      alert(`Error loading Episode ${targetEp.episode}: ${err}`);
    } finally {
      setIsExtractingEpisode(false);
    }
  };

  // ── Mirror Failover (CloudStream hasNextMirror / nextMirror) ───────────────
  const tryNextMirror = (failedReason: string) => {
    attemptedLinkIndicesRef.current.add(currentLinkIndex);
    const availableIndices = currentLinks
      .map((_, i) => i)
      .filter((i) => !attemptedLinkIndicesRef.current.has(i));

    if (availableIndices.length > 0) {
      const nextIdx = availableIndices[0];
      setFailoverNotice(
        `Mirror failed (${failedReason}). Auto-switching to '${currentLinks[nextIdx].name}' (${nextIdx + 1}/${currentLinks.length})...`
      );
      setTimeout(() => setFailoverNotice(null), 4000);
      setCurrentLinkIndex(nextIdx);
    } else {
      // All mirrors exhausted: trigger detailed diagnostics modal
      invoke<PlayerDiagnostics>('player_get_diagnostics')
        .then((diag) => {
          setPlaybackError({
            message: 'All available stream mirrors failed to load.',
            reason: failedReason,
            diagnostics: diag,
          });
        })
        .catch(() => {
          setPlaybackError({
            message: 'All available stream mirrors failed to load.',
            reason: failedReason,
            diagnostics: {},
          });
        });
    }
  };

  // ── Native MPV Stream Loading ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeLink?.url) return;
    if (loadedUrlRef.current === activeLink.url) return;
    loadedUrlRef.current = activeLink.url;

    setPlaybackError(null);
    setIsVideoReady(false);
    setIsBuffering(true);
    setBufferedTime(0);

    const title = `${item.name} · ${
      currentEpisode.name || `Episode ${currentEpisode.episode}`
    }`;
    const resumeSec = targetResumeTimeRef.current > 2 ? targetResumeTimeRef.current : undefined;
    console.log('[PlayerOverlay] Loading stream in native MPV:', activeLink.url, 'resumeSec:', resumeSec);

    invoke('player_load', {
      url: activeLink.url,
      title,
      headers: activeLink.headers || null,
      startTime: resumeSec ?? null,
    }).catch((e: unknown) => {
      console.error('[PlayerOverlay] Failed to load stream in native MPV:', e);
      tryNextMirror(String(e));
    });
  }, [activeLink?.url, currentEpisode]);

  // ── Listen to Native Player Events ────────────────────────────────────────
  useEffect(() => {
    let unlistenTime: (() => void) | undefined;
    let unlistenDur: (() => void) | undefined;
    let unlistenPaused: (() => void) | undefined;
    let unlistenBuffering: (() => void) | undefined;
    let unlistenBufferingPct: (() => void) | undefined;
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
          const pos = e.payload;
          setCurrentTime(pos);

          // Handle timeline resume verification and fallback seek
          if (targetResumeTimeRef.current > 2 && !hasResumedRef.current) {
            if (Math.abs(pos - targetResumeTimeRef.current) <= 4 || pos >= targetResumeTimeRef.current) {
              hasResumedRef.current = true;
              isResumingRef.current = false;
              triggerFeedback('forward', `Resumed at ${formatTime(targetResumeTimeRef.current)}`);
              console.log(`[PlayerOverlay] Successfully resumed at ${pos}s`);
            } else if (pos < 1.5 && !isResumingRef.current) {
              // Stream started from 0s instead of resume position, force seek
              isResumingRef.current = true;
              const target = targetResumeTimeRef.current;
              console.log(`[PlayerOverlay] Player started at ${pos}s, seeking to resume point ${target}s`);
              invoke('player_seek', { position: target })
                .then(() => {
                  setTimeout(() => {
                    hasResumedRef.current = true;
                    isResumingRef.current = false;
                    triggerFeedback('forward', `Resumed at ${formatTime(target)}`);
                  }, 500);
                })
                .catch(() => {
                  isResumingRef.current = false;
                });
            }
          }

          if (pos > 0.3) {
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

      unlistenVideoReady = await listen<{ load_id?: number; ready: boolean }>(
        'player://video-ready',
        (e) => {
          if (e.payload?.ready) {
            setIsVideoReady(true);
            setIsBuffering(false);
          } else {
            setIsVideoReady(false);
          }
        }
      );

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

        // Fallback: If player didn't start at resume position, ensure seek to target
        if (targetResumeTimeRef.current > 2 && !hasResumedRef.current) {
          const target = targetResumeTimeRef.current;
          invoke('player_seek', { position: target }).catch(() => {});
        }
      });

      unlistenError = await listen<PlayerErrorPayload>('player://error', (e) => {
        console.error('[PlayerOverlay] Native playback error received:', e.payload);
        setIsVideoReady(false);
        tryNextMirror(e.payload.reason || 'Playback decoding error');
      });

      // Video Ended / EOF event (CloudStream VideoEndedEvent)
      unlistenEnded = await listen('player://ended', () => {
        setIsPlaying(false);
        setIsVideoReady(false);
        if (hasNextEp) {
          setNextCountdown(5);
        }
      });

      // Initial track fetch
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
  }, [hasNextEp, currentLinkIndex, currentLinks]);

  // ── Next Episode Countdown Timer ──────────────────────────────────────────
  useEffect(() => {
    if (nextCountdown === null) return;
    if (nextCountdown <= 0) {
      setNextCountdown(null);
      if (nextEp) handleSwitchEpisode(nextEp);
      return;
    }
    const timer = setTimeout(() => {
      setNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [nextCountdown, nextEp]);

  // ── Auto-trigger Next Countdown near video end (>96% progress) ────────────
  useEffect(() => {
    if (
      duration > 60 &&
      currentTime > 0 &&
      currentTime / duration > 0.96 &&
      hasNextEp &&
      nextCountdown === null &&
      !isExtractingEpisode
    ) {
      setNextCountdown(6);
    }
  }, [currentTime, duration, hasNextEp, nextCountdown, isExtractingEpisode]);

  // ── AniSkip Integration ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadSkip() {
      try {
        const intervals: SkipInterval[] = await invoke('get_anime_skip', {
          malId: 5114,
          episodeNum: currentEpisode.episode,
          episodeLength: duration > 0 ? duration : 1440,
        });
        setSkipIntervals(intervals);
      } catch (e) {
        console.error('AniSkip fetch error:', e);
      }
    }
    loadSkip();
  }, [currentEpisode, duration]);

  useEffect(() => {
    const matched = skipIntervals.find(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    setCurrentSkip(matched || null);

    // Auto-skip opening/ending if enabled
    if (matched && autoSkipIntroOutro && currentTime < matched.end - 1) {
      invoke('player_seek', { position: matched.end });
      triggerFeedback('forward', `Auto-Skipped ${matched.skip_type}`);
      setCurrentSkip(null);
    }
  }, [currentTime, skipIntervals, autoSkipIntroOutro]);

  // ── Save Watch History Progress ───────────────────────────────────────────
  useEffect(() => {
    const saveProgress = () => {
      // Prevent overwriting saved progress before the player has resumed to the saved timeline!
      if (!hasResumedRef.current && targetResumeTimeRef.current > 2) {
        return;
      }
      const cur = currentTimeRef.current;
      const dur = durationRef.current;
      if (dur > 0 && cur > 0) {
        invoke('save_watch_progress', {
          item: {
            media_id: item.url,
            provider_id: item.api_name,
            title: item.name,
            poster_url: item.poster_url,
            episode_num: currentEpisode.episode,
            season_num: currentEpisode.season || 1,
            episode_name: currentEpisode.name,
            position_ms: Math.floor(cur * 1000),
            duration_ms: Math.floor(dur * 1000),
            last_watched_at: Date.now(),
            is_completed: cur / dur > 0.9,
          },
        }).catch(() => {});
      }
    };
    const interval = setInterval(saveProgress, 5000);
    return () => {
      clearInterval(interval);
      saveProgress();
    };
  }, [item, currentEpisode]);

  // ── Fullscreen Sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ── Keyboard Shortcuts (CloudStream Player Parity) ─────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      resetHudTimer();

      switch (e.key) {
        case ' ':
          // Hold-to-speed gesture on space bar
          if (!e.repeat && isPlaying && !isHoldingSpeedRef.current) {
            isHoldingSpeedRef.current = true;
            setNormalSpeedBeforeHold(playbackSpeed);
            holdTimerRef.current = setTimeout(() => {
              invoke('player_set_speed', { speed: 2.0 });
              setIsSpeedBoosted(true);
            }, 250);
          }
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekRelative(e.shiftKey ? -5 : e.ctrlKey ? -30 : -10);
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekRelative(e.shiftKey ? 5 : e.ctrlKey ? 30 : 10);
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
        case 'n':
        case 'N':
          e.preventDefault();
          if (nextEp) handleSwitchEpisode(nextEp);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          if (prevEp) handleSwitchEpisode(prevEp);
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          if (hasMultipleEpisodes) setShowEpisodeDrawer((prev) => !prev);
          break;
        case 's':
        case 'S':
          e.preventDefault();
          cycleSubtitles();
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          cycleAudio();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          toggleDiagnostics();
          break;
        case 'z':
        case 'Z':
          e.preventDefault();
          togglePanscan();
          break;
        case '[': {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          if (currIdx > 0) changeSpeed(speeds[currIdx - 1]);
          break;
        }
        case ']': {
          e.preventDefault();
          const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
          const currIdx = speeds.indexOf(playbackSpeed);
          if (currIdx !== -1 && currIdx < speeds.length - 1) {
            changeSpeed(speeds[currIdx + 1]);
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
        case 'Escape':
          e.preventDefault();
          if (showEpisodeDrawer) {
            setShowEpisodeDrawer(false);
          } else if (showDiagnostics) {
            setShowDiagnostics(false);
          } else if (showDelayModal) {
            setShowDelayModal(false);
          } else if (showOnlineSubModal) {
            setShowOnlineSubModal(false);
          } else if (showSubMenu) {
            setShowSubMenu(false);
          } else if (showAudioMenu) {
            setShowAudioMenu(false);
          } else if (showServerPicker) {
            setShowServerPicker(false);
          } else if (showSettingsMenu) {
            setShowSettingsMenu(false);
          } else if (nextCountdown !== null) {
            setNextCountdown(null);
          } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            handleClose();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (isHoldingSpeedRef.current) {
          if (isSpeedBoosted) {
            invoke('player_set_speed', { speed: normalSpeedBeforeHold });
            setIsSpeedBoosted(false);
          } else {
            togglePlay();
          }
          isHoldingSpeedRef.current = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isPlaying,
    isVideoReady,
    isMuted,
    showDiagnostics,
    showSubMenu,
    showAudioMenu,
    showServerPicker,
    showEpisodeDrawer,
    showDelayModal,
    showOnlineSubModal,
    playbackSpeed,
    normalSpeedBeforeHold,
    isSpeedBoosted,
    subDelay,
    panscanVal,
    hasMultipleEpisodes,
    nextEp,
    prevEp,
    nextCountdown,
  ]);

  // ── Playback Controls ─────────────────────────────────────────────────────
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
      setShowPausedMetadata(false);
    }
  };

  const seekRelative = (offset: number) => {
    invoke('player_seek_relative', { offset });
    triggerFeedback(offset > 0 ? 'forward' : 'rewind', `${Math.abs(offset)}s`);
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
      triggerFeedback('forward', `Skipped ${currentSkip.skip_type}`);
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
    const next = panscanVal === 0.0 ? 1.0 : panscanVal === 1.0 ? 0.5 : 0.0;
    invoke('player_set_panscan', { panscan: next });
    setPanscanVal(next);
    triggerFeedback(
      'aspect',
      next === 0.0 ? 'Fit (Keep Aspect)' : next === 1.0 ? 'Fill (Crop / Zoom)' : 'Wide Fit'
    );
  };

  const adjustSubDelay = (delta: number) => {
    const next = Math.round((subDelay + delta) * 100) / 100;
    invoke('player_set_subtitle_delay', { delay: next });
    setSubDelay(next);
    triggerFeedback(
      'speed',
      `Sub Sync: ${next > 0 ? `+${next.toFixed(2)}s` : `${next.toFixed(2)}s`}`
    );
  };

  const resetSubDelay = () => {
    invoke('player_set_subtitle_delay', { delay: 0.0 });
    setSubDelay(0.0);
    triggerFeedback('speed', 'Sub Sync: 0.00s');
  };

  // ── Online Subtitles Search ───────────────────────────────────────────────
  const handleSearchOnlineSubs = async () => {
    setIsSearchingOnlineSubs(true);
    try {
      const q = onlineSubQuery.trim() || item.name;
      const res: SubtitleData[] = await invoke('search_subtitles', {
        query: q,
        lang: onlineSubLang,
      });
      setOnlineSubResults(res || []);
    } catch (err) {
      console.error('Online sub search error:', err);
    } finally {
      setIsSearchingOnlineSubs(false);
    }
  };

  const handleSelectOnlineSub = async (sub: SubtitleData) => {
    try {
      await invoke('player_add_subtitle', { urlOrPath: sub.url });
      setExternalSubs((prev) => [...prev, sub]);
      setShowOnlineSubModal(false);
      triggerFeedback('speed', `Loaded: ${sub.language || 'Subtitle'}`);
    } catch (err) {
      console.error('Failed to load online subtitle:', err);
      alert(`Failed to load subtitle: ${err}`);
    }
  };

  // ── Tracks Filtering & Helpers ────────────────────────────────────────────
  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const subTracks = tracks.filter((t) => t.type === 'sub');

  const autoSubMatch = useMemo(() => {
    return getAutoSelectSubtitle(subTracks, externalSubs, preferredSubLang);
  }, [subTracks, externalSubs, preferredSubLang]);

  const autoAudioMatch = useMemo(() => {
    return getAutoSelectAudio(audioTracks, 'auto');
  }, [audioTracks]);

  // Track cycling helpers (keyboard shortcuts S & A)
  const cycleSubtitles = () => {
    if (subTracks.length === 0) return;
    const allOptions = [0, ...subTracks.map((t) => t.id)];
    const currPos = allOptions.indexOf(activeSid);
    const nextId = allOptions[(currPos + 1) % allOptions.length];
    handleSelectSubTrack(nextId);
  };

  const cycleAudio = () => {
    if (audioTracks.length <= 1) return;
    const currPos = audioTracks.findIndex((t) => t.id === activeAid);
    const nextTrack = audioTracks[(currPos + 1) % audioTracks.length];
    handleSelectAudioTrack(nextTrack.id);
  };

  const handleSelectAutoSub = () => {
    setIsAutoSub(true);
    localStorage.setItem('player_auto_sub', 'true');
    if (autoSubMatch?.track) {
      invoke('player_set_subtitle_track', { sid: autoSubMatch.track.id }).catch(() => {});
      setActiveSid(autoSubMatch.track.id);
    } else {
      invoke('player_set_subtitle_track', { sid: -1 }).catch(() => {});
    }
  };

  const handleDisableSubs = () => {
    setIsAutoSub(false);
    localStorage.setItem('player_auto_sub', 'false');
    invoke('player_set_subtitle_track', { sid: 0 }).catch(() => {});
    setActiveSid(0);
    triggerFeedback('speed', 'Subtitles: Off');
  };

  const handleSelectSubTrack = (sid: number) => {
    setIsAutoSub(false);
    localStorage.setItem('player_auto_sub', 'false');
    invoke('player_set_subtitle_track', { sid }).catch(() => {});
    setActiveSid(sid);
    const matched = subTracks.find((t) => t.id === sid);
    triggerFeedback('speed', `Subtitle: ${matched?.lang || matched?.title || 'Track ' + sid}`);
  };

  const handleSelectAutoAudio = () => {
    setIsAutoAudio(true);
    localStorage.setItem('player_auto_audio', 'true');
    if (autoAudioMatch?.track) {
      invoke('player_set_audio_track', { aid: autoAudioMatch.track.id }).catch(() => {});
      setActiveAid(autoAudioMatch.track.id);
    } else {
      invoke('player_set_audio_track', { aid: -1 }).catch(() => {});
    }
  };

  const handleSelectAudioTrack = (aid: number) => {
    setIsAutoAudio(false);
    localStorage.setItem('player_auto_audio', 'false');
    invoke('player_set_audio_track', { aid }).catch(() => {});
    setActiveAid(aid);
    const matched = audioTracks.find((t) => t.id === aid);
    triggerFeedback('speed', `Audio: ${matched?.lang || matched?.title || 'Track ' + aid}`);
  };

  // ── Timeline & Time Format ────────────────────────────────────────────────
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

  // Mouse wheel volume on video (safely bypasses scrolling inside episode list, menus, or modals)
  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.player-episodes-drawer, .drawer-list-scroll, .drawer-seasons-row, .player-popover-card, .player-tuner-card, .player-online-sub-card, .player-dropdown-menu, .player-diagnostics-card, .online-sub-results-scroll, input, select, textarea'
      )
    ) {
      return;
    }

    e.preventDefault();
    resetHudTimer();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    setVolume((prev) => {
      const n = Math.max(0, Math.min(1, Math.round((prev + delta) * 100) / 100));
      invoke('player_set_volume', { volume: n * 100 });
      triggerFeedback('volume', `${Math.round(n * 100)}%`);
      return n;
    });
  };

  return (
    <div
      className={`player-container${showHud ? ' hud-active' : ''}${
        isNoVideo ? ' player-solid-mode' : ''
      }`}
      onMouseMove={resetHudTimer}
      onWheel={handleWheel}
    >
      {/* ── Solid Backdrop when no video is playing ── */}
      {backdropMounted && (
        <div className={`player-loading-backdrop${backdropFading ? ' fade-out' : ''}`}>
          {isBuffering && !playbackError && (
            <>
              <div className="player-buffering-spinner" />
              {bufferingPercent > 0 && bufferingPercent < 100 && (
                <div className="player-buffering-pct">{Math.round(bufferingPercent)}%</div>
              )}
            </>
          )}
          {isExtractingEpisode && (
            <div className="player-extracting-label">Loading episode streams...</div>
          )}
        </div>
      )}

      {/* ── Video Click Surface & Gestures ── */}
      <div
        className="player-video-surface"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* ── Failover Toast Notice ── */}
      {failoverNotice && (
        <div className="player-failover-toast">
          <RefreshCw size={15} className="spin-fast" />
          <span>{failoverNotice}</span>
        </div>
      )}

      {/* ── Speed Boost Floating Pill (Hold-to-speed gesture) ── */}
      {isSpeedBoosted && (
        <div className="player-speed-boost-badge">
          <Zap size={18} fill="#f59e0b" color="#f59e0b" />
          <span>2.0X SPEED</span>
        </div>
      )}

      {/* ── Mid-Playback Buffering Spinner ── */}
      {isVideoReady && isBuffering && (
        <div className="player-buffering-overlay">
          <div className="player-buffering-spinner" />
          {bufferingPercent > 0 && bufferingPercent < 100 && (
            <div className="player-buffering-pct">{Math.round(bufferingPercent)}%</div>
          )}
        </div>
      )}

      {/* ── Center Ripple Feedback ── */}
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
          {centerFeedback.type === 'aspect' && (
            <span style={{ fontSize: '15px', fontWeight: 800 }}>{centerFeedback.label}</span>
          )}
        </div>
      )}

      {/* ── AniSkip Pill Button ── */}
      {currentSkip && (
        <button className="player-skip-pill" onClick={handleSkipAction}>
          <FastForward size={16} />
          {currentSkip.skip_type.toUpperCase().includes('ED') ? 'Skip Ending' : 'Skip Opening'}
        </button>
      )}

      {/* ── Paused Metadata Scrim (CloudStream showPlayerMetadata parity) ── */}
      {showPausedMetadata && !isPlaying && (
        <div className="player-metadata-scrim animate-fade-in" onClick={() => togglePlay()}>
          <div className="player-meta-scrim-content" onClick={(e) => e.stopPropagation()}>
            <div className="player-meta-scrim-title">{item.name}</div>
            <div className="player-meta-scrim-sub">
              {currentEpisode.season && `Season ${currentEpisode.season} • `}
              Episode {currentEpisode.episode}
              {currentEpisode.name ? `: ${currentEpisode.name}` : ''}
            </div>
            {mediaDetails && (
              <div className="player-meta-scrim-tags">
                {mediaDetails.year && <span>{mediaDetails.year}</span>}
                {mediaDetails.score && (
                  <span className="scrim-imdb-badge">★ {mediaDetails.score.toFixed(1)}</span>
                )}
                {mediaDetails.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="scrim-tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {mediaDetails?.plot && (
              <p className="player-meta-scrim-plot">{mediaDetails.plot}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Next Episode Auto-Countdown Card ── */}
      {nextCountdown !== null && nextEp && (
        <div className="player-next-ep-card animate-slide-up">
          <div className="next-ep-header">
            <span className="next-ep-label">UP NEXT IN {nextCountdown}s</span>
            <button className="next-ep-close-btn" onClick={() => setNextCountdown(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="next-ep-body">
            <div className="next-ep-title">
              S{nextEp.season || 1}:E{nextEp.episode} - {nextEp.name || `Episode ${nextEp.episode}`}
            </div>
          </div>
          <div className="next-ep-actions">
            <button
              className="next-ep-play-btn"
              onClick={() => handleSwitchEpisode(nextEp)}
              disabled={isExtractingEpisode}
            >
              <Play size={14} fill="#fff" />
              <span>{isExtractingEpisode ? 'Loading...' : 'Play Now'}</span>
            </button>
            <button className="next-ep-cancel-btn" onClick={() => setNextCountdown(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── IN-PLAYER EPISODE DRAWER (CloudStream showEpisodesOverlay) ── */}
      {showEpisodeDrawer && (
        <>
          {/* Transparent/dim click-away backdrop over video */}
          <div
            className="player-episodes-backdrop"
            onClick={() => setShowEpisodeDrawer(false)}
          />

          {/* Solid slide-in episode drawer */}
          <div
            className="player-episodes-drawer"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div className="drawer-title-box">
                <ListVideo size={18} color="#a855f7" />
                <span className="drawer-title">Episodes</span>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => setShowEpisodeDrawer(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Season Selector */}
            {drawerSeasons.length > 1 && (
              <div
                className="drawer-seasons-row"
                onWheel={(e) => {
                  e.stopPropagation();
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                {drawerSeasons.map((sNum) => (
                  <button
                    key={sNum}
                    className={`drawer-season-pill${drawerSeason === sNum ? ' active' : ''}`}
                    onClick={() => setDrawerSeason(sNum)}
                  >
                    Season {sNum}
                  </button>
                ))}
              </div>
            )}

            {/* Search filter */}
            <div className="drawer-search-box">
              <input
                type="text"
                placeholder="Search episodes..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
              />
              {drawerSearch ? (
                <button onClick={() => setDrawerSearch('')}>
                  <X size={14} />
                </button>
              ) : (
                <Search size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
              )}
            </div>

            {/* Episode List */}
            <div
              className="drawer-list-scroll"
              onWheel={(e) => e.stopPropagation()}
            >
              {drawerEpisodes.map((ep) => {
                const isCurrent =
                  (ep.season || 1) === (currentEpisode.season || 1) &&
                  ep.episode === currentEpisode.episode;
                return (
                  <div
                    key={`${ep.season || 1}_${ep.episode}`}
                    className={`drawer-ep-card${isCurrent ? ' current-playing' : ''}`}
                    onClick={() => handleSwitchEpisode(ep)}
                  >
                    <div className="drawer-ep-thumb-wrap">
                      <img
                        src={
                          ep.poster_url ||
                          item.poster_url ||
                          'https://via.placeholder.com/320x180?text=Episode'
                        }
                        alt={ep.name || `Episode ${ep.episode}`}
                        className="drawer-ep-thumb"
                      />
                      {isCurrent && (
                        <div className="drawer-playing-tag">
                          <span className="drawer-live-dot" />
                          <span>PLAYING</span>
                        </div>
                      )}
                      <div className="drawer-play-hover">
                        <Play size={18} fill="#fff" color="#fff" />
                      </div>
                    </div>
                    <div className="drawer-ep-info">
                      <div className="drawer-ep-title" title={ep.name}>
                        {ep.episode}. {ep.name || `Episode ${ep.episode}`}
                      </div>
                      {ep.release_date && (
                        <div className="drawer-ep-date">{ep.release_date}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              {drawerEpisodes.length === 0 && (
                <div className="drawer-empty">No episodes found</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Subtitle Delay Adjustment Tuner Modal ── */}
      {showDelayModal && (
        <div
          className="player-dialog-backdrop"
          onClick={() => setShowDelayModal(false)}
        >
          <div
            className="player-tuner-card"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="tuner-header">
              <Clock size={18} color="#38bdf8" />
              <span>Subtitle Sync & Delay</span>
              <button onClick={() => setShowDelayModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="tuner-body">
              <div className="tuner-display">
                {subDelay > 0 ? `+${subDelay.toFixed(2)}s` : `${subDelay.toFixed(2)}s`}
              </div>
              <div className="tuner-row">
                <button onClick={() => adjustSubDelay(-1.0)}>-1.0s</button>
                <button onClick={() => adjustSubDelay(-0.25)}>-250ms</button>
                <button onClick={() => adjustSubDelay(-0.05)}>-50ms</button>
                <button className="reset-btn" onClick={resetSubDelay}>
                  Reset (0s)
                </button>
                <button onClick={() => adjustSubDelay(0.05)}>+50ms</button>
                <button onClick={() => adjustSubDelay(0.25)}>+250ms</button>
                <button onClick={() => adjustSubDelay(1.0)}>+1.0s</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Online Subtitles Search Modal (openOnlineSubPicker parity) ── */}
      {showOnlineSubModal && (
        <div
          className="player-dialog-backdrop"
          onClick={() => setShowOnlineSubModal(false)}
        >
          <div
            className="player-online-sub-card"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="online-sub-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} color="#c084fc" />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  Search Online Subtitles
                </span>
              </div>
              <button onClick={() => setShowOnlineSubModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="online-sub-search-row">
              <input
                type="text"
                placeholder="Title search query..."
                value={onlineSubQuery}
                onChange={(e) => setOnlineSubQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOnlineSubs()}
              />
              <select
                value={onlineSubLang}
                onChange={(e) => setOnlineSubLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.IETF_tag} value={l.IETF_tag}>
                    {l.flag} {l.languageName}
                  </option>
                ))}
              </select>
              <button
                className="online-sub-btn"
                onClick={handleSearchOnlineSubs}
                disabled={isSearchingOnlineSubs}
              >
                {isSearchingOnlineSubs ? 'Searching...' : 'Search'}
              </button>
            </div>
            <div
              className="online-sub-results-scroll"
              onWheel={(e) => e.stopPropagation()}
            >
              {onlineSubResults.map((s, idx) => (
                <div
                  key={idx}
                  className="online-sub-item"
                  onClick={() => handleSelectOnlineSub(s)}
                >
                  <div className="online-sub-item-name">
                    <span>{s.language || 'Subtitle'}</span>
                    <span className="online-sub-src-badge">{s.origin || 'Online'}</span>
                  </div>
                  <div className="online-sub-meta">{s.url}</div>
                </div>
              ))}
              {!isSearchingOnlineSubs && onlineSubResults.length === 0 && (
                <div className="online-sub-empty">No subtitles found. Try another query.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Diagnostics Modal ── */}
      {showDiagnostics && diagnosticsData && (
        <div
          className="player-diagnostics-card"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="player-popover-header">
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
            <button onClick={() => setShowDiagnostics(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="player-diagnostics-grid">
            <span>Codec:</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
              {diagnosticsData.codec || 'Detecting…'}
            </span>
            <span>Profile:</span>
            <span>{diagnosticsData.codec_profile || 'Unknown'}</span>
            <span>Resolution:</span>
            <span>
              {diagnosticsData.width && diagnosticsData.height
                ? `${diagnosticsData.width} × ${diagnosticsData.height}`
                : 'Detecting…'}
            </span>
            <span>FPS:</span>
            <span>{diagnosticsData.fps ? diagnosticsData.fps.toFixed(2) : 'Variable'}</span>
            <span>HW Decoder:</span>
            <span
              style={{
                color:
                  diagnosticsData.hwdec_current && diagnosticsData.hwdec_current !== 'no'
                    ? '#4ade80'
                    : '#facc15',
                fontWeight: 700,
              }}
            >
              {diagnosticsData.hwdec_current || 'auto'} (
              {diagnosticsData.hwdec_configured || 'auto'})
            </span>
            <span>Video Output:</span>
            <span>{diagnosticsData.video_output || 'gpu-next (D3D11)'}</span>
            <span>GPU Hardware:</span>
            <span style={{ color: diagnosticsData.uma_detected ? '#f59e0b' : '#38bdf8', fontWeight: 600 }}>
              {diagnosticsData.uma_detected ? 'Integrated GPU (UMA/Fast)' : 'Dedicated GPU (Discrete)'}
            </span>
            <span>Display Output:</span>
            <span style={{ color: diagnosticsData.display_hdr_active ? '#ec4899' : '#cbd5e1', fontWeight: 600 }}>
              {diagnosticsData.display_hdr_active ? 'HDR (High Dynamic Range)' : 'SDR (Standard Dynamic Range)'}
            </span>
            <span>RTX Super Res:</span>
            <span style={{
              color: diagnosticsData.gpu_video_processing_enabled
                ? '#4ade80'
                : diagnosticsData.gpu_video_processing_supported
                ? '#38bdf8'
                : '#64748b',
              fontWeight: 600,
            }}>
              {diagnosticsData.gpu_video_processing_enabled
                ? 'Active (D3D11 VPP AI Scaler)'
                : diagnosticsData.gpu_video_processing_supported
                ? 'Supported (Disabled in Settings)'
                : 'Not Supported'}
            </span>
            <span>MPV Core:</span>
            <span>{diagnosticsData.mpv_version || 'Embedded'}</span>
          </div>
        </div>
      )}

      {/* ── Playback Error Detailed Modal ── */}
      {playbackError && (
        <div className="player-fatal-error-overlay">
          <div className="player-error-modal">
            <div className="player-error-header">
              <div className="error-icon-box">
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                  Playback Error
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {playbackError.reason}
                </div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '13px', margin: '14px 0' }}>
              {playbackError.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="player-pill active"
                onClick={() => {
                  attemptedLinkIndicesRef.current.clear();
                  setCurrentLinkIndex(0);
                  setPlaybackError(null);
                }}
              >
                Retry Mirror 1
              </button>
              <button className="player-pill" onClick={handleClose}>
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subtitles Popover Menu ── */}
      {showSubMenu && (
        <div
          className="player-popover-card"
          style={{ right: '110px', width: '320px' }}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="player-popover-header">
            <span className="player-popover-title">Subtitles & Track Sync</span>
            <button onClick={() => setShowSubMenu(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Subtitle Action Buttons: Online Search & Sync delay */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="player-pill full-width"
              onClick={() => {
                setShowSubMenu(false);
                setShowOnlineSubModal(true);
              }}
            >
              <Globe size={13} />
              <span>Search Online</span>
            </button>
            <button
              className="player-pill full-width"
              onClick={() => {
                setShowSubMenu(false);
                setShowDelayModal(true);
              }}
            >
              <Clock size={13} />
              <span>Sync Delay</span>
            </button>
          </div>

          {/* Subtitles list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="popover-section-label">Subtitle Tracks</span>

            {/* Auto Track */}
            <button
              className={`player-track-item${isAutoSub ? ' active' : ''}`}
              onClick={handleSelectAutoSub}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color={isAutoSub ? '#c084fc' : '#94a3b8'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Auto Track</span>
                    <span className="cloudstream-tag">CloudStream</span>
                  </div>
                  <span style={{ fontSize: '11px', color: isAutoSub ? '#d8b4fe' : '#64748b' }}>
                    {autoSubMatch
                      ? `Active: ${autoSubMatch.resolvedName}`
                      : 'Auto-select preferred language'}
                  </span>
                </div>
              </div>
              {isAutoSub && <Check size={16} color="#a855f7" />}
            </button>

            {/* Subtitles Off */}
            <button
              className={`player-track-item${!isAutoSub && activeSid === 0 ? ' active' : ''}`}
              onClick={handleDisableSubs}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <X size={15} color={!isAutoSub && activeSid === 0 ? '#c084fc' : '#94a3b8'} />
                <span>Subtitles Off</span>
              </div>
              {!isAutoSub && activeSid === 0 && <Check size={16} color="#a855f7" />}
            </button>

            {/* Embedded and Loaded Subtitles */}
            {subTracks.map((tr) => {
              const formatted = formatTrackLabel(tr);
              const isSelected = !isAutoSub && activeSid === tr.id;
              const isAutoActive = isAutoSub && activeSid === tr.id;
              return (
                <button
                  key={tr.id}
                  className={`player-track-item${isSelected ? ' active' : ''}`}
                  onClick={() => handleSelectSubTrack(tr.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{formatted.flag}</span>
                      <span>{formatted.title}</span>
                      {isAutoActive && <span className="auto-sub-tag">Auto</span>}
                    </div>
                    {formatted.subtitle && (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {formatted.subtitle}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={16} color="#a855f7" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Audio Tracks Popover Menu ── */}
      {showAudioMenu && (
        <div
          className="player-popover-card"
          style={{ right: '80px', width: '310px' }}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="player-popover-header">
            <span className="player-popover-title">Audio Tracks</span>
            <button onClick={() => setShowAudioMenu(false)}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="popover-section-label">Available Audio Tracks</span>

            <button
              className={`player-track-item${isAutoAudio ? ' active' : ''}`}
              onClick={handleSelectAutoAudio}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color={isAutoAudio ? '#c084fc' : '#94a3b8'} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600 }}>Auto Track</span>
                  <span style={{ fontSize: '11px', color: isAutoAudio ? '#d8b4fe' : '#64748b' }}>
                    {autoAudioMatch
                      ? `Active: ${autoAudioMatch.resolvedName}`
                      : 'Auto-select preferred audio'}
                  </span>
                </div>
              </div>
              {isAutoAudio && <Check size={16} color="#a855f7" />}
            </button>

            {audioTracks.map((tr) => {
              const formatted = formatTrackLabel(tr);
              const isSelected = !isAutoAudio && activeAid === tr.id;
              return (
                <button
                  key={tr.id}
                  className={`player-track-item${isSelected ? ' active' : ''}`}
                  onClick={() => handleSelectAudioTrack(tr.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{formatted.flag}</span>
                      <span>{formatted.title}</span>
                    </div>
                    {formatted.subtitle && (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {formatted.subtitle}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={16} color="#a855f7" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Playback Settings Popover ── */}
      {showSettingsMenu && (
        <div
          className="player-popover-card"
          style={{ right: '40px', width: '290px' }}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="player-popover-header">
            <span className="player-popover-title">Playback Settings</span>
            <button onClick={() => setShowSettingsMenu(false)}>
              <X size={16} />
            </button>
          </div>

          {/* Speed */}
          <div>
            <span className="popover-section-label">Playback Speed</span>
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
            <span className="popover-section-label">Aspect Ratio / Resize Mode</span>
            <div className="player-pills-row">
              <button
                className={`player-pill${panscanVal === 0 ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_panscan', { panscan: 0.0 });
                  setPanscanVal(0);
                }}
              >
                Fit (Original)
              </button>
              <button
                className={`player-pill${panscanVal === 1 ? ' active' : ''}`}
                onClick={() => {
                  invoke('player_set_panscan', { panscan: 1.0 });
                  setPanscanVal(1);
                }}
              >
                Fill (Crop)
              </button>
            </div>
          </div>

          {/* AniSkip Auto-Skip */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 600 }}>
                Auto-Skip Intro & Outro
              </span>
              <input
                type="checkbox"
                checked={autoSkipIntroOutro}
                onChange={(e) => {
                  setAutoSkipIntroOutro(e.target.checked);
                  localStorage.setItem('player_auto_skip_intro', String(e.target.checked));
                }}
              />
            </label>
          </div>

          {/* Diagnostics toggle */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <button
              className="player-pill full-width"
              onClick={() => {
                setShowSettingsMenu(false);
                toggleDiagnostics();
              }}
            >
              <Cpu size={14} />
              <span>Show Native Diagnostics</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYER HUD ── */}
      <div className={`player-hud${showHud && !showEpisodeDrawer ? ' visible' : ''}`}>
        {/* Top bar */}
        <div className="player-top" onClick={(e) => e.stopPropagation()}>
          <div className="player-title-box">
            <button onClick={handleClose} className="player-back-btn" title="Back (Esc)">
              <ChevronLeft size={22} />
            </button>
            <div className="player-title-text">
              <div className="player-title">{item.name}</div>
              <div className="player-subtitle">
                {currentEpisode.season && `S${currentEpisode.season}:`}
                {currentEpisode.name
                  ? `${currentEpisode.name} (Ep ${currentEpisode.episode})`
                  : `Episode ${currentEpisode.episode}`}{' '}
                • {activeLink?.name || 'Default Mirror'}
              </div>
            </div>
          </div>

          {/* Top Right Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Episodes Drawer Toggle Button */}
            {hasMultipleEpisodes && (
              <button
                onClick={() => {
                  setShowEpisodeDrawer(!showEpisodeDrawer);
                  setShowServerPicker(false);
                  setShowSubMenu(false);
                  setShowAudioMenu(false);
                  setShowSettingsMenu(false);
                }}
                className={`player-hud-pill${showEpisodeDrawer ? ' active' : ''}`}
                title="Episodes List (E)"
              >
                <ListVideo size={15} />
                <span>Episodes</span>
              </button>
            )}

            {/* Server / Mirror Picker */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => {
                  setShowServerPicker(!showServerPicker);
                  setShowSubMenu(false);
                  setShowAudioMenu(false);
                  setShowSettingsMenu(false);
                  setShowEpisodeDrawer(false);
                }}
                className={`player-hud-pill player-hud-server-btn${
                  showServerPicker ? ' active' : ''
                }`}
                title="Select Server / Mirror (O)"
              >
                <Server size={14} />
                <span>{activeLink?.source || 'Servers'}</span>
              </button>

              {showServerPicker && (
                <div
                  className="player-dropdown-menu"
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="player-dropdown-title">AVAILABLE STREAM MIRRORS</div>
                  {currentLinks.map((link, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentLinkIndex(idx);
                        setShowServerPicker(false);
                      }}
                      className={`player-dropdown-item${
                        currentLinkIndex === idx ? ' active' : ''
                      }`}
                    >
                      <span>{link.name}</span>
                      <span className="player-dropdown-badge">{link.quality}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="player-bottom" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar with buffered track, AniSkip chapter markers, and hover tooltip */}
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
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />

            {/* AniSkip Visual Markers on Timeline */}
            {duration > 0 &&
              skipIntervals.map((s, idx) => {
                const left = (s.start / duration) * 100;
                const width = ((s.end - s.start) / duration) * 100;
                const isEnding = s.skip_type.toUpperCase().includes('ED');
                return (
                  <div
                    key={idx}
                    className={`player-timeline-skip-marker${isEnding ? ' ending' : ' opening'}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${s.skip_type} (${formatTime(s.start)} - ${formatTime(s.end)})`}
                  />
                );
              })}

            {/* Hover tooltip */}
            {hoverTime !== null && (
              <div className="player-timeline-tooltip" style={{ left: `${hoverPercent}%` }}>
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Controls row */}
          <div className="player-controls-row">
            {/* Left group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Previous Episode */}
              {hasMultipleEpisodes && (
                <button
                  className="player-ctrl-btn"
                  onClick={() => prevEp && handleSwitchEpisode(prevEp)}
                  disabled={!hasPrevEp || isExtractingEpisode}
                  title="Previous Episode (P)"
                >
                  <SkipBack size={19} />
                </button>
              )}

              {/* Play / Pause */}
              <button className="player-ctrl-btn primary" onClick={togglePlay}>
                {isPlaying ? <Pause size={22} /> : <Play size={22} fill="#fff" />}
              </button>

              {/* Next Episode */}
              {hasMultipleEpisodes && (
                <button
                  className="player-ctrl-btn"
                  onClick={() => nextEp && handleSwitchEpisode(nextEp)}
                  disabled={!hasNextEp || isExtractingEpisode}
                  title="Next Episode (N)"
                >
                  <SkipForward size={19} />
                </button>
              )}

              {/* Volume */}
              {/* Volume */}
              <div className="player-volume-row">
                <button
                  className="player-ctrl-btn"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={19} />
                  ) : (
                    <Volume2 size={19} />
                  )}
                </button>
                <input
                  type="range"
                  className="player-volume-slider"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  style={{
                    background: `linear-gradient(to right, #9333ea 0%, #9333ea ${
                      (isMuted ? 0 : volume) * 100
                    }%, rgba(255, 255, 255, 0.22) ${
                      (isMuted ? 0 : volume) * 100
                    }%, rgba(255, 255, 255, 0.22) 100%)`,
                  }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Aspect ratio quick toggle */}
              <button
                className="player-ctrl-btn"
                onClick={togglePanscan}
                title="Toggle Aspect Ratio / Crop (Z)"
              >
                <Crop size={19} />
              </button>

              {/* Subtitles */}
              <button
                className="player-ctrl-btn"
                onClick={() => {
                  setShowSubMenu(!showSubMenu);
                  setShowAudioMenu(false);
                  setShowSettingsMenu(false);
                  setShowServerPicker(false);
                  setShowEpisodeDrawer(false);
                }}
                title="Subtitles & Sync (S)"
                style={{
                  background:
                    showSubMenu || activeSid !== 0 ? 'rgba(168, 85, 247, 0.28)' : undefined,
                  color: showSubMenu || activeSid !== 0 ? '#c084fc' : undefined,
                }}
              >
                <Subtitles size={19} />
              </button>

              {/* Audio Tracks */}
              <button
                className="player-ctrl-btn"
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowSubMenu(false);
                  setShowSettingsMenu(false);
                  setShowServerPicker(false);
                  setShowEpisodeDrawer(false);
                }}
                title="Audio Tracks (A)"
                style={{
                  background: showAudioMenu ? 'rgba(168, 85, 247, 0.28)' : undefined,
                  color: showAudioMenu ? '#c084fc' : undefined,
                }}
              >
                <Headphones size={19} />
              </button>

              {/* Playback Settings */}
              <button
                className="player-ctrl-btn"
                onClick={() => {
                  setShowSettingsMenu(!showSettingsMenu);
                  setShowSubMenu(false);
                  setShowAudioMenu(false);
                  setShowServerPicker(false);
                  setShowEpisodeDrawer(false);
                }}
                title="Playback Settings"
                style={{
                  background: showSettingsMenu ? 'rgba(168, 85, 247, 0.28)' : undefined,
                  color: showSettingsMenu ? '#c084fc' : undefined,
                }}
              >
                <Sliders size={19} />
              </button>

              {/* Fullscreen */}
              <button
                className="player-ctrl-btn"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
