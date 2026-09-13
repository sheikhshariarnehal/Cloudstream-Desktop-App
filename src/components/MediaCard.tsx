import React from 'react';
import { SearchResponse } from '../types';
import { Play, X, Star } from 'lucide-react';

interface MediaCardProps {
  item: SearchResponse;
  onClick: (item: SearchResponse) => void;
  onPlay?: (item: SearchResponse, e: React.MouseEvent) => void;
  onRemove?: (item: SearchResponse, e: React.MouseEvent) => void;
  progressPercent?: number;
  subtitle?: string;
  showProvider?: boolean;
  isHorizontal?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onClick,
  onPlay,
  onRemove,
  progressPercent,
  subtitle,
  showProvider = false,
  isHorizontal = false,
}) => {
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
    <div className={`stremio-card ${isHorizontal ? 'horizontal' : ''}`} onClick={() => onClick(item)}>
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

        {/* Hover Quick Actions Overlay */}
        <div className="card-hover-actions">
          {onPlay && (
            <button
              type="button"
              className="card-quick-play-btn"
              title="Play Now"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(item, e);
              }}
            >
              <Play size={16} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              className="card-quick-remove-btn"
              title="Remove from history"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item, e);
              }}
            >
              <X size={14} color="#ffffff" />
            </button>
          )}
        </div>

        {/* Top-Left Quality Badge */}
        {qualityBadge && <div className="media-badge-hd">{qualityBadge}</div>}

        {/* Dub/Sub Badge */}
        {dubLabel && <div className="media-badge-dub">{dubLabel}</div>}

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
        {episodeLabel && (
          <div className="stremio-badge-episode">{episodeLabel}</div>
        )}

        {/* Watch Progress Bar (if in progress) */}
        {progressPercent !== undefined && progressPercent > 0 && (
          <div className="stremio-progress-bar">
            <div
              className="stremio-progress-fill"
              style={{ width: `${Math.min(Math.max(progressPercent, 5), 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Centered Title */}
      <div className="stremio-card-title-centered" title={item.name}>
        {item.name}
      </div>

      {subtitle && <div className="stremio-card-sub-centered">{subtitle}</div>}
    </div>
  );
};

