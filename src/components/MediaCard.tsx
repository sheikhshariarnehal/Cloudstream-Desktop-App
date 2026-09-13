import React, { useState, useRef, useEffect } from 'react';
import { SearchResponse } from '../types';
import { Play, X, Star, MoreVertical, Trash2, Info } from 'lucide-react';

interface MediaCardProps {
  item: SearchResponse;
  onClick: (item: SearchResponse) => void;
  onPlay?: (item: SearchResponse, e: React.MouseEvent) => void;
  onRemove?: (item: SearchResponse, e: React.MouseEvent) => void;
  progressPercent?: number;
  subtitle?: string;
  showProvider?: boolean;
  isHorizontal?: boolean;
  isContinueWatching?: boolean;
}

const MediaCardComponent: React.FC<MediaCardProps> = ({
  item,
  onClick,
  onPlay,
  onRemove,
  progressPercent,
  subtitle,
  showProvider = false,
  isHorizontal = false,
  isContinueWatching,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Determine if this is treated as a Continue Watching item
  const isCW = Boolean(
    isContinueWatching ||
    (progressPercent !== undefined && progressPercent > 0) ||
    onRemove
  );

  // Quality badge text (only when explicitly provided by provider)
  const qualityBadge = item.quality;

  // Determine episode label only for non-movie types
  const episodeLabel =
    item.tv_type === 'Movie'
      ? null
      : item.season && item.episode
      ? `S${item.season}:E${item.episode}`
      : item.latest_episode
      ? `Ep ${item.latest_episode}`
      : null;

  // Dub status (matching CloudStream Android casing: Dub, Sub, Dub & Sub)
  const dubLabel =
    item.dub_status === 'Both'
      ? 'Dub & Sub'
      : item.dub_status === 'Dubbed'
      ? 'Dub'
      : item.dub_status === 'Subbed'
      ? 'Sub'
      : null;

  // CloudStream score badge color threshold
  const scoreColor =
    item.score === undefined || item.score <= 0
      ? '#eda009'
      : item.score < 5.0
      ? '#eb2f2f'
      : item.score < 8.0
      ? '#eda009'
      : '#3bb33b';

  return (
    <div
      className={`stremio-card ${isHorizontal ? 'horizontal' : ''} ${isCW ? 'continue-watching' : ''}`}
      onClick={() => onClick(item)}
    >
      <div className="stremio-poster-wrap">
        <img
          className="stremio-poster-img"
          src={
            item.poster_url ||
            'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=60'
          }
          alt={item.name}
          loading="lazy"
        />

        {/* Hover Dim Overlay for clean contrast */}
        <div className="stremio-poster-hover-overlay" />

        {/* Top-Left Quick Remove 'X' Button */}
        {onRemove && (
          <button
            type="button"
            className="cw-quick-remove-btn"
            title="Remove from Continue Watching"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item, e);
            }}
          >
            <X size={14} color="#ffffff" strokeWidth={2.5} />
          </button>
        )}

        {/* Center Play Button */}
        <button
          type="button"
          className="cw-center-play-btn"
          title="Play Now"
          onClick={(e) => {
            e.stopPropagation();
            if (onPlay) {
              onPlay(item, e);
            } else {
              onClick(item);
            }
          }}
        >
          <Play size={20} fill="#ffffff" strokeWidth={0} style={{ marginLeft: '2px' }} />
        </button>

        {/* Top-Left Quality Badge */}
        {qualityBadge && !onRemove && <div className="media-badge-hd">{qualityBadge}</div>}

        {/* Dub/Sub Badge */}
        {dubLabel && (
          <div
            className={`media-badge-dub ${
              item.dub_status === 'Both'
                ? 'both'
                : item.dub_status === 'Dubbed'
                ? 'dubbed'
                : item.dub_status === 'Subbed'
                ? 'subbed'
                : ''
            }`}
          >
            {dubLabel}
          </div>
        )}

        {/* Top-Right Score Badge with CloudStream Colors */}
        {item.score !== undefined && item.score > 0 && (
          <div
            className="media-badge-score"
            style={{ backgroundColor: `${scoreColor}cc`, borderColor: scoreColor }}
          >
            <Star size={10} fill="#ffffff" color="#ffffff" style={{ marginRight: '2px' }} />
            <span>{item.score.toFixed(1)}</span>
          </div>
        )}

        {/* Provider Tag (Useful in multi-provider search grid) */}
        {showProvider && item.api_name && (
          <div className="media-badge-provider">{item.api_name}</div>
        )}

        {/* Episode Badge (for TV Series / Continue Watching) */}
        {episodeLabel && !progressPercent && (
          <div className="stremio-badge-episode">{episodeLabel}</div>
        )}

        {/* Floating Inset Progress Bar */}
        {progressPercent !== undefined && progressPercent > 0 && (
          <div className="cw-progress-bar-container">
            <div
              className="cw-progress-fill"
              style={{ width: `${Math.min(Math.max(progressPercent, 4), 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Card Info & Title with 3-Dots Menu (only on Continue Watching) */}
      <div className={`cw-card-info-row ${!isCW ? 'catalog-card' : ''}`}>
        <div className="cw-card-title-centered" title={item.name}>
          {item.name}
        </div>

        {isCW && (
          <div className={`cw-card-menu-anchor ${showMenu ? 'open' : ''}`} ref={menuRef}>
            <button
              type="button"
              className="cw-card-more-btn"
              title="More options"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
            >
              <MoreVertical size={15} />
            </button>

            {showMenu && (
              <div className="cw-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {onPlay && (
                  <button
                    type="button"
                    className="cw-dropdown-item"
                    onClick={(e) => {
                      setShowMenu(false);
                      onPlay(item, e);
                    }}
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Resume Playing</span>
                  </button>
                )}
                <button
                  type="button"
                  className="cw-dropdown-item"
                  onClick={() => {
                    setShowMenu(false);
                    onClick(item);
                  }}
                >
                  <Info size={13} />
                  <span>View Details</span>
                </button>
                {onRemove && (
                  <button
                    type="button"
                    className="cw-dropdown-item danger"
                    onClick={(e) => {
                      setShowMenu(false);
                      onRemove(item, e);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Remove from History</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {subtitle && <div className="stremio-card-sub-centered">{subtitle}</div>}
    </div>
  );
};

// Memoized: prevents every card in every shelf from re-rendering whenever an
// unrelated piece of App state changes (search input, dropdown toggles, etc).
export const MediaCard = React.memo(MediaCardComponent);

