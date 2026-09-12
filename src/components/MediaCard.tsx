import React from 'react';
import { SearchResponse } from '../types';

interface MediaCardProps {
  item: SearchResponse;
  onClick: (item: SearchResponse) => void;
  progressPercent?: number;
  subtitle?: string;
  showProvider?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onClick,
  progressPercent,
  subtitle,
  showProvider = false,
}) => {
  // Quality badge text (only when explicitly provided by provider)
  const qualityBadge = item.quality;

  // Determine episode label if series
  const episodeLabel = item.season && item.episode
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

  return (
    <div className="stremio-card" onClick={() => onClick(item)}>
      <div className="stremio-poster-wrap">
        <img
          className="stremio-poster-img"
          src={item.poster_url || 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&auto=format&fit=crop&q=60'}
          alt={item.name}
          loading="lazy"
        />

        {/* Top-Left Quality Badge */}
        {qualityBadge && (
          <div className="media-badge-hd">
            {qualityBadge}
          </div>
        )}

        {/* Dub/Sub Badge */}
        {dubLabel && (
          <div className="media-badge-dub">
            {dubLabel}
          </div>
        )}

        {/* Top-Right Score Badge */}
        {item.score !== undefined && item.score > 0 && (
          <div className="media-badge-score">
            ★ {item.score.toFixed(1)}
          </div>
        )}

        {/* Provider Tag (Useful in multi-provider search grid) */}
        {showProvider && item.api_name && (
          <div className="media-badge-provider">
            {item.api_name}
          </div>
        )}

        {/* Episode Badge (for TV Series / Continue Watching) */}
        {episodeLabel && (
          <div className="stremio-badge-episode">
            {episodeLabel}
          </div>
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

      {subtitle && (
        <div className="stremio-card-sub-centered">
          {subtitle}
        </div>
      )}
    </div>
  );
};
