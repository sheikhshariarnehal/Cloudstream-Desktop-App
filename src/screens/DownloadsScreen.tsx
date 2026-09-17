import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Download,
  FolderOpen,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  Film,
  Tv,
  Search,
  X,
  Clock,
  Layers,
  CheckSquare,
  Square,
  Compass,
  RotateCw,
  Check,
  ChevronLeft,
} from 'lucide-react';
import {
  DownloadItem,
  DownloadRequest,
  DownloadProgressPayload,
  StorageDiskInfo,
  WatchHistoryItem,
} from '../types';

/**
 * CloudStream Device Icon with Checkmark
 * Pixel-accurate port of Android CloudStream's R.drawable.download_icon_done.xml
 */
export const CloudStreamDeviceIcon: React.FC<{
  size?: number;
  color?: string;
  className?: string;
}> = ({ size = 20, color = 'currentColor', className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`cs-device-icon ${className}`}
  >
    {/* Smartphone frame */}
    <rect
      x="5.5"
      y="2.5"
      width="13"
      height="19"
      rx="3"
      stroke={color}
      strokeWidth="1.8"
    />
    {/* Top speaker notch */}
    <line
      x1="10"
      y1="5"
      x2="14"
      y2="5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Checkmark inside phone screen */}
    <path
      d="M8.5 12.5L11 15L15.5 10"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Clockwise Radial Pie Progress Indicator
 * Direct port of Android CloudStream's PieFetchButton.kt
 */
export const DownloadPieClock: React.FC<{
  pct: number;
  status: 'downloading' | 'paused' | 'failed' | 'pending';
  size?: number;
}> = ({ pct, status, size = 22 }) => {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div
      className={`cs-pie-clock-wrap ${status}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      title={`${status === 'downloading' ? 'Downloading' : status}: ${clamped.toFixed(1)}%`}
    >
      <div
        className="cs-pie-clock-radial"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background:
            status === 'paused'
              ? `conic-gradient(#f59e0b 0% ${clamped}%, rgba(245, 158, 11, 0.22) ${clamped}% 100%)`
              : `conic-gradient(#ffffff 0% ${clamped}%, rgba(255, 255, 255, 0.22) ${clamped}% 100%)`,
        }}
      />
      {status === 'paused' && <Pause size={9} className="cs-pie-pause-glyph" />}
    </div>
  );
};

/**
 * Watch Play Progress
 * Replicates CloudStream Android's watch_progress_container:
 * - Unwatched: plain play triangle (▶)
 * - Partially watched: play triangle surrounded by circular progress ring ( ▶ )
 * - Watched: checkmark icon inside circle ( ✓ )
 */
