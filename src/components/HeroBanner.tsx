import React, { useState, useEffect, useRef } from 'react';
import { SearchResponse, LoadResponse } from '../types';
import {
  Play,
  Info,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Sparkles,
  ChevronDown,
  Bookmark,
} from 'lucide-react';

interface HeroBannerProps {
  items: SearchResponse[];
  loadedDetails?: Record<string, LoadResponse>;
  onSelectItem: (item: SearchResponse) => void;
  onPlayItem?: (item: SearchResponse) => void;
  onToggleWatchlist?: (item: SearchResponse, status?: string) => void;
  isInWatchlist?: (item: SearchResponse) => boolean;
  currentWatchStatus?: (item: SearchResponse) => string | undefined;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  loadedDetails,
  onSelectItem,
  onPlayItem,
  onToggleWatchlist,
  isInWatchlist,
  currentWatchStatus,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Take top 8 items with valid posters
  const heroItems = items.filter((it) => it.poster_url && it.name).slice(0, 8);

  useEffect(() => {
    if (heroItems.length <= 1 || isPaused || showStatusDropdown) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroItems.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [heroItems.length, isPaused, showStatusDropdown]);

  // Close status dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (heroItems.length === 0) return null;

  const currentItem = heroItems[currentIndex];
  const detail = loadedDetails?.[currentItem.url];
  const inWatchlist = isInWatchlist ? isInWatchlist(currentItem) : false;
  const activeStatus = currentWatchStatus ? currentWatchStatus(currentItem) : undefined;

  const backdropUrl = detail?.background_poster_url || currentItem.poster_url;
  const displayPlot =
    detail?.plot ||
    `Experience ${currentItem.name} in ultra-crisp resolution. Stream instantly via high-speed CloudStream Direct3D 11 hardware-accelerated playback.`;
  const displayYear = detail?.year || currentItem.year;
  const displayTags = detail?.tags?.slice(0, 3) || [];
  const durationText = detail?.duration_minutes ? `${detail.duration_minutes}m` : null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? heroItems.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % heroItems.length);
  };

  const tvTypeLabel =
    currentItem.tv_type === 'TvSeries'
      ? 'Series'
      : currentItem.tv_type === 'Anime'
      ? 'Anime'
      : currentItem.tv_type === 'AsianDrama'
      ? 'Asian Drama'
      : 'Movie';

  // CloudStream score rating color rule:
  // Red (< 5.0), Yellow (5.0 - 7.9), Green (>= 8.0)
  const score = currentItem.score || 8.4;
  const scoreColor =
    score < 5.0 ? '#eb2f2f' : score < 8.0 ? '#eda009' : '#3bb33b';

  const watchStatuses: { id: string; label: string }[] = [
    { id: 'watching', label: 'Watching' },
    { id: 'plan_to_watch', label: 'Plan to Watch' },
    { id: 'completed', label: 'Completed' },
    { id: 'on_hold', label: 'On Hold' },
    { id: 'dropped', label: 'Dropped' },
  ];

  return (
    <div
      className="stremio-hero-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={() => onSelectItem(currentItem)}
    >
      {/* Background Image with Cinematic Dark Vignette */}
      <div className="stremio-hero-backdrop-wrap">
        <div
          className="stremio-hero-backdrop"
          style={{
            backgroundImage: `url(${backdropUrl})`,
          }}
        />
        <div className="stremio-hero-overlay" />
      </div>

      {/* Navigation Arrows */}
      {heroItems.length > 1 && (
        <>
          <button
            type="button"
            className="stremio-hero-nav-btn left"
            onClick={handlePrev}
            title="Previous Featured"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="stremio-hero-nav-btn right"
            onClick={handleNext}
            title="Next Featured"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Hero Content Section */}
      <div className="stremio-hero-content">
        {/* Featured Tag */}
        <div className="stremio-hero-badge-tag">
          <Sparkles size={13} className="hero-sparkle-icon" />
          <span>FEATURED SPOTLIGHT</span>
        </div>

        {/* Title */}
        <h1 className="stremio-hero-title">{currentItem.name}</h1>

        {/* Metadata Chips Row with CloudStream Score Color */}
        <div className="stremio-hero-meta-row">
          {displayYear && (
            <span className="hero-meta-chip hero-year-chip">{displayYear}</span>
          )}
          <span className="hero-meta-chip hero-type-chip">{tvTypeLabel}</span>
          {durationText && (
            <span className="hero-meta-chip hero-duration-chip">{durationText}</span>
          )}
          <span className="hero-meta-chip hero-quality-chip">
            {currentItem.quality || '4K UHD'}
          </span>
          <span
            className="hero-meta-chip hero-rating-chip"
            style={{
              backgroundColor: `${scoreColor}25`,
              borderColor: `${scoreColor}80`,
              color: scoreColor,
            }}
          >
            <Star size={12} fill={scoreColor} color={scoreColor} />
            <span style={{ fontWeight: 700 }}>{score.toFixed(1)}</span>
          </span>
          {displayTags.map((tag) => (
            <span key={tag} className="hero-meta-chip hero-genre-chip">
              {tag}
            </span>
          ))}
          {currentItem.api_name && (
            <span className="hero-meta-chip hero-provider-chip">
              {currentItem.api_name}
            </span>
          )}
        </div>

        {/* Description / Synopsis Teaser */}
        <p className="stremio-hero-description">
          {displayPlot}
        </p>

        {/* CTA Buttons */}
        <div className="stremio-hero-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="stremio-hero-play-btn"
            onClick={() => {
              if (onPlayItem) {
                onPlayItem(currentItem);
              } else {
                onSelectItem(currentItem);
              }
            }}
          >
            <Play size={18} fill="#ffffff" color="#ffffff" style={{ marginLeft: '2px' }} />
            <span>Play Now</span>
          </button>

          <button
            type="button"
            className="stremio-hero-info-btn"
            onClick={() => onSelectItem(currentItem)}
          >
            <Info size={18} />
            <span>Details & Streams</span>
          </button>

          {/* Library / Watchlist Status Dropdown */}
          {onToggleWatchlist && (
            <div className="hero-watchlist-menu-container" ref={statusMenuRef}>
              <button
                type="button"
                className={`stremio-hero-watchlist-btn ${inWatchlist ? 'active' : ''}`}
                onClick={() => setShowStatusDropdown((prev) => !prev)}
                title={inWatchlist ? 'Manage Bookmark Status' : 'Add to Library'}
              >
                {inWatchlist ? <Check size={17} /> : <Bookmark size={17} />}
                <span>
                  {activeStatus
                    ? activeStatus.replace('_', ' ').toUpperCase()
                    : inWatchlist
                    ? 'In Library'
                    : 'Library'}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.7 }} />
              </button>

              {showStatusDropdown && (
                <div className="hero-status-dropdown-menu">
                  <div className="hero-status-dropdown-header">Bookmark Status</div>
                  {watchStatuses.map((st) => {
                    const isSelected = activeStatus === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        className={`hero-status-option ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          onToggleWatchlist(currentItem, st.id);
                          setShowStatusDropdown(false);
                        }}
                      >
                        <span>{st.label}</span>
                        {isSelected && <Check size={14} color="var(--stremio-purple-light)" />}
                      </button>
                    );
                  })}
                  {inWatchlist && (
                    <button
                      type="button"
                      className="hero-status-option remove-option"
                      onClick={() => {
                        onToggleWatchlist(currentItem);
                        setShowStatusDropdown(false);
                      }}
                    >
                      <span>Remove from Library</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide Pagination Dots */}
      {heroItems.length > 1 && (
        <div className="stremio-hero-dots" onClick={(e) => e.stopPropagation()}>
          {heroItems.map((item, idx) => (
            <button
              key={item.url || idx}
              type="button"
              className={`stremio-hero-dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              title={item.name}
            />
          ))}
        </div>
      )}
    </div>
  );
};
