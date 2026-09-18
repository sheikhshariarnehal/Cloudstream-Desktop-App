import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Episode,
  ExtractorLink,
  LoadResponse,
  SearchResponse,
  WatchHistoryItem,
  WatchlistItem,
  DubStatus,
  DownloadRequest,
  DownloadItem,
  DownloadProgressPayload,
} from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Check,
  Search,
  Bookmark,
  ChevronDown,
  Video,
  X,
  Share2,
  AlertCircle,
  Radio,
  Download,
} from 'lucide-react';
import { CloudStreamDeviceIcon, DownloadPieClock, WatchPlayProgress, formatByteSize } from '../screens/DownloadsScreen';
import { track, trackScreen } from '../utils/openpulse';

interface DetailModalProps {
  item: SearchResponse;
  onClose: () => void;
  onPlay: (
    item: SearchResponse,
    episode: Episode,
    links: ExtractorLink[],
    allEpisodes?: Episode[],
    mediaDetails?: LoadResponse,
    startTime?: number
  ) => void;
  onSelectItem?: (item: SearchResponse) => void;
  isPlayerActive?: boolean;
}

const WATCHLIST_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  watching: { label: 'Watching', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.18)' },
  plan_to_watch: { label: 'Plan to Watch', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.18)' },
  completed: { label: 'Completed', color: '#34d399', bg: 'rgba(16, 185, 129, 0.18)' },
  on_hold: { label: 'On Hold', color: '#a78bfa', bg: 'rgba(139, 92, 246, 0.18)' },
  dropped: { label: 'Dropped', color: '#f87171', bg: 'rgba(239, 68, 68, 0.18)' },
};