export const WatchPlayProgress: React.FC<{
  percent: number;
  isWatched: boolean;
  onToggleWatched: (e: React.MouseEvent) => void;
  size?: number;
}> = ({ percent, isWatched, onToggleWatched, size = 30 }) => {
  const radius = 11;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  if (isWatched) {
    return (
      <div
        className="cs-watch-indicator watched"
        style={{ width: size, height: size }}
        onClick={onToggleWatched}
        title="Watched (Click to mark unwatched)"
      >
        <div className="cs-watch-badge-circle">
          <Check size={14} strokeWidth={2.8} color="#10b981" />
        </div>
      </div>
    );
  }

  if (percent > 0) {
    return (
      <div
        className="cs-watch-indicator in-progress"
        style={{ width: size, height: size }}
        onClick={onToggleWatched}
        title={`Watched: ${percent}% (Click to mark completed)`}
      >
        <svg width={size} height={size} viewBox="0 0 28 28" className="cs-watch-ring-svg">
          {/* Background track circle */}
          <circle
            cx="14"
            cy="14"
            r={radius}
            stroke="rgba(255, 255, 255, 0.18)"
            strokeWidth="2.5"
            fill="none"
          />
          {/* Foreground progress arc */}
          <circle
            cx="14"
            cy="14"
            r={radius}
            stroke="#a855f7"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 14 14)"
          />
        </svg>
        <div className="cs-watch-play-triangle">
          <Play size={10} fill="#ffffff" color="#ffffff" style={{ marginLeft: '1px' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="cs-watch-indicator unwatched"
      style={{ width: size, height: size }}
      onClick={onToggleWatched}
      title="Unwatched (Click to mark watched)"
    >
      <div className="cs-watch-play-triangle">
        <Play size={12} fill="#ffffff" color="#ffffff" style={{ marginLeft: '1.5px' }} />
      </div>
    </div>
  );
};

export const formatByteSize = (bytes: number): string => {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
};

interface DownloadsScreenProps {
  onPlayOfflineMedia: (
    filePath: string,
    title: string,
    item?: DownloadItem,
    allDownloadedEpisodes?: DownloadItem[]
  ) => void;
  onNavigateToDiscover?: () => void;
}

interface GroupedMedia {
  parentId: string;
  mediaTitle: string;
  posterUrl?: string;
  tvType: string;
  sourceApi: string;
  episodes: DownloadItem[];
  totalBytes: number;
  completedEpisodesCount: number;
  totalEpisodesCount: number;
  latestCreatedAt: number;
}

export const DownloadsScreen: React.FC<DownloadsScreenProps> = ({
  onPlayOfflineMedia,
  onNavigateToDiscover,
}) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [diskInfo, setDiskInfo] = useState<StorageDiskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'movies' | 'series' | 'anime'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');

  // UI Modals & Drawers
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showDirectModal, setShowDirectModal] = useState(false);

  // Child series full-screen view (CloudStream DownloadChildFragment parity)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [childSelectMode, setChildSelectMode] = useState(false);
  const [childSelectedIds, setChildSelectedIds] = useState<Set<string>>(new Set());

  // Watched state map (persisted in localStorage as fallback / quick toggle)
  const [watchedMap, setWatchedMap] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('cloudstream_watched_episodes');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Watch History from SQLite database (synced with MPV player)
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Calculate watch status (isWatched and percent 0-100) for an episode
  const getEpisodeWatchStatus = (ep: DownloadItem) => {
    // 1. Match in SQLite watch history
    const match = watchHistory.find((h) => {
      const isSameMedia =
        h.media_id === (ep.parent_id || ep.id) ||
        h.media_id === ep.url ||
        h.media_id === ep.id ||
        h.media_id === ep.file_path ||
        (h.title && ep.media_title && h.title.toLowerCase().trim() === ep.media_title.toLowerCase().trim()) ||
        (h.title && ep.media_title && (h.title.toLowerCase().includes(ep.media_title.toLowerCase()) || ep.media_title.toLowerCase().includes(h.title.toLowerCase())));

      if (!isSameMedia) return false;

      if (ep.season_num && ep.episode_num) {
        return (h.season_num ?? 1) === ep.season_num && (h.episode_num ?? 1) === ep.episode_num;
      }
      return true;
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

      if (watchedMap[ep.id] === true) {
        return { isWatched: true, percent: 100, remainingMinutes: 0, positionMs: match.position_ms, durationMs: match.duration_ms };
      }

      return {
        isWatched: isCompleted,
        percent,
        remainingMinutes,
        positionMs: match.position_ms,
        durationMs: match.duration_ms,
      };
    }

    // If user explicitly toggled in localStorage
    if (watchedMap[ep.id] !== undefined) {
      return {
        isWatched: watchedMap[ep.id],
        percent: watchedMap[ep.id] ? 100 : 0,
        remainingMinutes: 0,
        positionMs: 0,
        durationMs: 0,
      };
    }

    return { isWatched: false, percent: 0, remainingMinutes: 0, positionMs: 0, durationMs: 0 };
  };

  const handleToggleWatched = async (ep: DownloadItem | string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const epItem =
      typeof ep === 'string'
        ? downloads.find((d) => d.id === ep) || { id: ep, media_title: ep, downloaded_bytes: 0 } as DownloadItem
        : ep;

    const currentStatus = getEpisodeWatchStatus(epItem);
    const nextWatched = !currentStatus.isWatched;

    // 1. Update localStorage
    setWatchedMap((prev) => {
      const next = { ...prev, [epItem.id]: nextWatched };
      try {
        localStorage.setItem('cloudstream_watched_episodes', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 2. Persist to SQLite watch history
    try {
      const histItem: WatchHistoryItem = {
        media_id: epItem.parent_id || epItem.id,
        provider_id: epItem.source_api || 'Offline',
        title: epItem.media_title,
        poster_url: epItem.poster_url,
        tv_type: (epItem.tv_type as any) || 'TvSeries',
        episode_num: epItem.episode_num || 1,
        season_num: epItem.season_num || 1,
        episode_name: epItem.episode_title,
        position_ms: nextWatched ? 100000 : 0,
        duration_ms: nextWatched ? 100000 : 0,
        last_watched_at: Date.now(),
        is_completed: nextWatched,
      };
      await invoke('save_watch_progress', { item: histItem });
      const updated = await invoke<WatchHistoryItem[]>('get_watch_history', { limit: 1000 });
      setWatchHistory(updated);
    } catch (err) {
      console.warn('Could not persist watch progress to SQLite:', err);
    }
  };

  // Multi-Selection State (Main Grid)
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Direct URL Stream Modal state
  const [streamUrl, setStreamUrl] = useState('');
  const [streamTitle, setStreamTitle] = useState('');
  const [streamType, setStreamType] = useState('Movie');
  const [streamEpisodeTitle, setStreamEpisodeTitle] = useState('');
  const [streamSeason, setStreamSeason] = useState<number>(1);
  const [streamEpisode, setStreamEpisode] = useState<number>(1);
  const [streamHeaders, setStreamHeaders] = useState('');

  // Toast / feedback message
  const [notice, setNotice] = useState<string | null>(null);

  const fetchDownloadsAndStorage = async () => {
    try {
      const [items, storage, hist] = await Promise.all([
        invoke<DownloadItem[]>('get_downloads'),
        invoke<StorageDiskInfo>('get_storage_disk_info', { downloadPath: null }),
        invoke<WatchHistoryItem[]>('get_watch_history', { limit: 1000 }).catch(() => [] as WatchHistoryItem[]),
      ]);
      setDownloads(items);
      setDiskInfo(storage);
      setWatchHistory(hist);
    } catch (err) {
      console.error('Failed to load downloads data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh watch history periodically & on events
  useEffect(() => {
    const refreshHistory = () => {
      invoke<WatchHistoryItem[]>('get_watch_history', { limit: 1000 })
        .then((hist) => setWatchHistory(hist))
        .catch(() => {});
    };

    refreshHistory();
    const interval = setInterval(refreshHistory, 3000);
    window.addEventListener('focus', refreshHistory);
    window.addEventListener('cloudstream-watch-progress-saved', refreshHistory);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshHistory);
      window.removeEventListener('cloudstream-watch-progress-saved', refreshHistory);
    };
  }, []);

  useEffect(() => {
    fetchDownloadsAndStorage();

    // Listen for progress updates from Tauri background worker
    const unlistenProgress = listen<DownloadProgressPayload>('download-progress', (event) => {
      const payload = event.payload;
      setDownloads((prev) =>
        prev.map((item) => {
          if (item.id === payload.id) {
            return {
              ...item,
              downloaded_bytes: payload.downloaded_bytes,
              total_bytes: payload.total_bytes > 0 ? payload.total_bytes : item.total_bytes,
              speed_bytes_per_sec: payload.speed_bytes_per_sec,
              formatted_speed: payload.formatted_speed,
              eta_seconds: payload.eta_seconds,
              progress_pct: payload.progress_pct,
              status: payload.status as any,
            };
          }
          return item;
        })
      );
    });

    // Listen for status changes (completed, failed, cancelled)
    const unlistenStatus = listen<{ id: string; status: string; error?: string }>('download-status', () => {
      fetchDownloadsAndStorage();
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenStatus.then((f) => f());
    };
  }, []);

  const activeQueueCount = useMemo(() => {
    return downloads.filter((d) => d.status === 'downloading' || d.status === 'pending').length;
  }, [downloads]);

  // Group downloads by parent media (Series vs Movies)
  const groupedMedia = useMemo(() => {
    const map = new Map<string, GroupedMedia>();

    for (const item of downloads) {
      const parentId = item.parent_id || item.id;
      if (!map.has(parentId)) {
        map.set(parentId, {
          parentId,
          mediaTitle: item.media_title,
          posterUrl: item.poster_url,
          tvType: item.tv_type,
          sourceApi: item.source_api,
          episodes: [],
          totalBytes: 0,
          completedEpisodesCount: 0,
          totalEpisodesCount: 0,
          latestCreatedAt: item.created_at,
        });
      }

      const group = map.get(parentId)!;
      group.episodes.push(item);
      group.totalBytes += item.downloaded_bytes;
      group.totalEpisodesCount += 1;
      if (item.status === 'completed') {
        group.completedEpisodesCount += 1;
      }
      if (item.created_at > group.latestCreatedAt) {
        group.latestCreatedAt = item.created_at;
      }
    }

    let list = Array.from(map.values());

    // Filter by type
    if (typeFilter === 'movies') {
      list = list.filter((g) => g.tvType.toLowerCase().includes('movie'));
    } else if (typeFilter === 'series') {
      list = list.filter((g) => g.tvType.toLowerCase().includes('series') || g.tvType.toLowerCase().includes('drama'));
    } else if (typeFilter === 'anime') {
      list = list.filter((g) => g.tvType.toLowerCase().includes('anime'));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.mediaTitle.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.mediaTitle.localeCompare(b.mediaTitle);
      } else if (sortBy === 'size') {
        return b.totalBytes - a.totalBytes;
      } else {
        return b.latestCreatedAt - a.latestCreatedAt;
      }
    });

    return list;
  }, [downloads, typeFilter, searchQuery, sortBy]);

  // Current active series for full-screen child view
  const currentSeries = useMemo(() => {
    if (!selectedParentId) return null;
    return groupedMedia.find((g) => g.parentId === selectedParentId) || null;
  }, [groupedMedia, selectedParentId]);

  // Automatically navigate back if all episodes of this series are deleted (DownloadChildFragment parity)
  useEffect(() => {
    if (selectedParentId && !currentSeries && !loading) {
      setSelectedParentId(null);
    }
  }, [selectedParentId, currentSeries, loading]);

  // Keyboard navigation for Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (childSelectMode) {
          setChildSelectMode(false);
          setChildSelectedIds(new Set());
        } else if (selectedParentId) {
          setSelectedParentId(null);
        } else if (showQueueDrawer) {
          setShowQueueDrawer(false);
        } else if (showDirectModal) {
          setShowDirectModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [childSelectMode, selectedParentId, showQueueDrawer, showDirectModal]);

  // Sorted episodes for current series
  const sortedEpisodes = useMemo(() => {
    if (!currentSeries) return [];
    return [...currentSeries.episodes].sort((a, b) => {
      const sA = a.season_num ?? 1;
      const sB = b.season_num ?? 1;
      if (sA !== sB) return sA - sB;
      const eA = a.episode_num ?? 1;
      const eB = b.episode_num ?? 1;
      return eA - eB;
    });
  }, [currentSeries]);

  // Next episode to play (first completed unwatched episode, or first completed episode)
  const nextEpisodeToPlay = useMemo(() => {
    if (!sortedEpisodes.length) return null;
    const unwatched = sortedEpisodes.find(
      (ep) => ep.status === 'completed' && !getEpisodeWatchStatus(ep).isWatched
    );
    if (unwatched) return unwatched;
    return sortedEpisodes.find((ep) => ep.status === 'completed') || null;
  }, [sortedEpisodes, watchedMap, watchHistory]);

  // Total bytes of child selection
  const selectedChildBytes = useMemo(() => {
    if (!currentSeries) return 0;
    return currentSeries.episodes
      .filter((e) => childSelectedIds.has(e.id))
      .reduce((acc, curr) => acc + curr.downloaded_bytes, 0);
  }, [currentSeries, childSelectedIds]);

  const handleChildToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setChildSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleChildSelectAll = () => {
    if (!currentSeries) return;
    if (childSelectedIds.size === currentSeries.episodes.length) {
      setChildSelectedIds(new Set());
    } else {
      setChildSelectedIds(new Set(currentSeries.episodes.map((e) => e.id)));
    }
  };

  const handleChildBatchDelete = async () => {
    if (childSelectedIds.size === 0) return;
    if (!confirm(`Delete ${childSelectedIds.size} selected episode(s) from disk?`)) return;

    try {
      const ids = Array.from(childSelectedIds);
      await invoke('delete_downloads_batch', { ids, deleteFiles: true });
      setChildSelectedIds(new Set());
      setChildSelectMode(false);
      fetchDownloadsAndStorage();
      setNotice(`Deleted ${ids.length} episode(s).`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      console.error('Failed to batch delete episodes:', err);
    }
  };

  const handleRetryDownload = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await invoke('retry_download', { id });
      fetchDownloadsAndStorage();
      setNotice('Retrying download...');
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      console.error('Failed to retry download:', err);
      setNotice(`Retry failed: ${err}`);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  // Actions
  const handleOpenFolder = async (path?: string) => {
    try {
      const target = path || diskInfo?.download_path;
      if (target) {
        await invoke('open_directory', { path: target });
      }
    } catch (err) {
      console.error('Failed to open directory:', err);
    }
  };

  const handlePauseDownload = async (id: string) => {
    try {
      await invoke('pause_download', { id });
    } catch (err) {
      console.error('Failed to pause download:', err);
    }
  };

  const handleResumeDownload = async (id: string) => {
    try {
      await invoke('resume_download', { id });
    } catch (err) {
      console.error('Failed to resume download:', err);
    }
  };

  const handleCancelDownload = async (id: string) => {
    try {
      await invoke('cancel_download', { id, deleteFile: true });
      fetchDownloadsAndStorage();
    } catch (err) {
      console.error('Failed to cancel download:', err);
    }
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await invoke('delete_download', { id, deleteFile: true });
      fetchDownloadsAndStorage();
      setNotice('Item removed from downloads.');
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      console.error('Failed to delete download:', err);
    }
  };

  const handleDeleteGroup = async (group: GroupedMedia) => {
    if (!confirm(`Are you sure you want to delete all downloaded files for "${group.mediaTitle}"?`)) {
      return;
    }
    try {
      const ids = group.episodes.map((e) => e.id);
      await invoke('delete_downloads_batch', { ids, deleteFiles: true });
      fetchDownloadsAndStorage();
      if (selectedParentId === group.parentId) {
        setSelectedParentId(null);
      }
      setNotice(`Deleted all episodes of "${group.mediaTitle}".`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item(s) from disk?`)) return;

    try {
      const ids = Array.from(selectedIds);
      await invoke('delete_downloads_batch', { ids, deleteFiles: true });
      setSelectedIds(new Set());
      setIsSelectMode(false);
      fetchDownloadsAndStorage();
      setNotice(`Deleted ${ids.length} item(s).`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      console.error('Failed to batch delete:', err);
    }
  };

  const handleToggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set<string>();
    groupedMedia.forEach((g) => {
      g.episodes.forEach((e) => allIds.add(e.id));
    });
    setSelectedIds(allIds);
  };

  const handleStartDirectDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl.trim() || !streamTitle.trim()) return;

    let headersObj: Record<string, string> | undefined = undefined;
    if (streamHeaders.trim()) {
      try {
        headersObj = JSON.parse(streamHeaders);
      } catch {
        // Simple key: value lines
        headersObj = {};
        streamHeaders.split('\n').forEach((line) => {
          const [k, ...v] = line.split(':');
          if (k && v.length) headersObj![k.trim()] = v.join(':').trim();
        });
      }
    }

    const req: DownloadRequest = {
      parent_id: streamTitle.trim().toLowerCase().replace(/\s+/g, '-'),
      url: streamUrl.trim(),
      source_api: 'DirectStream',
      media_title: streamTitle.trim(),
      episode_title: streamEpisodeTitle.trim() || undefined,
      season_num: streamType !== 'Movie' ? streamSeason : undefined,
      episode_num: streamType !== 'Movie' ? streamEpisode : undefined,
      tv_type: streamType,
      poster_url: undefined,
      headers: headersObj,
      custom_download_path: undefined,
    };

    try {
      await invoke('start_download', { request: req });
      setShowDirectModal(false);
      setShowQueueDrawer(true);
      setStreamUrl('');
      setStreamTitle('');
      setStreamEpisodeTitle('');
      fetchDownloadsAndStorage();
      setNotice(`Download started: ${req.media_title}`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      alert(`Failed to start download: ${err}`);
    }
  };

  // Compute selected total bytes
  const selectedBytesTotal = useMemo(() => {
    let bytes = 0;
    downloads.forEach((d) => {
      if (selectedIds.has(d.id)) {
        bytes += d.downloaded_bytes;
      }
    });
    return bytes;
  }, [downloads, selectedIds]);

  // Render Helpers for global drawers and modals
  const renderNoticeToast = () => {
    if (!notice) return null;
    return (
      <div className="downloads-toast-banner animate-fade-in">
        <CheckCircle2 size={16} />
        <span>{notice}</span>
      </div>
    );
  };

  const renderQueueDrawer = () => {
    if (!showQueueDrawer) return null;
    return (
      <div className="modal-backdrop animate-fade-in" onClick={() => setShowQueueDrawer(false)}>
        <div
          className="download-queue-drawer animate-slide-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Header */}
          <div className="queue-drawer-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#7c3aed" />
              <h3 className="queue-drawer-title">Download Queue</h3>
              <span className="settings-badge">{downloads.length} Total</span>
            </div>

            <button
              className="btn-icon-subtle"
              onClick={() => setShowQueueDrawer(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Queue Items List */}
          <div className="queue-items-container">
            {downloads.length > 0 ? (
              downloads.map((item) => {
                const isRunning = item.status === 'downloading';
                const isPaused = item.status === 'paused';
                const isDone = item.status === 'completed';

                return (
                  <div key={item.id} className="queue-item-card">
                    <div className="queue-item-top">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="queue-item-title" title={item.media_title}>
                          {item.media_title}
                        </div>
                        {item.episode_title && (
                          <div className="queue-item-ep">
                            S{item.season_num || 1}:E{item.episode_num || 1} • {item.episode_title}
                          </div>
                        )}
                      </div>

                      <div className="queue-item-controls">
                        {isRunning && (
                          <button
                            className="btn-icon-subtle"
                            onClick={() => handlePauseDownload(item.id)}
                            title="Pause"
                          >
                            <Pause size={14} />
                          </button>
                        )}

                        {isPaused && (
                          <button
                            className="btn-icon-subtle"
                            onClick={() => handleResumeDownload(item.id)}
                            title="Resume"
                          >
                            <Play size={14} />
                          </button>
                        )}

                        {!isDone && (
                          <button
                            className="btn-icon-danger"
                            onClick={() => handleCancelDownload(item.id)}
                            title="Cancel & delete partial"
                          >
                            <X size={14} />
                          </button>
                        )}

                        {isDone && (
                          <button
                            className="btn-icon-danger"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="queue-progress-bar">
                      <div
                        className={`queue-progress-fill ${isDone ? 'done' : ''}`}
                        style={{ width: `${item.progress_pct}%` }}
                      />
                    </div>

                    {/* Queue Item Stats */}
                    <div className="queue-item-stats">
                      <span>
                        {formatByteSize(item.downloaded_bytes)} / {formatByteSize(item.total_bytes)} (
                        {item.progress_pct.toFixed(1)}%)
                      </span>

                      <span>
                        {isRunning && item.formatted_speed && (
                          <span style={{ color: '#38bdf8' }}>{item.formatted_speed} • </span>
                        )}
                        <span style={{ textTransform: 'capitalize', color: isDone ? '#10b981' : isPaused ? '#f59e0b' : '#94a3b8' }}>
                          {item.status}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                No active or pending downloads in queue.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDirectModal = () => {
    if (!showDirectModal) return null;
    return (
      <div className="modal-backdrop animate-fade-in" onClick={() => setShowDirectModal(false)}>
        <div
          className="modal-card animate-scale-in"
          style={{ maxWidth: '480px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={20} color="#7c3aed" />
              <h3 className="modal-title" style={{ margin: 0 }}>Download Stream / URL</h3>
            </div>
            <button className="btn-icon-subtle" onClick={() => setShowDirectModal(false)}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleStartDirectDownload}>
            <div className="form-group">
              <label>Stream / Video URL (.mp4, .mkv, .m3u8)</label>
              <input
                type="url"
                className="settings-text-input"
                placeholder="https://example.com/video.mp4 or stream.m3u8"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Media Title</label>
              <input
                type="text"
                className="settings-text-input"
                placeholder="e.g. Inception or Attack on Titan"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Media Type</label>
              <select
                className="settings-select"
                value={streamType}
                onChange={(e) => setStreamType(e.target.value)}
              >
                <option value="Movie">Movie</option>
                <option value="TvSeries">TV Series</option>
                <option value="Anime">Anime</option>
                <option value="Other">Other / Clip</option>
              </select>
            </div>

            {streamType !== 'Movie' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                <div className="form-group">
                  <label>Season</label>
                  <input
                    type="number"
                    min={1}
                    className="settings-text-input"
                    value={streamSeason}
                    onChange={(e) => setStreamSeason(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group">
                  <label>Episode</label>
                  <input
                    type="number"
                    min={1}
                    className="settings-text-input"
                    value={streamEpisode}
                    onChange={(e) => setStreamEpisode(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group">
                  <label>Episode Name</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    placeholder="Optional"
                    value={streamEpisodeTitle}
                    onChange={(e) => setStreamEpisodeTitle(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Custom Headers (Optional, e.g. Referer)</label>
              <textarea
                className="settings-text-input"
                rows={2}
                placeholder={'Referer: https://example.com\nUser-Agent: Mozilla/5.0...'}
                value={streamHeaders}
                onChange={(e) => setStreamHeaders(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDirectModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Download size={14} /> Start Download
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Full-Screen Download Series Child Screen (CloudStream Android DownloadChildFragment Parity)
  if (currentSeries) {
    return (
      <div className="downloads-page-container downloads-child-screen animate-fade-in">
        {/* Sticky Top Navigation Bar */}
        <div className="child-nav-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              className="child-back-btn"
              onClick={() => setSelectedParentId(null)}
              title="Back to Downloads (Esc)"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="child-breadcrumb">
              <span className="breadcrumb-muted">Downloads</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{currentSeries.mediaTitle}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => handleOpenFolder(currentSeries.episodes[0]?.file_path)}
              title="Reveal series folder in file manager"
            >
              <FolderOpen size={14} /> Open Folder
            </button>

            <button
              className={`btn-secondary ${childSelectMode ? 'active-select-btn' : ''}`}
              onClick={() => {
                setChildSelectMode(!childSelectMode);
                setChildSelectedIds(new Set());
              }}
            >
              <CheckSquare size={14} /> {childSelectMode ? 'Exit Select' : 'Select'}
            </button>

            <button
              className="btn-secondary btn-icon-danger"
              onClick={() => handleDeleteGroup(currentSeries)}
              title="Delete all downloaded files for this title"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Hero Banner with Media Poster, Info & Primary CTA */}
        <div className="child-hero-banner">
          {currentSeries.posterUrl && (
            <div
              className="child-hero-backdrop"
              style={{ backgroundImage: `url(${currentSeries.posterUrl})` }}
            />
          )}

          {currentSeries.posterUrl ? (
            <img
              src={currentSeries.posterUrl}
              alt={currentSeries.mediaTitle}
              className="child-hero-poster"
            />
          ) : (
            <div className="child-hero-poster-fallback">
              {currentSeries.tvType.toLowerCase().includes('movie') ? (
                <Film size={44} />
              ) : (
                <Tv size={44} />
              )}
            </div>
          )}

          <div className="child-hero-info">
            <div>
              <div className="child-hero-tags">
                <span className="child-tag-pill type">{currentSeries.tvType}</span>
                {currentSeries.sourceApi && (
                  <span className="child-tag-pill source">{currentSeries.sourceApi}</span>
                )}
                <span className="child-tag-pill status">
                  {currentSeries.completedEpisodesCount}/{currentSeries.totalEpisodesCount} Ready
                </span>
              </div>

              <h1 className="child-hero-title">{currentSeries.mediaTitle}</h1>

              <div className="child-hero-stats">
                <span>
                  {currentSeries.episodes.length} Episode
                  {currentSeries.episodes.length === 1 ? '' : 's'} Downloaded
                </span>
                <span className="meta-dot">•</span>
                <span>Total {formatByteSize(currentSeries.totalBytes)}</span>
                <span className="meta-dot">•</span>
                <span style={{ color: '#10b981' }}>High-Speed Offline Storage</span>
              </div>
            </div>

            <div className="child-hero-actions">
              {nextEpisodeToPlay && (() => {
                const nextWatchStatus = getEpisodeWatchStatus(nextEpisodeToPlay);
                const isResume = nextWatchStatus.percent > 0 && !nextWatchStatus.isWatched;
                return (
                  <button
                    className="btn-hero-play"
                    onClick={() => {
                      const epLabel = nextEpisodeToPlay.season_num
                        ? `S${nextEpisodeToPlay.season_num}:E${nextEpisodeToPlay.episode_num || 1}`
                        : `Episode ${nextEpisodeToPlay.episode_num || 1}`;
                      onPlayOfflineMedia(
                        nextEpisodeToPlay.file_path,
                        `${currentSeries.mediaTitle} - ${epLabel}: ${nextEpisodeToPlay.episode_title || ''}`,
                        nextEpisodeToPlay,
                        currentSeries.episodes
                      );
                    }}
                  >
                    <Play size={18} fill="currentColor" />
                    <span>
                      {isResume
                        ? `Resume S${nextEpisodeToPlay.season_num || 1}:E${nextEpisodeToPlay.episode_num || 1}${
                            nextWatchStatus.remainingMinutes > 0 ? ` (${nextWatchStatus.remainingMinutes}m left)` : ''
                          }`
                        : `Play Next: S${nextEpisodeToPlay.season_num || 1}:E${nextEpisodeToPlay.episode_num || 1}${
                            nextEpisodeToPlay.episode_title ? ` — ${nextEpisodeToPlay.episode_title}` : ''
                          }`}
                    </span>
                  </button>
                );
              })()}

              <button
                className="btn-secondary"
                style={{ padding: '12px 18px', fontSize: '13px', borderRadius: '12px' }}
                onClick={() => handleOpenFolder(currentSeries.episodes[0]?.file_path)}
              >
                <FolderOpen size={16} /> Open Directory
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Select Batch Action Bar */}
        {childSelectMode && (
          <div className="child-batch-bar animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="btn-secondary btn-sm" onClick={handleChildSelectAll}>
                {childSelectedIds.size === currentSeries.episodes.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="batch-selection-info">
                {childSelectedIds.size} of {currentSeries.episodes.length} selected ({formatByteSize(selectedChildBytes)})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn-danger btn-sm"
                disabled={childSelectedIds.size === 0}
                onClick={handleChildBatchDelete}
              >
                <Trash2 size={13} /> Delete Selected
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  setChildSelectMode(false);
                  setChildSelectedIds(new Set());
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Episodes List */}
        <div className="child-episodes-section">
          <div className="child-section-title">
            <h3>Episodes & Files ({sortedEpisodes.length})</h3>
          </div>

          <div className="child-episodes-list">
            {sortedEpisodes.map((ep) => {
              const epLabel = ep.season_num
                ? `S${ep.season_num}:E${ep.episode_num || 1}`
                : `Episode ${ep.episode_num || 1}`;
              const isSelected = childSelectedIds.has(ep.id);
              const watchStatus = getEpisodeWatchStatus(ep);
              const isRunning = ep.status === 'downloading';
              const isPaused = ep.status === 'paused';
              const isFailed = ep.status === 'failed';
              const isDone = ep.status === 'completed';

              const epDisplayTitle = ep.episode_title
                ? `${epLabel} ${ep.episode_title}`
                : `${epLabel}`;

              return (
                <div
                  key={ep.id}
                  className={`child-episode-row ${isSelected ? 'row-selected' : ''}`}
                  onClick={() => {
                    if (childSelectMode) {
                      handleChildToggleSelect(ep.id);
                    } else {
                      onPlayOfflineMedia(
                        ep.file_path,
                        `${currentSeries.mediaTitle} - ${epLabel}: ${ep.episode_title || ''}`,
                        ep,
                        currentSeries.episodes
                      );
                    }
                  }}
                >
                  {/* Left: Watch Progress Container (Play / Ring / Checkmark) */}
                  <WatchPlayProgress
                    percent={watchStatus.percent}
                    isWatched={watchStatus.isWatched}
                    onToggleWatched={(e) => handleToggleWatched(ep, e)}
                  />

                  {/* Middle: Title & Download Size / Progress */}
                  <div className="child-ep-info">
                    <span className="child-ep-title" title={epDisplayTitle}>
                      {epDisplayTitle}
                    </span>

                    <div className="child-ep-size-text">
                      {isDone ? (
                        <span>
                          {formatByteSize(ep.total_bytes > 0 ? ep.total_bytes : ep.downloaded_bytes)}
                        </span>
                      ) : isRunning ? (
                        <span>
                          {formatByteSize(ep.downloaded_bytes)} / {formatByteSize(ep.total_bytes)}
                          {ep.formatted_speed && (
                            <span className="child-ep-speed"> • {ep.formatted_speed}</span>
                          )}
                          {ep.eta_seconds ? (
                            <span className="child-ep-eta"> • ETA {ep.eta_seconds}s</span>
                          ) : null}
                        </span>
                      ) : isPaused ? (
                        <span>
                          Paused • {formatByteSize(ep.downloaded_bytes)} /{' '}
                          {formatByteSize(ep.total_bytes)}
                        </span>
                      ) : isFailed ? (
                        <span style={{ color: '#f43f5e' }}>
                          Failed • {formatByteSize(ep.downloaded_bytes)} /{' '}
                          {formatByteSize(ep.total_bytes)}
                        </span>
                      ) : (
                        <span>Queued • {formatByteSize(ep.total_bytes)}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: PieFetchButton / Device Icon / Checkbox / Hover Actions */}
                  <div className="child-ep-right-widget" onClick={(e) => e.stopPropagation()}>
                    {/* Desktop Hover Quick Actions */}
                    {!childSelectMode && (
                      <div className="child-ep-hover-actions">
                        <button
                          className="btn-icon-subtle"
                          onClick={() => handleOpenFolder(ep.file_path)}
                          title="Reveal in folder"
                        >
                          <FolderOpen size={15} />
                        </button>
                        <button
                          className="btn-icon-danger"
                          onClick={() => handleDeleteItem(ep.id)}
                          title="Delete from disk"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}

                    {/* Checkbox (in multi-select mode) */}
                    {childSelectMode ? (
                      <div
                        className="child-select-checkbox"
                        onClick={() => handleChildToggleSelect(ep.id)}
                      >
                        {isSelected ? (
                          <CheckSquare size={22} color="#7c3aed" fill="#17142d" />
                        ) : (
                          <Square size={22} color="#94a3b8" />
                        )}
                      </div>
                    ) : isDone ? (
                      /* Completed Phone Device Icon (CloudStream download_icon_done.xml) */
                      <button
                        className="cs-download-btn-complete"
                        onClick={() =>
                          onPlayOfflineMedia(
                            ep.file_path,
                            `${currentSeries.mediaTitle} - ${epLabel}: ${ep.episode_title || ''}`,
                            ep,
                            currentSeries.episodes
                          )
                        }
                        title="Downloaded offline (Click to play)"
                      >
                        <CloudStreamDeviceIcon size={24} color="#ffffff" />
                      </button>
                    ) : isRunning ? (
                      /* Active Downloading Clock Radial Pie Progress */
                      <button
                        className="cs-download-btn-pie"
                        onClick={() => handlePauseDownload(ep.id)}
                        title={`Downloading ${ep.progress_pct.toFixed(0)}% (Click to pause)`}
                      >
                        <DownloadPieClock pct={ep.progress_pct} status="downloading" size={24} />
                      </button>
                    ) : isPaused ? (
                      /* Paused Clock Radial Pie Progress */
                      <button
                        className="cs-download-btn-pie"
                        onClick={() => handleResumeDownload(ep.id)}
                        title="Paused (Click to resume)"
                      >
                        <DownloadPieClock pct={ep.progress_pct} status="paused" size={24} />
                      </button>
                    ) : isFailed ? (
                      /* Failed Download Retry */
                      <button
                        className="btn-retry child-action-retry"
                        onClick={(e) => handleRetryDownload(ep.id, e)}
                        title="Failed (Click to retry)"
                      >
                        <RotateCw size={13} /> Retry
                      </button>
                    ) : (
                      /* Queued Download */
                      <div className="cs-download-btn-pie" title="Queued">
                        <DownloadPieClock pct={0} status="pending" size={24} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global drawers & modals */}
        {renderQueueDrawer()}
        {renderDirectModal()}
        {renderNoticeToast()}
      </div>
    );
  }

  return (
    <div className="downloads-page-container animate-fade-in">
      {/* Toast Notice */}
      {renderNoticeToast()}

      {/* Top Header & Storage Bar (CloudStream Android Parity) */}
      <div className="downloads-top-banner">
        <div className="downloads-header-row">
          <div className="downloads-title-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={24} color="#7c3aed" />
              <h1 className="downloads-title">Downloads</h1>
              <span className="downloads-count-badge">
                {downloads.length} {downloads.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="downloads-subtitle">
              Manage saved offline media, track active downloads, and play with zero buffering
            </p>
          </div>

          <div className="downloads-actions-row">
            <button
              className="btn-secondary"
              onClick={() => handleOpenFolder()}
              title="Open download folder in Windows File Explorer"
            >
              <FolderOpen size={15} />
              <span>Open Folder</span>
            </button>

            <button
              className="btn-secondary"
              onClick={() => setShowDirectModal(true)}
              title="Download direct video link or M3U8 stream"
            >
              <Plus size={15} />
              <span>Download URL</span>
            </button>

            <button
              className={`btn-primary ${activeQueueCount > 0 ? 'pulse-btn' : ''}`}
              onClick={() => setShowQueueDrawer(true)}
              title="View active downloads queue"
            >
              <Clock size={15} />
              <span>Queue ({activeQueueCount})</span>
            </button>

            <button
              className="btn-secondary btn-icon-only"
              onClick={fetchDownloadsAndStorage}
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Disk Storage Proportional Progress Bar */}
        {diskInfo && (
          <div className="downloads-storage-wrapper">
            <div className="storage-legend-row">
              <div className="storage-legend-item">
                <span className="legend-dot dot-cloudstream" />
                <span>CloudStream: <strong>{diskInfo.formatted_cloudstream}</strong></span>
              </div>
              <div className="storage-legend-item">
                <span className="legend-dot dot-free" />
                <span>Free Space: <strong>{diskInfo.formatted_available}</strong></span>
              </div>
              <div className="storage-legend-item">
                <span className="legend-dot dot-used" />
                <span>Drive Total: <strong>{diskInfo.formatted_total}</strong></span>
              </div>
            </div>

            <div className="storage-progress-bar">
              <div
                className="storage-segment-cloudstream"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(1, (diskInfo.cloudstream_download_bytes / diskInfo.total_space_bytes) * 100)
                  )}%`,
                }}
                title={`CloudStream: ${diskInfo.formatted_cloudstream}`}
              />
              <div
                className="storage-segment-used"
                style={{
                  width: `${Math.min(
                    100,
                    (diskInfo.used_space_bytes / diskInfo.total_space_bytes) * 100
                  )}%`,
                }}
                title={`System Used: ${diskInfo.formatted_used}`}
              />
              <div className="storage-segment-free" />
            </div>
          </div>
        )}
      </div>

      {/* Filter, Search & Multi-Select Toolbar */}
      <div className="downloads-toolbar-row">
        <div className="downloads-filter-chips">
          {(['all', 'movies', 'series', 'anime'] as const).map((t) => (
            <button
              key={t}
              className={`filter-chip ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' && 'All Media'}
              {t === 'movies' && 'Movies'}
              {t === 'series' && 'TV Series'}
              {t === 'anime' && 'Anime'}
            </button>
          ))}
        </div>

        <div className="downloads-search-wrap">
          <Search size={14} className="downloads-search-icon" />
          <input
            type="text"
            className="downloads-search-input"
            placeholder="Search downloaded media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="downloads-controls-right">
          <select
            className="stremio-select downloads-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="date">Sort: Date Added</option>
            <option value="name">Sort: Title (A-Z)</option>
            <option value="size">Sort: Size (Largest)</option>
          </select>

          <button
            className={`btn-secondary ${isSelectMode ? 'active' : ''}`}
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
          >
            <CheckSquare size={14} />
            <span>{isSelectMode ? 'Done' : 'Select'}</span>
          </button>
        </div>
      </div>

      {/* Multi-Select Floating Action Bar */}
      {isSelectMode && (
        <div className="downloads-select-bar animate-scale-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>
              {selectedIds.size} Selected
            </span>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              ({formatByteSize(selectedBytesTotal)})
            </span>
            <button className="settings-btn-subtle" onClick={handleSelectAll}>
              Select All
            </button>
            <button className="settings-btn-subtle" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn-icon-danger"
              style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', gap: '6px' }}
              disabled={selectedIds.size === 0}
              onClick={handleBatchDeleteSelected}
            >
              <Trash2 size={14} />
              <span>Delete Selected</span>
            </button>
            <button className="btn-secondary" onClick={() => setIsSelectMode(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Downloaded Media Catalog Grid */}
      {groupedMedia.length > 0 ? (
        <div className="downloads-media-grid">
          {groupedMedia.map((group) => {
            const isMovie = group.tvType.toLowerCase().includes('movie');
            const singleEp = isMovie ? group.episodes[0] : null;
            const isSelected = isMovie
              ? selectedIds.has(singleEp?.id || '')
              : group.episodes.every((e) => selectedIds.has(e.id));

            return (
              <div
                key={group.parentId}
                className={`download-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isSelectMode) {
                    if (isMovie && singleEp) {
                      handleToggleSelectId(singleEp.id);
                    } else {
                      // Toggle all episodes in group
                      const allGroupSelected = group.episodes.every((e) => selectedIds.has(e.id));
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        group.episodes.forEach((e) => {
                          if (allGroupSelected) next.delete(e.id);
                          else next.add(e.id);
                        });
                        return next;
                      });
                    }
                  } else if (isMovie && singleEp && singleEp.status === 'completed') {
                    onPlayOfflineMedia(singleEp.file_path, singleEp.media_title, singleEp);
                  } else {
                    setSelectedParentId(group.parentId);
                  }
                }}
              >
                {/* Poster Container */}
                <div className="download-poster-wrap">
                  {group.posterUrl ? (
                    <img
                      src={group.posterUrl}
                      alt={group.mediaTitle}
                      className="download-poster-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="download-poster-fallback">
                      {isMovie ? <Film size={36} color="#7c3aed" /> : <Tv size={36} color="#7c3aed" />}
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className="download-type-pill">
                    {isMovie ? 'Movie' : `${group.totalEpisodesCount} Eps`}
                  </span>

                  {/* Multi-Select Checkbox Overlay */}
                  {isSelectMode && (
                    <div
                      className="card-checkbox-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isMovie && singleEp) {
                          handleToggleSelectId(singleEp.id);
                        } else {
                          const allGroupSelected = group.episodes.every((e) => selectedIds.has(e.id));
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            group.episodes.forEach((ep) => {
                              if (allGroupSelected) next.delete(ep.id);
                              else next.add(ep.id);
                            });
                            return next;
                          });
                        }
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} color="#7c3aed" fill="#17142d" />
                      ) : (
                        <Square size={20} color="#94a3b8" />
                      )}
                    </div>
                  )}

                  {/* Play Action Hover Button */}
                  {!isSelectMode && (
                    <div className="download-play-overlay">
                      <div className="download-play-bubble">
                        <Play size={20} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="download-card-meta">
                  <div className="download-card-title" title={group.mediaTitle}>
                    {group.mediaTitle}
                  </div>

                  <div className="download-card-sub">
                    <span>{formatByteSize(group.totalBytes)}</span>
                    <span style={{ opacity: 0.4 }}>•</span>
                    <span style={{ color: group.completedEpisodesCount === group.totalEpisodesCount ? '#10b981' : '#f59e0b' }}>
                      {group.completedEpisodesCount}/{group.totalEpisodesCount} ready
                    </span>
                  </div>

                  {/* Quick Card Action Buttons */}
                  {!isSelectMode && (
                    <div className="download-card-footer" onClick={(e) => e.stopPropagation()}>
                      {isMovie && singleEp && singleEp.status === 'completed' ? (
                        <button
                          className="btn-primary card-action-btn"
                          onClick={() => onPlayOfflineMedia(singleEp.file_path, singleEp.media_title, singleEp)}
                        >
                          <Play size={12} fill="currentColor" /> Play Offline
                        </button>
                      ) : (
                        <button
                          className="btn-secondary card-action-btn"
                          onClick={() => setSelectedParentId(group.parentId)}
                        >
                          <Layers size={12} /> View Details
                        </button>
                      )}

                      <button
                        className="btn-icon-danger card-delete-btn"
                        onClick={() => handleDeleteGroup(group)}
                        title="Delete from disk"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="downloads-empty-state animate-fade-in">
          <div className="empty-icon-circle">
            <Download size={44} color="#7c3aed" />
          </div>
          <h2 className="empty-state-title">No Offline Downloads Found</h2>
          <p className="empty-state-desc">
            Movies and TV episodes you download will appear here for high-speed offline playback.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button className="btn-primary" onClick={() => setShowDirectModal(true)}>
              <Plus size={15} /> Download from URL
            </button>
            {onNavigateToDiscover && (
              <button className="btn-secondary" onClick={onNavigateToDiscover}>
                <Compass size={15} /> Discover Media
              </button>
            )}
          </div>
        </div>
      )}

      {renderQueueDrawer()}
      {renderDirectModal()}
    </div>
  );
};
