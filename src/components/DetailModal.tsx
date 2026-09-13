import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Episode,
  ExtractorLink,
  LoadResponse,
  SearchResponse,
  WatchHistoryItem,
  WatchlistItem,
  DubStatus,
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
} from 'lucide-react';

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

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onPlay,
  onSelectItem,
}) => {
  const [details, setDetails] = useState<LoadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Watch History & Progress
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);

  // Watchlist State
  const [watchlistStatus, setWatchlistStatus] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Stream Extraction State
  const [extractingKey, setExtractingKey] = useState<string | null>(null);

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
  const isEpisodeBased = !isMovie;

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

  // Load Media Details and History
  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, history, watchlist] = await Promise.all([
        invoke<LoadResponse>('load_media', {
          provider: item.api_name,
          url: item.url,
        }),
        invoke<WatchHistoryItem[]>('get_media_watch_history', {
          mediaId: item.url,
        }).catch(() => [] as WatchHistoryItem[]),
        invoke<WatchlistItem[]>('get_watchlist').catch(
          () => [] as WatchlistItem[]
        ),
      ]);

      setDetails(res);
      setWatchHistory(history);

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

        const firstSeason = res.episodes[0].season || 1;
        setSelectedSeason(firstSeason);
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

  // Keyboard Escape Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTrailerUrl) {
          setActiveTrailerUrl(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activeTrailerUrl]);

  // Progress Map: key = `${season}_${episode}` -> WatchHistoryItem
  const progressMap = useMemo(() => {
    const map = new Map<string, WatchHistoryItem>();
    for (const h of watchHistory) {
      const s = h.season_num ?? 1;
      const e = h.episode_num ?? 1;
      map.set(`${s}_${e}`, h);
    }
    return map;
  }, [watchHistory]);

  // Most recent watched item for Resume
  const resumeItem = useMemo(() => {
    if (!watchHistory || watchHistory.length === 0) return null;
    return [...watchHistory].sort(
      (a, b) => b.last_watched_at - a.last_watched_at
    )[0];
  }, [watchHistory]);

  // Handle Play Episode / Movie
  const handlePlayEpisode = async (ep: Episode) => {
    const epKey = `${ep.season || 1}_${ep.episode}`;
    setExtractingKey(epKey);
    try {
      const links: ExtractorLink[] = await invoke('load_links', {
        provider: item.api_name,
        data: ep.data,
      });
      if (links && links.length > 0) {
        const epHist = watchHistory.find(
          (h) => (h.season_num ?? 1) === (ep.season || 1) && (h.episode_num ?? 1) === ep.episode
        );
        const startTime =
          epHist &&
          epHist.position_ms > 3000 &&
          !epHist.is_completed &&
          (epHist.duration_ms === 0 || epHist.position_ms / epHist.duration_ms < 0.95)
            ? epHist.position_ms / 1000
            : undefined;

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
          label: `Resume Movie (${remainingMins}m left)`,
          progress: percent,
          episode: ep,
        };
      }

      return {
        label: 'Play Movie',
        progress: null,
        episode: ep,
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
            label: `Resume S${sNum}:E${eNum} (${remainingMins}m left)`,
            progress: percent,
            episode: match,
          };
        } else {
          return {
            label: `Play S${sNum}:E${eNum}`,
            progress: null,
            episode: match,
          };
        }
      }
    }

    const firstEp = details.episodes[0];
    if (firstEp) {
      return {
        label: `Play S${firstEp.season || 1}:E${firstEp.episode}`,
        progress: null,
        episode: firstEp,
      };
    }

    return null;
  }, [details, isMovie, resumeItem]);

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

  // Year fallback (CloudStream ResultViewModel2 logic)
  const displayYear = useMemo(() => {
    if (details?.year) return details.year;
    if (item.year) return item.year;
    const match = (details?.name || item.name || '').match(/\b(19\d\d|20\d\d)\b/);
    return match ? parseInt(match[1], 10) : null;
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
          onClick={onClose}
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
          <button className="stremio-retry-btn" onClick={fetchDetails}>
            Retry
          </button>
        </div>
      ) : details ? (
        <div className="stremio-detail-split-view">
          {/* LEFT PANEL: Title, Meta, Genres, Cast, Summary, Action Buttons */}
          <div className="stremio-left-info-panel">
            {/* Main Stylized Title */}
            <h1 className="stremio-media-title">{details.name}</h1>

            {/* Anime Japanese/English Alt Title */}
            {(details.jap_name || details.eng_name) && (
              <div className="stremio-alt-title">
                {details.jap_name}
                {details.eng_name && details.eng_name !== details.name && (
                  <span> • {details.eng_name}</span>
                )}
              </div>
            )}

            {/* Meta Row: Type Badge, Series Stats / Duration, Year, Rating, Status */}
            <div className="stremio-meta-row">
              {/* CloudStream TvType Badge */}
              <span
                className={`stremio-meta-badge type-badge ${
                  effectiveTvType?.toLowerCase() || ''
                }`}
              >
                {typeLabel}
              </span>

              {/* Show Status Badge (Ongoing / Completed) */}
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

              {/* Series Seasons & Episode count OR Movie Duration */}
              {isEpisodeBased ? (
                seriesStats.detailLabel ? (
                  <span className="stremio-meta-val series-stats-val">
                    {seriesStats.detailLabel}
                  </span>
                ) : null
              ) : details.duration_minutes ? (
                <span className="stremio-meta-val">
                  {details.duration_minutes} min
                </span>
              ) : null}

              {/* Series per-episode average duration if available */}
              {isEpisodeBased && details.duration_minutes ? (
                <span className="stremio-meta-val ep-duration-val">
                  ~{details.duration_minutes}m/ep
                </span>
              ) : null}

              {/* Year (with – suffix for series) */}
              {displayYear ? (
                <span className="stremio-meta-val">
                  {displayYear}
                  {isEpisodeBased ? '–' : ''}
                </span>
              ) : null}

              {/* IMDb Score */}
              {displayScore !== undefined && displayScore !== null ? (
                <span className="stremio-meta-val rating-val">
                  {displayScore.toFixed(1)}
                  <span className="stremio-imdb-badge">IMDb</span>
                </span>
              ) : null}

              {/* Content Rating */}
              {details.content_rating && (
                <span className="stremio-meta-badge">
                  {details.content_rating}
                </span>
              )}
            </div>

            {/* Next Airing Alert (Anime) */}
            {nextAiringText && (
              <div className="stremio-next-airing-banner">
                <Radio size={14} className="pulse-icon" />
                <span>{nextAiringText}</span>
              </div>
            )}

            {/* GENRES Section */}
            {details.tags && details.tags.length > 0 && (
              <div className="stremio-info-section">
                <div className="stremio-section-label">GENRES</div>
                <div className="stremio-chips-row">
                  {details.tags.slice(0, 6).map((genre) => (
                    <span key={genre} className="stremio-pill-chip">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CAST Section */}
            {details.cast && details.cast.length > 0 && (
              <div className="stremio-info-section">
                <div className="stremio-section-label">CAST</div>
                <div className="stremio-chips-row">
                  {details.cast.slice(0, 5).map((actor) => (
                    <span key={actor.name} className="stremio-pill-chip">
                      {actor.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* SUMMARY Section */}
            <div className="stremio-info-section summary-section">
              <div className="stremio-section-label">SUMMARY</div>
              <p className="stremio-summary-text">
                {details.plot || 'No summary available for this title.'}
              </p>
            </div>

            {/* ACTION BUTTONS BAR */}
            <div className="stremio-actions-bar">
              {/* Primary Play / Resume CTA */}
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
          </div>

          {/* RIGHT PANEL: Episodes & Season Picker (or Recommendations for Movies) */}
          <div className="stremio-right-episodes-panel">
            {!isMovie ? (
              <>
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
                    placeholder="search videos"
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
                      const history = progressMap.get(epKey);
                      const progressPercent =
                        history && history.duration_ms > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (history.position_ms / history.duration_ms) *
                                  100
                              )
                            )
                          : 0;
                      const isExtracting = extractingKey === epKey;

                      return (
                        <div
                          key={epKey}
                          className={`stremio-episode-item ${
                            isExtracting ? 'extracting' : ''
                          }`}
                          onClick={() => handlePlayEpisode(ep)}
                        >
                          {/* 16:9 Thumbnail preview */}
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

                            {/* Play Overlay */}
                            <div className="stremio-ep-thumb-overlay">
                              {isExtracting ? (
                                <div className="stremio-mini-spinner" />
                              ) : (
                                <Play size={20} fill="#ffffff" color="#ffffff" />
                              )}
                            </div>

                            {/* Watched checkmark */}
                            {history?.is_completed && (
                              <div className="stremio-ep-watched-check">
                                <Check size={11} strokeWidth={3} />
                              </div>
                            )}

                            {/* Progress bar at bottom */}
                            {progressPercent > 0 && (
                              <div className="stremio-ep-progress-bar">
                                <div
                                  className="stremio-ep-progress-fill"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Episode Title & Date */}
                          <div className="stremio-ep-meta">
                            <div className="stremio-ep-title" title={ep.name}>
                              {ep.episode}. {ep.name || `Episode ${ep.episode}`}
                            </div>
                            {ep.release_date && (
                              <div className="stremio-ep-date">
                                {ep.release_date}
                              </div>
                            )}
                            {ep.description && (
                              <div className="stremio-ep-desc">
                                {ep.description}
                              </div>
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
              </>
            ) : (
              /* Movie Right Panel: Recommendations & Details */
              <div className="stremio-movie-right-panel">
                <div className="movie-panel-title">More Like This</div>
                {details.recommendations && details.recommendations.length > 0 ? (
                  <div className="stremio-movie-recs-grid">
                    {details.recommendations.map((rec) => (
                      <div
                        key={rec.url}
                        className="stremio-movie-rec-card"
                        onClick={() => onSelectItem?.(rec)}
                      >
                        <img
                          src={
                            rec.poster_url ||
                            'https://via.placeholder.com/160x240'
                          }
                          alt={rec.name}
                          className="movie-rec-poster"
                        />
                        <div className="movie-rec-name" title={rec.name}>
                          {rec.name}
                        </div>
                        {rec.year && (
                          <div className="movie-rec-year">{rec.year}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="stremio-no-recs">
                    <span>No recommendations available</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