// Global in-memory cache for media details to avoid refetching on modal reopen or back navigation
const mediaDetailCache = new Map<string, { data: LoadResponse; timestamp: number }>();

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onPlay,
  onSelectItem,
  isPlayerActive,
}) => {
  const cacheKey = `${item.api_name}_${item.url}`;
  const initialCached = mediaDetailCache.get(cacheKey);

  const [details, setDetails] = useState<LoadResponse | null>(() => {
    return initialCached ? initialCached.data : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !initialCached;
  });
  const [error, setError] = useState<string | null>(null);

  // Watch History & Progress
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [allWatchHistory, setAllWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Watchlist State
  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // OpenPulse Telemetry: Track Details Screen View
  useEffect(() => {
    trackScreen('/details', {
      title: item.name,
      provider: item.api_name,
      tv_type: item.tv_type,
    });
    track('details_open', {
      title: item.name,
      provider: item.api_name,
      tv_type: item.tv_type,
    });
  }, [item.url]);

  // Downloads State (CloudStream Offline Parity)
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  // Local Watched Map (fallback / quick toggle from Downloads screen)
  const [localWatchedMap, setLocalWatchedMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('cloudstream_watched_episodes');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Stream Extraction State
  const [extractingKey, setExtractingKey] = useState<string | null>(null);
  const [downloadingKeys, setDownloadingKeys] = useState<Record<string, 'extracting' | 'queued' | 'done'>>({});

  // Season & Controls
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const [activeDub, setActiveDub] = useState<DubStatus>('Subbed');
  const [searchQuery, setSearchQuery] = useState('');

  // Trailer Modal State
  const [activeTrailerUrl, setActiveTrailerUrl] = useState<string | null>(null);

  // Effective TvType & Series Flags (CloudStream Parity)
  const effectiveTvType = details?.tv_type || item.tv_type;
  const isMovie =
    effectiveTvType === 'Movie' ||
    effectiveTvType === 'AnimeMovie' ||
    effectiveTvType === 'Torrent' ||
    effectiveTvType === 'LiveStream';

  const isAnime = effectiveTvType === 'Anime' || effectiveTvType === 'OVA';

  // CloudStream Type Label Architecture
  const typeLabel = useMemo(() => {
    switch (effectiveTvType) {
      case 'TvSeries':
        return 'TV Series';
      case 'Anime':
        return 'Anime';
      case 'AnimeMovie':
        return 'Anime Movie';
      case 'OVA':
        return 'OVA';
      case 'Cartoon':
        return 'Cartoon';
      case 'AsianDrama':
        return 'Asian Drama';
      case 'Documentary':
        return 'Documentary';
      case 'Movie':
        return 'Movie';
      case 'Torrent':
        return 'Torrent';
      case 'LiveStream':
        return 'Live Stream';
      default:
        return isMovie ? 'Movie' : 'TV Series';
    }
  }, [effectiveTvType, isMovie]);

  // Load Media Details, Watch History, Watchlist, and Downloads
  const fetchDetails = useCallback(async (forceRefresh = false) => {
    const key = `${item.api_name}_${item.url}`;
    const cached = mediaDetailCache.get(key);
    const isCacheValid = cached && Date.now() - cached.timestamp < 10 * 60 * 1000;

    if (!forceRefresh && cached) {
      setDetails(cached.data);
      setLoading(false);
      setError(null);
    } else if (!cached) {
      setLoading(true);
      setError(null);
    }

    try {
      try {
        const raw = localStorage.getItem('cloudstream_watched_episodes');
        if (raw) setLocalWatchedMap(JSON.parse(raw));
      } catch {}

      const [res, history, fullHistory, watchlist, dlItems] = await Promise.all([
        !forceRefresh && isCacheValid
          ? Promise.resolve(cached!.data)
          : invoke<LoadResponse>('load_media', {
              provider: item.api_name,
              url: item.url,
            }).then((data) => {
              mediaDetailCache.set(key, { data, timestamp: Date.now() });
              return data;
            }),
        invoke<WatchHistoryItem[]>('get_media_watch_history', {
          mediaId: item.url,
          title: item.name,
        }).catch(() => [] as WatchHistoryItem[]),
        invoke<WatchHistoryItem[]>('get_watch_history', {
          limit: 1000,
        }).catch(() => [] as WatchHistoryItem[]),
        invoke<WatchlistItem[]>('get_watchlist').catch(
          () => [] as WatchlistItem[]
        ),
        invoke<DownloadItem[]>('get_downloads').catch(
          () => [] as DownloadItem[]
        ),
      ]);

      setDetails(res);
      setWatchHistory(history);
      setAllWatchHistory(fullHistory);
      setDownloads(dlItems);

      const match = watchlist.find((w) => w.media_id === item.url);
      setWatchlistStatus(match ? match.status : null);

      // Determine anime initial dub
      if (res.episodes && res.episodes.length > 0) {
        const availableDubs = Array.from(
          new Set(
            res.episodes
              .map((e) => e.dub_status)
              .filter((d): d is DubStatus => Boolean(d))
          )
        );
        if (availableDubs.includes('Subbed')) {
          setActiveDub('Subbed');
        } else if (availableDubs.length > 0) {
          setActiveDub(availableDubs[0]);
        }

        // Determine initial season:
        // 1. Check if a season was previously selected in this session
        // 2. Check if watch history indicates a recently watched season
        // 3. Default to the first available season
        const availableSeasons = Array.from(
          new Set(res.episodes.map((e) => e.season || 1))
        );
        let targetSeason = res.episodes[0].season || 1;

        try {
          const savedSeasonStr = sessionStorage.getItem(`cloudstream_detail_season_${item.url}`);
          const savedSeason = savedSeasonStr ? parseInt(savedSeasonStr, 10) : NaN;
          if (!isNaN(savedSeason) && availableSeasons.includes(savedSeason)) {
            targetSeason = savedSeason;
          } else {
            const currentMediaTitle = (res.name || item.name || '').trim().toLowerCase();
            const combinedHist = [...history, ...fullHistory].filter((h) => {
              return (
                h.media_id === item.url ||
                h.media_id === (res.url || '') ||
                (h.title && currentMediaTitle && h.title.trim().toLowerCase() === currentMediaTitle)
              );
            }).sort((a, b) => (b.last_watched_at || 0) - (a.last_watched_at || 0));
            const historySeason = combinedHist[0]?.season_num;
            if (historySeason && availableSeasons.includes(historySeason)) {
              targetSeason = historySeason;
            }
          }
        } catch {}

        setSelectedSeason(targetSeason);
      }
    } catch (err) {
      console.error('Failed to load media details:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time listener for download progress and status
  useEffect(() => {
    const unlistenProgress = listen<DownloadProgressPayload>('download-progress', (event) => {
      const payload = event.payload;
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === payload.id
            ? {
                ...d,
                downloaded_bytes: payload.downloaded_bytes,
                total_bytes: payload.total_bytes > 0 ? payload.total_bytes : d.total_bytes,
                progress_pct: payload.progress_pct,
                status: payload.status as any,
              }
            : d
        )
      );
    });

    const unlistenStatus = listen('download-status', () => {
      invoke<DownloadItem[]>('get_downloads')
        .then(setDownloads)
        .catch(() => {});
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenStatus.then((f) => f());
    };
  }, []);

  // Sync selected season to session storage for seamless return from player
  useEffect(() => {
    if (selectedSeason) {
      try {
        sessionStorage.setItem(`cloudstream_detail_season_${item.url}`, String(selectedSeason));
      } catch {}
    }
  }, [selectedSeason, item.url]);

  const handleModalClose = useCallback(() => {
    try {
      sessionStorage.removeItem(`cloudstream_detail_season_${item.url}`);
    } catch {}
    onClose();
  }, [item.url, onClose]);

  // Keyboard Escape Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlayerActive) return;
      if (e.key === 'Escape') {
        if (activeTrailerUrl) {
          setActiveTrailerUrl(null);
        } else {
          handleModalClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleModalClose, activeTrailerUrl, isPlayerActive]);

  // When returning from player, refresh watch progress immediately
  useEffect(() => {
    if (!isPlayerActive) {
      window.dispatchEvent(new CustomEvent('cloudstream-watch-progress-saved'));
    }
  }, [isPlayerActive]);

  // Find downloaded item matching an episode
  const getDownloadedItemForEpisode = useCallback(
    (ep: Episode): DownloadItem | undefined => {
      const s = ep.season || 1;
      const e = ep.episode;
      const epNameClean = (ep.name || '').trim().toLowerCase();
      const currentMediaTitle = (details?.name || item.name || '').trim().toLowerCase();

      // Find downloads belonging to this media
      const mediaDownloads = downloads.filter((d) => {
        if (d.parent_id && (d.parent_id === item.url || d.parent_id === details?.url)) return true;
        if (d.id && (d.id.includes(item.url) || (details?.url && d.id.includes(details.url)))) return true;
        if (d.media_title && currentMediaTitle && d.media_title.trim().toLowerCase() === currentMediaTitle) return true;
        return false;
      });

      // 1. Try match by season & episode num
      const numMatches = mediaDownloads.filter(
        (d) => (d.season_num ?? 1) === s && (d.episode_num ?? 1) === e
      );

      if (numMatches.length === 1) {
        return numMatches[0];
      }

      if (numMatches.length > 1) {
        if (epNameClean) {
          const exact = numMatches.find(
            (d) => (d.episode_title || '').trim().toLowerCase() === epNameClean
          );
          if (exact) return exact;
          const partial = numMatches.find((d) => {
            const dt = (d.episode_title || '').trim().toLowerCase();
            return dt.includes(epNameClean) || epNameClean.includes(dt);
          });
          if (partial) return partial;
        }
        return numMatches[0];
      }

      // 2. Try match by episode title
      if (epNameClean) {
        const titleMatch = mediaDownloads.find((d) => {
          const dt = (d.episode_title || '').trim().toLowerCase();
          return dt === epNameClean || dt.includes(epNameClean) || epNameClean.includes(dt);
        });
        if (titleMatch) return titleMatch;
      }

      return undefined;
    },
    [downloads, details, item]
  );

  // Count & total size of completed downloaded episodes for this media
  const { downloadedCount, totalDownloadedBytes } = useMemo(() => {
    const currentMediaTitle = (details?.name || item.name || '').trim().toLowerCase();
    const mediaDownloads = downloads.filter((d) => {
      if (d.status !== 'completed') return false;
      if (d.parent_id && (d.parent_id === item.url || d.parent_id === details?.url)) return true;
      if (d.id && (d.id.includes(item.url) || (details?.url && d.id.includes(details.url)))) return true;
      if (d.media_title && currentMediaTitle && d.media_title.trim().toLowerCase() === currentMediaTitle) return true;
      return false;
    });

    const seen = new Set<string>();
    let count = 0;
    let bytes = 0;
    for (const d of mediaDownloads) {
      const key = `${d.season_num ?? 1}_${d.episode_num ?? 1}`;
      if (!seen.has(key)) {
        seen.add(key);
        count++;
        bytes += d.total_bytes > 0 ? d.total_bytes : d.downloaded_bytes;
      }
    }
    return { downloadedCount: count, totalDownloadedBytes: bytes };
  }, [downloads, details, item]);

  // Real-time Watch History Sync
  useEffect(() => {
    const refreshWatchHistory = async () => {
      try {
        const [history, fullHistory] = await Promise.all([
          invoke<WatchHistoryItem[]>('get_media_watch_history', {
            mediaId: item.url,
            title: item.name,
          }).catch(() => [] as WatchHistoryItem[]),
          invoke<WatchHistoryItem[]>('get_watch_history', {
            limit: 1000,
          }).catch(() => [] as WatchHistoryItem[]),
        ]);
        setWatchHistory(history);
        setAllWatchHistory(fullHistory);
      } catch (err) {
        console.error('Failed to refresh watch history in DetailModal:', err);
      }
    };

    const interval = setInterval(refreshWatchHistory, 2500);
    window.addEventListener('focus', refreshWatchHistory);
    window.addEventListener('cloudstream-watch-progress-saved', refreshWatchHistory);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshWatchHistory);
      window.removeEventListener('cloudstream-watch-progress-saved', refreshWatchHistory);
    };
  }, [item]);

  // Compute watch progress for an episode
  const getWatchProgressForEpisode = useCallback(
    (ep: Episode) => {
      const s = ep.season || 1;
      const e = ep.episode;
      const epNameClean = (ep.name || '').trim().toLowerCase();
      const currentMediaTitle = (details?.name || item.name || '').trim().toLowerCase();
      const dlItem = getDownloadedItemForEpisode(ep);

      const combinedHistory = [...watchHistory, ...allWatchHistory];
      const match = combinedHistory.find((h) => {
        const isSameMedia =
          h.media_id === item.url ||
          h.media_id === (details?.url || '') ||
          (dlItem && (
            h.media_id === dlItem.id ||
            h.media_id === dlItem.url ||
            h.media_id === dlItem.file_path ||
            h.media_id === dlItem.parent_id
          )) ||
          (h.title && currentMediaTitle && h.title.trim().toLowerCase() === currentMediaTitle) ||
          (h.title && currentMediaTitle && (h.title.toLowerCase().includes(currentMediaTitle) || currentMediaTitle.includes(h.title.toLowerCase())));

        if (!isSameMedia) return false;

        const hSeason = h.season_num ?? 1;
        const hEpisode = h.episode_num ?? 1;
        if (hSeason === s && hEpisode === e) {
          return true;
        }

        if (epNameClean && h.episode_name) {
          const hEpClean = h.episode_name.trim().toLowerCase();
          if (hEpClean === epNameClean || hEpClean.includes(epNameClean) || epNameClean.includes(hEpClean)) {
            return true;
          }
        }

        return false;
      });

      if (match && match.duration_ms > 0) {
        const isCompleted =
          match.is_completed ||
          (match.position_ms / match.duration_ms >= 0.95);

        const percent = isCompleted
          ? 100
          : Math.min(100, Math.max(1, Math.round((match.position_ms / match.duration_ms) * 100)));

        const remainingSeconds = Math.max(0, Math.round((match.duration_ms - match.position_ms) / 1000));
        const remainingMinutes = Math.ceil(remainingSeconds / 60);

        if (
          (dlItem && localWatchedMap[dlItem.id] === true) ||
          localWatchedMap[`${s}_${e}`] === true
        ) {
          return {
            isCompleted: true,
            percent: 100,
            remainingMinutes: 0,
            positionMs: match.position_ms,
            durationMs: match.duration_ms,
          };
        }

        return {
          isCompleted,
          percent,
          remainingMinutes,
          positionMs: match.position_ms,
          durationMs: match.duration_ms,
        };
      }

      // Quick toggle fallback from localStorage if no SQLite record exists
      if (dlItem && localWatchedMap[dlItem.id] === true) {
        return { isCompleted: true, percent: 100, remainingMinutes: 0, positionMs: 100000, durationMs: 100000 };
      }
      const epKey = `${s}_${e}`;
      if (localWatchedMap[epKey] === true) {
        return { isCompleted: true, percent: 100, remainingMinutes: 0, positionMs: 100000, durationMs: 100000 };
      }

      return { isCompleted: false, percent: 0, remainingMinutes: 0, positionMs: 0, durationMs: 0 };
    },
    [watchHistory, allWatchHistory, localWatchedMap, details, item, getDownloadedItemForEpisode]
  );

  // Most recent watched item for Resume
  const resumeItem = useMemo(() => {
    const currentMediaTitle = (details?.name || item.name || '').trim().toLowerCase();
    const combinedHistory = [...watchHistory, ...allWatchHistory];
    const matchingHistory = combinedHistory.filter((h) => {
      const isSameMedia =
        h.media_id === item.url ||
        h.media_id === (details?.url || '') ||
        (h.title && currentMediaTitle && h.title.trim().toLowerCase() === currentMediaTitle) ||
        (h.title && currentMediaTitle && (h.title.toLowerCase().includes(currentMediaTitle) || currentMediaTitle.includes(h.title.toLowerCase())));
      return isSameMedia;
    });

    if (matchingHistory.length === 0) return null;
    return [...matchingHistory].sort((a, b) => b.last_watched_at - a.last_watched_at)[0];
  }, [watchHistory, allWatchHistory, details, item]);

  // Handle Play Episode / Movie (with instant offline playback support)
  const handlePlayEpisode = async (ep: Episode) => {
    const dlItem = getDownloadedItemForEpisode(ep);
    const watchProgress = getWatchProgressForEpisode(ep);

    const startTime =
      watchProgress.positionMs > 3000 &&
      !watchProgress.isCompleted &&
      (watchProgress.durationMs === 0 || watchProgress.positionMs / watchProgress.durationMs < 0.95)
        ? watchProgress.positionMs / 1000
        : undefined;

    // OFFLINE PLAYBACK: If this episode is already downloaded, play the local file instantly!
    if (dlItem && dlItem.status === 'completed' && dlItem.file_path) {
      const offlineLink: ExtractorLink = {
        source: 'Offline',
        name: 'Offline Media',
        url: dlItem.file_path,
        referer: '',
        quality: 'Quality1080p',
        is_m3u8: dlItem.file_path.endsWith('.m3u8') || dlItem.file_path.endsWith('.ts'),
        is_dash: false,
        headers: {},
      };
      setActiveTrailerUrl(null);
      onPlay(item, ep, [offlineLink], details?.episodes, details || undefined, startTime);
      return;
    }

    const epKey = `${ep.season || 1}_${ep.episode}`;
    setExtractingKey(epKey);
    try {
      const links: ExtractorLink[] = await invoke('load_links', {
        provider: item.api_name,
        data: ep.data,
      });
      if (links && links.length > 0) {
        setActiveTrailerUrl(null);
        onPlay(item, ep, links, details?.episodes, details || undefined, startTime);
      } else {
        alert('No playable links found for this source.');
      }
    } catch (err) {
      console.error('Failed to extract stream links:', err);
      alert('Error extracting video links: ' + err);
    } finally {
      setExtractingKey(null);
    }
  };

  // Handle Quick Toggle Watched State (CloudStream Parity)
  const handleToggleWatched = async (ep: Episode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const epKey = `${ep.season || 1}_${ep.episode}`;
    const watchStatus = getWatchProgressForEpisode(ep);
    const nextWatched = !watchStatus.isCompleted;

    // 1. Update localStorage
    const dlItem = getDownloadedItemForEpisode(ep);
    setLocalWatchedMap((prev) => {
      const next = { ...prev, [epKey]: nextWatched };
      if (dlItem) next[dlItem.id] = nextWatched;
      try {
        localStorage.setItem('cloudstream_watched_episodes', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Persist to SQLite
    try {
      const histItem: WatchHistoryItem = {
        media_id: item.url,
        provider_id: item.api_name,
        title: details?.name || item.name,
        poster_url: details?.poster_url || item.poster_url,
        tv_type: (effectiveTvType as any) || 'TvSeries',
        episode_num: ep.episode,
        season_num: ep.season || 1,
        episode_name: ep.name,
        position_ms: nextWatched ? 100000 : 0,
        duration_ms: nextWatched ? 100000 : 0,
        last_watched_at: Date.now(),
        is_completed: nextWatched,
      };
      await invoke('save_watch_progress', { item: histItem });
      const [history, updated] = await Promise.all([
        invoke<WatchHistoryItem[]>('get_media_watch_history', {
          mediaId: item.url,
          title: item.name,
        }).catch(() => [] as WatchHistoryItem[]),
        invoke<WatchHistoryItem[]>('get_watch_history', { limit: 1000 }).catch(() => [] as WatchHistoryItem[]),
      ]);
      setWatchHistory(history);
      setAllWatchHistory(updated);
      window.dispatchEvent(new CustomEvent('cloudstream-watch-progress-saved'));
    } catch (err) {
      console.warn('Could not persist watch progress to SQLite:', err);
    }
  };

  // Handle Download Episode (CloudStream Parity)
  const handleDownloadEpisode = async (ep: Episode) => {
    const epKey = `${ep.season || 1}_${ep.episode}`;
    setDownloadingKeys((prev) => ({ ...prev, [epKey]: 'extracting' }));

    try {
      const links: ExtractorLink[] = await invoke('load_links', {
        provider: item.api_name,
        data: ep.data,
      });

      if (!links || links.length === 0) {
        alert('No downloadable stream links found for this source.');
        setDownloadingKeys((prev) => {
          const next = { ...prev };
          delete next[epKey];
          return next;
        });
        return;
      }

      // Sort links by quality descending (1080 > 720 > 480 etc.)
      const qualityScore = (q?: any): number => {
        const str = String(q || '');
        if (str.includes('4K')) return 2160;
        if (str.includes('1080')) return 1080;
        if (str.includes('720')) return 720;
        if (str.includes('480')) return 480;
        if (str.includes('360')) return 360;
        return 100;
      };
      const sortedLinks = [...links].sort((a, b) => qualityScore(b.quality) - qualityScore(a.quality));
      const chosenLink = sortedLinks[0];

      const parentId = item.url;
      const downloadId = `${item.api_name}_${item.url}_s${ep.season || 1}_e${ep.episode}`;

      const request: DownloadRequest = {
        id: downloadId,
        parent_id: parentId,
        url: chosenLink.url,
        source_api: item.api_name,
        media_title: details?.name || item.name,
        episode_title: ep.name || (ep.episode ? `Episode ${ep.episode}` : undefined),
        episode_num: ep.episode,
        season_num: ep.season || 1,
        tv_type: details?.tv_type || item.tv_type || 'Movie',
        poster_url: details?.poster_url || item.poster_url,
        headers: chosenLink.headers,
      };

      await invoke('start_download', { request });
      setDownloadingKeys((prev) => ({ ...prev, [epKey]: 'queued' }));
      setTimeout(() => {
        setDownloadingKeys((prev) => {
          const next = { ...prev };
          delete next[epKey];
          return next;
        });
      }, 3500);
    } catch (err) {
      console.error('Failed to start download:', err);
      alert('Error starting download: ' + err);
      setDownloadingKeys((prev) => {
        const next = { ...prev };
        delete next[epKey];
        return next;
      });
    }
  };

  // Handle Watchlist Status Change
  const handleSetWatchlistStatus = async (status: string | null) => {
    setShowStatusDropdown(false);
    try {
      if (!status) {
        await invoke('remove_watchlist_item', { mediaId: item.url });
        setWatchlistStatus(null);
      } else {
        await invoke('set_watchlist_item', {
          item: {
            media_id: item.url,
            provider_id: item.api_name,
            title: details?.name || item.name,
            poster_url: details?.poster_url || item.poster_url,
            tv_type: details?.tv_type || item.tv_type,
            status,
            score: details?.score || item.score,
            added_at: Date.now(),
          },
        });
        setWatchlistStatus(status);
      }
    } catch (e) {
      console.error('Failed to update watchlist status:', e);
    }
  };

  // Available Dubs for Anime
  const availableDubs = useMemo(() => {
    if (!details?.episodes) return [];
    return Array.from(
      new Set(
        details.episodes
          .map((e) => e.dub_status)
          .filter((d): d is DubStatus => Boolean(d))
      )
    );
  }, [details]);

  // Filter episodes by DubStatus if anime
  const dubFilteredEpisodes = useMemo(() => {
    if (!details?.episodes) return [];
    if (!isAnime || availableDubs.length <= 1) return details.episodes;
    const filtered = details.episodes.filter(
      (e) => (e.dub_status || 'Subbed') === activeDub
    );
    return filtered.length > 0 ? filtered : details.episodes;
  }, [details, isAnime, availableDubs, activeDub]);

  // Group seasons
  const seasons = useMemo(() => {
    if (!dubFilteredEpisodes || dubFilteredEpisodes.length === 0) return [1];
    return Array.from(
      new Set(dubFilteredEpisodes.map((e) => e.season || 1))
    ).sort((a, b) => a - b);
  }, [dubFilteredEpisodes]);

  // Season Display Label helper
  const getSeasonLabel = useCallback(
    (sNum: number) => {
      if (details?.season_names) {
        const found = details.season_names.find((sn) => sn.season === sNum);
        if (found) {
          if (found.name && found.display_season) {
            return `Season ${found.display_season} - ${found.name}`;
          }
          if (found.name) return found.name;
          if (found.display_season) return `Season ${found.display_season}`;
        }
      }
      return `Season ${sNum}`;
    },
    [details]
  );

  // Episodes for active season
  const currentSeasonEpisodes = useMemo(() => {
    return dubFilteredEpisodes.filter(
      (e) => (e.season || 1) === selectedSeason
    );
  }, [dubFilteredEpisodes, selectedSeason]);

  // Filtered by Search
  const displayEpisodes = useMemo(() => {
    let list = [...currentSeasonEpisodes];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.episode.toString() === q ||
          `ep ${e.episode}`.includes(q) ||
          `episode ${e.episode}`.includes(q) ||
          (e.name && e.name.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => a.episode - b.episode);
    return list;
  }, [currentSeasonEpisodes, searchQuery]);

  // Previous / Next Season Handlers
  const currentSeasonIndex = seasons.indexOf(selectedSeason);
  const handlePrevSeason = () => {
    if (currentSeasonIndex > 0) {
      setSelectedSeason(seasons[currentSeasonIndex - 1]);
    }
  };
  const handleNextSeason = () => {
    if (currentSeasonIndex < seasons.length - 1) {
      setSelectedSeason(seasons[currentSeasonIndex + 1]);
    }
  };

  // Primary Action Button calculation
  const primaryCTA = useMemo(() => {
    if (!details) return null;

    if (isMovie) {
      const ep = details.episodes[0] || {
        episode: 1,
        season: 1,
        data: details.url,
        name: details.name,
      };
      const dl = getDownloadedItemForEpisode(ep);
      const isDl = Boolean(dl && dl.status === 'completed' && dl.file_path);

      if (
        resumeItem &&
        !resumeItem.is_completed &&
        resumeItem.position_ms > 0 &&
        resumeItem.duration_ms > 0
      ) {
        const remainingMs = Math.max(
          0,
          resumeItem.duration_ms - resumeItem.position_ms
        );
        const remainingMins = Math.max(1, Math.round(remainingMs / 60000));
        const percent = Math.min(
          100,
          Math.round((resumeItem.position_ms / resumeItem.duration_ms) * 100)
        );
        return {
          label: `Resume Movie (${remainingMins}m left${isDl ? ' • Offline' : ''})`,
          progress: percent,
          episode: ep,
          isOffline: isDl,
        };
      }

      return {
        label: isDl ? 'Play Movie (Offline Ready)' : 'Play Movie',
        progress: null,
        episode: ep,
        isOffline: isDl,
      };
    }

    if (resumeItem) {
      const match = details.episodes.find(
        (e) =>
          (e.season || 1) === (resumeItem.season_num || 1) &&
          e.episode === resumeItem.episode_num
      );
      if (match) {
        const sNum = resumeItem.season_num || 1;
        const eNum = resumeItem.episode_num || 1;
        const dl = getDownloadedItemForEpisode(match);
        const isDl = Boolean(dl && dl.status === 'completed' && dl.file_path);

        if (!resumeItem.is_completed && resumeItem.position_ms > 0) {
          const remainingMs = Math.max(
            0,
            resumeItem.duration_ms - resumeItem.position_ms
          );
          const remainingMins = Math.max(1, Math.round(remainingMs / 60000));
          const percent = Math.min(
            100,
            Math.round(
              (resumeItem.position_ms / resumeItem.duration_ms) * 100
            )
          );
          return {
            label: `Resume S${sNum}:E${eNum} (${remainingMins}m left${isDl ? ' • Offline' : ''})`,
            progress: percent,
            episode: match,
            isOffline: isDl,
          };
        } else {
          return {
            label: `Play S${sNum}:E${eNum}${isDl ? ' (Offline Ready)' : ''}`,
            progress: null,
            episode: match,
            isOffline: isDl,
          };
        }
      }
    }

    const firstEp = details.episodes[0];
    if (firstEp) {
      const dl = getDownloadedItemForEpisode(firstEp);
      const isDl = Boolean(dl && dl.status === 'completed' && dl.file_path);
      return {
        label: `Play S${firstEp.season || 1}:E${firstEp.episode}${isDl ? ' (Offline Ready)' : ''}`,
        progress: null,
        episode: firstEp,
        isOffline: isDl,
      };
    }

    return null;
  }, [details, isMovie, resumeItem, getDownloadedItemForEpisode]);

  // Trailer URL formatter
  const getEmbedTrailerUrl = (url: string) => {
    if (url.includes('youtube.com/watch?v=')) {
      const id = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
    }
    return url;
  };

  // Series Episode / Season stats (CloudStream Parity)
  const seriesStats = useMemo(() => {
    if (!details?.episodes || details.episodes.length === 0) {
      return { totalEpisodes: 0, seasonCount: 0, detailLabel: '' };
    }
    const totalEpisodes = details.episodes.length;
    const seasonCount = seasons.length;
    const detailLabel =
      seasonCount > 1
        ? `${seasonCount} Seasons • ${totalEpisodes} Episodes`
        : `${totalEpisodes} Episodes`;
    return { totalEpisodes, seasonCount, detailLabel };
  }, [details, seasons]);

  // Plot Expansion State
  const [plotExpanded, setPlotExpanded] = useState(false);

  // Formatted Duration (e.g. "1h 48m" or "45m")
  const formattedDuration = useMemo(() => {
    if (!details?.duration_minutes || details.duration_minutes <= 0) return null;
    const mins = details.duration_minutes;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) {
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${m}m`;
  }, [details]);

  // Year fallback (CloudStream ResultViewModel2 logic)
  const displayYear = useMemo(() => {
    if (details?.year) return details.year;
    if (item.year) return item.year;
    const match = (details?.name || item.name || '').match(/\b(19\d\d|20\d\d)\b/);
    if (match) return parseInt(match[1], 10);
    const epRelease = details?.episodes?.[0]?.release_date;
    if (epRelease) {
      const yrMatch = epRelease.match(/\b(19\d\d|20\d\d)\b/);
      if (yrMatch) return parseInt(yrMatch[1], 10);
    }
    return null;
  }, [details, item]);

  // Score fallback
  const displayScore = useMemo(() => {
    if (details?.score !== undefined && details.score !== null) return details.score;
    if (item.score !== undefined && item.score !== null) return item.score;
    return null;
  }, [details, item]);

  // Show status (from EngineServer EpisodeResponse.showStatus)
  const displayStatus = useMemo(() => {
    if (details?.show_status) return details.show_status;
    return null;
  }, [details]);

  // Next Airing Countdown text
  const nextAiringText = useMemo(() => {
    if (!details?.next_airing) return null;
    const { episode, unix_time } = details.next_airing;
    const diffMs = unix_time * 1000 - Date.now();
    if (diffMs <= 0) return `Episode ${episode} releasing soon!`;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let timeStr = '';
    if (days > 0) timeStr += `${days}d `;
    if (hours > 0 || days > 0) timeStr += `${hours}h `;
    timeStr += `${mins}m`;

    return `Episode ${episode} airs in ${timeStr}`;
  }, [details]);

  return (
    <div className="stremio-detail-overlay">
      {/* Background Fullscreen Backdrop with Vignette */}
      {details && (
        <div className="stremio-backdrop-container">
          <img
            src={details.background_poster_url || details.poster_url}
            alt={details.name}
            className="stremio-backdrop-image"
          />
          <div className="stremio-backdrop-vignette" />
        </div>
      )}

      {/* Top Floating App Bar */}
      <div className="stremio-top-bar">
        <button
          className="stremio-back-icon-btn"
          onClick={handleModalClose}
          title="Back (Esc)"
        >
          <ChevronLeft size={26} />
        </button>

        <div className="stremio-top-bar-actions">
          {item.api_name && (
            <span className="stremio-provider-tag">{item.api_name}</span>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      {loading ? (
        <div className="stremio-detail-loading">
          <div className="stremio-loading-spinner" />
          <span>Loading {item.name}...</span>
        </div>
      ) : error ? (
        <div className="stremio-detail-error">
          <AlertCircle size={48} color="#ef4444" />
          <h2>Failed to load media</h2>
          <p>{error}</p>
          <button className="stremio-retry-btn" onClick={() => fetchDetails(true)}>
            Retry
          </button>
        </div>
      ) : details ? (
        isMovie ? (
          /* ================= MOVIE HERO CINEMATIC LAYOUT ================= */
          <div className="stremio-detail-layout movie-mode">
            <div className="stremio-movie-hero-section">
              {/* Main Stylized Title */}
              <h1 className="stremio-media-title">{details.name}</h1>

              {/* Japanese/English Alt Title */}
              {(details.jap_name || details.eng_name) && (
                <div className="stremio-alt-title">
                  {details.jap_name}
                  {details.eng_name && details.eng_name !== details.name && (
                    <span> • {details.eng_name}</span>
                  )}
                </div>
              )}

              {/* Meta Row: Type Badge, Year, Duration, Score, Rating, Status */}
              <div className="stremio-meta-row">
                <span
                  className={`stremio-meta-badge type-badge ${
                    effectiveTvType?.toLowerCase() || ''
                  }`}
                >
                  {typeLabel}
                </span>

                {displayYear ? (
                  <span className="stremio-meta-val">{displayYear}</span>
                ) : null}

                {formattedDuration ? (
                  <span className="stremio-meta-val">{formattedDuration}</span>
                ) : null}

                {displayScore !== undefined && displayScore !== null ? (
                  <span className="stremio-meta-val rating-val">
                    <span className="stremio-imdb-badge">IMDb</span>
                    {displayScore.toFixed(1)}
                  </span>
                ) : null}

                {details.content_rating && (
                  <span className="stremio-meta-badge">
                    {details.content_rating}
                  </span>
                )}

                {displayStatus && (
                  <span
                    className={`stremio-meta-badge status-badge ${displayStatus.toLowerCase()}`}
                  >
                    {displayStatus.toLowerCase() === 'ongoing' && (
                      <span className="status-live-dot" />
                    )}
                    {displayStatus}
                  </span>
                )}

                {downloadedCount > 0 && (
                  <span className="stremio-downloaded-summary-badge" title="Offline ready">
                    <CloudStreamDeviceIcon size={14} color="#10b981" />
                    <span>
                      {downloadedCount} Episode{downloadedCount === 1 ? '' : 's'} Downloaded ({formatByteSize(totalDownloadedBytes)})
                    </span>
                  </span>
                )}
              </div>

              {/* Action Buttons Bar */}
              <div className="stremio-actions-bar">
                {/* Primary Play / Resume CTA */}
                {primaryCTA && (
                  <button
                    type="button"
                    className="stremio-action-play-btn"
                    onClick={() => handlePlayEpisode(primaryCTA.episode)}
                    disabled={extractingKey !== null}
                  >
                    {primaryCTA.isOffline ? (
                      <CloudStreamDeviceIcon size={18} color="#ffffff" />
                    ) : (
                      <Play size={18} fill="#ffffff" color="#ffffff" />
                    )}
                    <span>
                      {extractingKey ? 'Extracting...' : primaryCTA.label}
                    </span>
                    {primaryCTA.progress !== null && (
                      <div
                        className="stremio-play-progress-bar"
                        style={{ width: `${primaryCTA.progress}%` }}
                      />
                    )}
                  </button>
                )}

                {/* Download Media CTA */}
                {primaryCTA && (
                  <button
                    type="button"
                    className={`stremio-action-download-btn ${downloadedCount > 0 ? 'completed' : ''}`}
                    onClick={() => handleDownloadEpisode(primaryCTA.episode)}
                    disabled={downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] !== undefined}
                    title={downloadedCount > 0 ? `${downloadedCount} episodes downloaded offline` : 'Download for offline viewing'}
                  >
                    {downloadedCount > 0 ? (
                      <CloudStreamDeviceIcon size={17} color="#10b981" />
                    ) : (
                      <Download size={17} />
                    )}
                    <span>
                      {downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] === 'extracting'
                        ? 'Extracting...'
                        : downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] === 'queued'
                        ? 'Queued!'
                        : downloadedCount > 0
                        ? `${downloadedCount} Downloaded`
                        : 'Download'}
                    </span>
                  </button>
                )}

                {/* Trailer Button */}
                {details.trailers && details.trailers.length > 0 ? (
                  <button
                    type="button"
                    className="stremio-action-trailer-btn"
                    onClick={() => setActiveTrailerUrl(details.trailers[0])}
                  >
                    <Video size={17} />
                    <span>Trailer</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="stremio-action-trailer-btn"
                    onClick={() => {
                      const q = encodeURIComponent(`${details.name} official trailer`);
                      window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
                    }}
                  >
                    <Video size={17} />
                    <span>Trailer</span>
                  </button>
                )}

                {/* Library / Watchlist Status Dropdown */}
                <div className="stremio-dropdown-wrapper">
                  <button
                    type="button"
                    className={`stremio-action-circle-btn ${
                      watchlistStatus ? 'active' : ''
                    }`}
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    title={watchlistStatus ? `Watchlist: ${watchlistStatus}` : 'Add to Library'}
                  >
                    <Bookmark size={18} fill={watchlistStatus ? 'currentColor' : 'none'} />
                  </button>

                  {showStatusDropdown && (
                    <div className="stremio-watchlist-popup">
                      <div className="popup-title">Watch Status</div>
                      {Object.entries(WATCHLIST_STATUS_CONFIG).map(
                        ([key, cfg]) => (
                          <button
                            key={key}
                            className={`popup-item ${
                              watchlistStatus === key ? 'selected' : ''
                            }`}
                            onClick={() => handleSetWatchlistStatus(key)}
                          >
                            <span
                              className="popup-dot"
                              style={{ backgroundColor: cfg.color }}
                            />
                            <span>{cfg.label}</span>
                            {watchlistStatus === key && <Check size={14} />}
                          </button>
                        )
                      )}
                      {watchlistStatus && (
                        <button
                          className="popup-item remove-opt"
                          onClick={() => handleSetWatchlistStatus(null)}
                        >
                          <X size={14} color="#f87171" />
                          <span>Remove from Library</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Share Button */}
                <button
                  type="button"
                  className="stremio-action-share-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(item.url);
                    alert('Media link copied to clipboard!');
                  }}
                  title="Share link"
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* Plot Synopsis (Clean, Readable, with subtle Expand) */}
              {details.plot && (
                <div className="stremio-summary-container">
                  <p className={`stremio-summary-text ${plotExpanded ? 'expanded' : ''}`}>
                    {details.plot}
                  </p>
                  {details.plot.length > 220 && (
                    <button
                      type="button"
                      className="stremio-summary-toggle"
                      onClick={() => setPlotExpanded(!plotExpanded)}
                    >
                      {plotExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Genres Tag Chips */}
              {details.tags && details.tags.length > 0 && (
                <div className="stremio-chips-row">
                  {details.tags.slice(0, 7).map((genre) => (
                    <span key={genre} className="stremio-pill-chip">
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Starring Cast */}
              {details.cast && details.cast.length > 0 && (
                <div className="stremio-cast-row">
                  <span className="stremio-cast-label">Starring</span>
                  <span className="stremio-cast-names">
                    {details.cast.slice(0, 5).map((a) => a.name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Recommendations Shelf (Horizontal at bottom - ONLY if recommendations exist) */}
            {details.recommendations && details.recommendations.length > 0 && (
              <div className="stremio-movie-recs-shelf">
                <div className="stremio-shelf-title">More Like This</div>
                <div className="stremio-shelf-scroll-row">
                  {details.recommendations.map((rec) => (
                    <div
                      key={rec.url}
                      className="stremio-shelf-card"
                      onClick={() => onSelectItem?.(rec)}
                    >
                      <div className="stremio-shelf-poster-wrapper">
                        <img
                          src={
                            rec.poster_url ||
                            'https://via.placeholder.com/160x240'
                          }
                          alt={rec.name}
                          className="stremio-shelf-poster"
                        />
                      </div>
                      <div className="stremio-shelf-card-info">
                        <div className="stremio-shelf-card-name" title={rec.name}>
                          {rec.name}
                        </div>
                        {rec.year && (
                          <div className="stremio-shelf-card-year">{rec.year}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= SERIES / ANIME SPLIT LAYOUT ================= */
          <div className="stremio-detail-layout series-mode">
            {/* Left Info Column */}
            <div className="stremio-left-info-panel">
              <h1 className="stremio-media-title">{details.name}</h1>

              {(details.jap_name || details.eng_name) && (
                <div className="stremio-alt-title">
                  {details.jap_name}
                  {details.eng_name && details.eng_name !== details.name && (
                    <span> • {details.eng_name}</span>
                  )}
                </div>
              )}

              <div className="stremio-meta-row">
                <span
                  className={`stremio-meta-badge type-badge ${
                    effectiveTvType?.toLowerCase() || ''
                  }`}
                >
                  {typeLabel}
                </span>

                {displayStatus && (
                  <span
                    className={`stremio-meta-badge status-badge ${displayStatus.toLowerCase()}`}
                  >
                    {displayStatus.toLowerCase() === 'ongoing' && (
                      <span className="status-live-dot" />
                    )}
                    {displayStatus}
                  </span>
                )}

                {seriesStats.detailLabel && (
                  <span className="stremio-meta-val series-stats-val">
                    {seriesStats.detailLabel}
                  </span>
                )}

                {details.duration_minutes ? (
                  <span className="stremio-meta-val ep-duration-val">
                    ~{details.duration_minutes}m/ep
                  </span>
                ) : null}

                {displayYear ? (
                  <span className="stremio-meta-val">
                    {displayYear}–
                  </span>
                ) : null}

                {displayScore !== undefined && displayScore !== null ? (
                  <span className="stremio-meta-val rating-val">
                    <span className="stremio-imdb-badge">IMDb</span>
                    {displayScore.toFixed(1)}
                  </span>
                ) : null}

                {details.content_rating && (
                  <span className="stremio-meta-badge">
                    {details.content_rating}
                  </span>
                )}
              </div>

              {nextAiringText && (
                <div className="stremio-next-airing-banner">
                  <Radio size={14} className="pulse-icon" />
                  <span>{nextAiringText}</span>
                </div>
              )}

              {/* Action Buttons Bar */}
              <div className="stremio-actions-bar">
                {primaryCTA && (
                  <button
                    type="button"
                    className="stremio-action-play-btn"
                    onClick={() => handlePlayEpisode(primaryCTA.episode)}
                    disabled={extractingKey !== null}
                  >
                    <Play size={18} fill="#ffffff" color="#ffffff" />
                    <span>
                      {extractingKey ? 'Extracting...' : primaryCTA.label}
                    </span>
                    {primaryCTA.progress !== null && (
                      <div
                        className="stremio-play-progress-bar"
                        style={{ width: `${primaryCTA.progress}%` }}
                      />
                    )}
                  </button>
                )}

                {/* Download Next Episode CTA */}
                {primaryCTA && (
                  <button
                    type="button"
                    className="stremio-action-download-btn"
                    onClick={() => handleDownloadEpisode(primaryCTA.episode)}
                    disabled={downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] !== undefined}
                    title="Download episode for offline viewing"
                  >
                    <Download size={17} />
                    <span>
                      {downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] === 'extracting'
                        ? 'Extracting...'
                        : downloadingKeys[`${primaryCTA.episode.season || 1}_${primaryCTA.episode.episode}`] === 'queued'
                        ? 'Queued!'
                        : 'Download'}
                    </span>
                  </button>
                )}

                {/* Trailer Button */}
                {details.trailers && details.trailers.length > 0 ? (
                  <button
                    type="button"
                    className="stremio-action-trailer-btn"
                    onClick={() => setActiveTrailerUrl(details.trailers[0])}
                  >
                    <Video size={17} />
                    <span>Trailer</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="stremio-action-trailer-btn"
                    onClick={() => {
                      const q = encodeURIComponent(`${details.name} official trailer`);
                      window.open(`https://www.youtube.com/results?search_query=${q}`, '_blank');
                    }}
                  >
                    <Video size={17} />
                    <span>Trailer</span>
                  </button>
                )}

                {/* Watchlist Dropdown */}
                <div className="stremio-dropdown-wrapper">
                  <button
                    type="button"
                    className={`stremio-action-circle-btn ${
                      watchlistStatus ? 'active' : ''
                    }`}
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    title={watchlistStatus ? `Watchlist: ${watchlistStatus}` : 'Add to Library'}
                  >
                    <Bookmark size={18} fill={watchlistStatus ? 'currentColor' : 'none'} />
                  </button>

                  {showStatusDropdown && (
                    <div className="stremio-watchlist-popup">
                      <div className="popup-title">Watch Status</div>
                      {Object.entries(WATCHLIST_STATUS_CONFIG).map(
                        ([key, cfg]) => (
                          <button
                            key={key}
                            className={`popup-item ${
                              watchlistStatus === key ? 'selected' : ''
                            }`}
                            onClick={() => handleSetWatchlistStatus(key)}
                          >
                            <span
                              className="popup-dot"
                              style={{ backgroundColor: cfg.color }}
                            />
                            <span>{cfg.label}</span>
                            {watchlistStatus === key && <Check size={14} />}
                          </button>
                        )
                      )}
                      {watchlistStatus && (
                        <button
                          className="popup-item remove-opt"
                          onClick={() => handleSetWatchlistStatus(null)}
                        >
                          <X size={14} color="#f87171" />
                          <span>Remove from Library</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Share Button */}
                <button
                  type="button"
                  className="stremio-action-share-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(item.url);
                    alert('Media link copied to clipboard!');
                  }}
                  title="Share link"
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* Plot Synopsis */}
              {details.plot && (
                <div className="stremio-summary-container">
                  <p className={`stremio-summary-text ${plotExpanded ? 'expanded' : ''}`}>
                    {details.plot}
                  </p>
                  {details.plot.length > 200 && (
                    <button
                      type="button"
                      className="stremio-summary-toggle"
                      onClick={() => setPlotExpanded(!plotExpanded)}
                    >
                      {plotExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Genres Tag Chips */}
              {details.tags && details.tags.length > 0 && (
                <div className="stremio-chips-row">
                  {details.tags.slice(0, 6).map((genre) => (
                    <span key={genre} className="stremio-pill-chip">
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Starring Cast */}
              {details.cast && details.cast.length > 0 && (
                <div className="stremio-cast-row">
                  <span className="stremio-cast-label">Starring</span>
                  <span className="stremio-cast-names">
                    {details.cast.slice(0, 5).map((a) => a.name).join(', ')}
                  </span>
                </div>
              )}
            </div>

            {/* Right Episodes Panel */}
            <div className="stremio-right-episodes-panel">
              {/* Header: Prev, Season Dropdown, Next */}
              <div className="stremio-episodes-panel-header">
                <button
                  className="season-nav-btn"
                  onClick={handlePrevSeason}
                  disabled={currentSeasonIndex <= 0}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                <div className="season-select-wrapper">
                  <button
                    className="season-select-btn"
                    onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                  >
                    <span>{getSeasonLabel(selectedSeason)}</span>
                    <ChevronDown size={14} />
                  </button>

                  {showSeasonDropdown && (
                    <div className="season-select-dropdown">
                      {seasons.map((s) => (
                        <button
                          key={s}
                          className={`season-dropdown-opt ${
                            selectedSeason === s ? 'active' : ''
                          }`}
                          onClick={() => {
                            setSelectedSeason(s);
                            setShowSeasonDropdown(false);
                          }}
                        >
                          <span>{getSeasonLabel(s)}</span>
                          {selectedSeason === s && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="season-nav-btn"
                  onClick={handleNextSeason}
                  disabled={currentSeasonIndex >= seasons.length - 1}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Anime Sub / Dub Switcher if applicable */}
              {isAnime && availableDubs.length > 1 && (
                <div className="stremio-anime-dub-bar">
                  {availableDubs.map((dub) => {
                    const count = details.episodes.filter(
                      (e) => (e.dub_status || 'Subbed') === dub
                    ).length;
                    return (
                      <button
                        key={dub}
                        className={`stremio-dub-pill ${
                          activeDub === dub ? 'active' : ''
                        }`}
                        onClick={() => setActiveDub(dub)}
                      >
                        {dub === 'Dubbed' ? 'Dub' : 'Sub'} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search Videos Input */}
              <div className="stremio-videos-search-box">
                <input
                  type="text"
                  placeholder="Search episodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    className="search-clear-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <Search size={16} className="search-icon-right" />
                )}
              </div>

              {/* Episode List */}
              <div className="stremio-episodes-list-scroll">
                {displayEpisodes.length > 0 ? (
                  displayEpisodes.map((ep) => {
                    const epKey = `${ep.season || 1}_${ep.episode}`;
                    const dlItem = getDownloadedItemForEpisode(ep);
                    const isDownloaded = Boolean(dlItem && dlItem.status === 'completed' && dlItem.file_path);
                    const isDownloading = dlItem?.status === 'downloading' || downloadingKeys[epKey] === 'extracting' || downloadingKeys[epKey] === 'queued';
                    const isPaused = dlItem?.status === 'paused';
                    const downloadProgress = dlItem?.progress_pct || 0;

                    const watchStatus = getWatchProgressForEpisode(ep);
                    const progressPercent = watchStatus.percent;
                    const isExtracting = extractingKey === epKey;

                    return (
                      <div
                        key={epKey}
                        className={`stremio-episode-item ${
                          isExtracting ? 'extracting' : ''
                        }`}
                        onClick={() => handlePlayEpisode(ep)}
                      >
                        {/* 16:9 Thumbnail preview with CloudStream Android WatchPlayProgress */}
                        <div className="stremio-ep-thumb-wrapper">
                          <img
                            src={
                              ep.poster_url ||
                              details.poster_url ||
                              'https://via.placeholder.com/320x180?text=Episode'
                            }
                            alt={ep.name || `Episode ${ep.episode}`}
                            className="stremio-ep-thumb"
                          />

                          {/* Center Play & Watch Progress Ring (CloudStream Android Parity) */}
                          <div className="stremio-ep-thumb-overlay">
                            {isExtracting ? (
                              <div className="stremio-mini-spinner" />
                            ) : (
                              <WatchPlayProgress
                                percent={progressPercent}
                                isWatched={watchStatus.isCompleted}
                                onToggleWatched={(e) => handleToggleWatched(ep, e)}
                                size={36}
                              />
                            )}
                          </div>
                        </div>

                        {/* Middle: Clean Title & Description (CloudStream Android Parity) */}
                        <div className="stremio-ep-meta">
                          <div className="stremio-ep-title" title={ep.name}>
                            {ep.episode}. {ep.name || `Episode ${ep.episode}`}
                          </div>

                          {isDownloaded && dlItem && (
                            <div className="stremio-ep-submeta">
                              <span className="stremio-ep-size-tag">
                                {formatByteSize(dlItem.total_bytes > 0 ? dlItem.total_bytes : dlItem.downloaded_bytes)}
                              </span>
                            </div>
                          )}

                          {ep.description ? (
                            <div className="stremio-ep-desc">
                              {ep.description}
                            </div>
                          ) : ep.release_date ? (
                            <div className="stremio-ep-date">
                              {ep.release_date}
                            </div>
                          ) : null}
                        </div>

                        {/* Right: Clean Download / Device Status Action Button */}
                        <div className="stremio-ep-actions">
                          {isDownloaded && dlItem ? (
                            <button
                              type="button"
                              className="stremio-ep-download-btn downloaded"
                              title={`Downloaded (${formatByteSize(dlItem.total_bytes > 0 ? dlItem.total_bytes : dlItem.downloaded_bytes)}) • Click to play offline`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayEpisode(ep);
                              }}
                            >
                              <CloudStreamDeviceIcon size={26} color="#ffffff" />
                            </button>
                          ) : isDownloading ? (
                            <div className="stremio-ep-download-clock" title={`Downloading: ${downloadProgress.toFixed(0)}%`}>
                              <DownloadPieClock pct={downloadProgress} status="downloading" size={26} />
                            </div>
                          ) : isPaused ? (
                            <div className="stremio-ep-download-clock" title="Download Paused">
                              <DownloadPieClock pct={downloadProgress} status="paused" size={26} />
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="stremio-ep-download-btn"
                              title="Download episode"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadEpisode(ep);
                              }}
                              disabled={downloadingKeys[epKey] !== undefined}
                            >
                              {downloadingKeys[epKey] === 'extracting' ? (
                                <div className="stremio-mini-spinner" style={{ width: 16, height: 16 }} />
                              ) : downloadingKeys[epKey] === 'queued' ? (
                                <Check size={18} color="#10b981" />
                              ) : (
                                <Download size={24} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="stremio-no-episodes">
                    <span>No episodes found</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : null}

      {/* Trailer Modal Overlay */}
      {activeTrailerUrl && (
        <div
          className="trailer-modal-overlay"
          onClick={() => setActiveTrailerUrl(null)}
        >
          <div
            className="trailer-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="trailer-modal-close"
              onClick={() => setActiveTrailerUrl(null)}
            >
              <X size={20} />
            </button>
            <div className="trailer-video-wrapper">
              {activeTrailerUrl.includes('youtube') ||
              activeTrailerUrl.includes('youtu.be') ? (
                <iframe
                  src={getEmbedTrailerUrl(activeTrailerUrl)}
                  title="Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={activeTrailerUrl} controls autoPlay />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
