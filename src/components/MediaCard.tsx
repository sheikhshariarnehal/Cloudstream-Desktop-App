import React from 'react';
import { SearchResponse } from '../types';
import { Play } from 'lucide-react';

interface MediaCardProps {
  item: SearchResponse;
  onClick: (item: SearchResponse) => void;
  progressPercent?: number;
  subtitle?: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, progressPercent, subtitle }) => {
  // Quality badge text (defaults to 'HD' matching the screenshot)
  const qualityBadge = item.quality || 'HD';

  // Determine episode label if series
  const episodeLabel = item.season && item.episode
    ? `S${item.season}:E${item.episode}`
    : item.latest_episode
    ? `Ep ${item.latest_episode}`
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

        {/* Hover Play Icon Overlay */}
        <div className="stremio-card-hover-overlay">
          <div className="stremio-play-bubble">
            <Play size={18} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
          </div>
        </div>

        {/* Top-Left Quality Badge (Matches Exact Screenshot) */}
        <div className="media-badge-hd">
          {qualityBadge}
        </div>

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

      {/* Centered Title (Exact Screenshot Parity) */}
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
