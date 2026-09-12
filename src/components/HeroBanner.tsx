import React, { useState, useEffect, useRef } from 'react';
import { SearchResponse } from '../types';
import { Play, Info, Plus, Check, ChevronLeft, ChevronRight, Star, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  items: SearchResponse[];
  onSelectItem: (item: SearchResponse) => void;
  onToggleWatchlist?: (item: SearchResponse) => void;
  isInWatchlist?: (item: SearchResponse) => boolean;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  onSelectItem,
  onToggleWatchlist,
  isInWatchlist,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Take top 6 items with valid posters
  const heroItems = items.filter((it) => it.poster_url && it.name).slice(0, 6);

  useEffect(() => {
    if (heroItems.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroItems.length);
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [heroItems.length, isPaused]);

  if (heroItems.length === 0) return null;

  const currentItem = heroItems[currentIndex];
  const inWatchlist = isInWatchlist ? isInWatchlist(currentItem) : false;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? heroItems.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % heroItems.length);
  };

  const tvTypeLabel = currentItem.tv_type === 'TvSeries'
    ? 'Series'
    : currentItem.tv_type === 'Anime'
    ? 'Anime'
    : 'Movie';

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
            backgroundImage: `url(${currentItem.poster_url})`,
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

        {/* Metadata Chips Row */}
        <div className="stremio-hero-meta-row">
          {currentItem.year && (
            <span className="hero-meta-chip hero-year-chip">{currentItem.year}</span>
          )}
          <span className="hero-meta-chip hero-type-chip">{tvTypeLabel}</span>
          <span className="hero-meta-chip hero-quality-chip">
            {currentItem.quality || '4K UHD'}
          </span>
          <span className="hero-meta-chip hero-rating-chip">
            <Star size={12} fill="#f59e0b" color="#f59e0b" />
            <span>{currentItem.score ? currentItem.score.toFixed(1) : '8.6'}</span>
          </span>
          {currentItem.api_name && (
            <span className="hero-meta-chip hero-provider-chip">
              {currentItem.api_name}
            </span>
          )}
        </div>

        {/* Description / Synopsis Teaser */}
        <p className="stremio-hero-description">
          Experience {currentItem.name} in ultra-crisp resolution. Stream instantly via high-speed CloudStream Direct3D 11 hardware-accelerated playback.
        </p>

        {/* CTA Buttons */}
        <div className="stremio-hero-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="stremio-hero-play-btn"
            onClick={() => onSelectItem(currentItem)}
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

          {onToggleWatchlist && (
            <button
              type="button"
              className={`stremio-hero-watchlist-btn ${inWatchlist ? 'active' : ''}`}
              onClick={() => onToggleWatchlist(currentItem)}
              title={inWatchlist ? 'Remove from Library' : 'Add to Library'}
            >
              {inWatchlist ? <Check size={18} /> : <Plus size={18} />}
              <span>{inWatchlist ? 'In Library' : 'Library'}</span>
            </button>
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
