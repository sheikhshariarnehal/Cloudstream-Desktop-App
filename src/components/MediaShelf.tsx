import React, { useRef } from 'react';
import { SearchResponse } from '../types';
import { MediaCard } from './MediaCard';
import { ChevronLeft, ChevronRight, ArrowRight, Loader2 } from 'lucide-react';

interface MediaShelfProps {
  title: string;
  items: SearchResponse[];
  onSelectItem: (item: SearchResponse) => void;
  onPlayItem?: (item: SearchResponse) => void;
  onRemoveItem?: (item: SearchResponse) => void;
  onSeeAll?: () => void;
  subactions?: React.ReactNode;
  progressMap?: Record<string, number>;
  hasNext?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  isHorizontal?: boolean;
  iconUrl?: string;
}

export const MediaShelf: React.FC<MediaShelfProps> = ({
  title,
  items,
  onSelectItem,
  onPlayItem,
  onRemoveItem,
  onSeeAll,
  subactions,
  progressMap,
  hasNext,
  isLoadingMore,
  onLoadMore,
  isHorizontal = false,
  iconUrl,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const scrollAmount = rowRef.current.clientWidth * 0.8;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="media-shelf-container">
      {/* Shelf Header with Title & Navigation Arrows */}
      <div className="media-shelf-header">
        <div
          className={`media-shelf-title-left ${onSeeAll ? 'clickable' : ''}`}
          onClick={onSeeAll}
          role={onSeeAll ? 'button' : undefined}
          tabIndex={onSeeAll ? 0 : undefined}
          title={onSeeAll ? `View all from ${title}` : undefined}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              className="media-shelf-icon"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <h2 className="media-shelf-title">{title}</h2>
          {subactions}
        </div>

        <div className="media-shelf-nav">
          {onSeeAll && (
            <button
              type="button"
              className="media-shelf-see-all-btn"
              onClick={onSeeAll}
              title={`View all from ${title}`}
            >
              <span>See All</span>
              <ArrowRight size={13} />
            </button>
          )}

          {/* Circular Left Navigation Arrow (Desktop horizontal scroll) */}
          <button
            type="button"
            className="media-shelf-arrow-btn"
            onClick={() => scroll('left')}
            title="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          {/* Circular Right Navigation Arrow (Desktop horizontal scroll) */}
          <button
            type="button"
            className="media-shelf-arrow-btn"
            onClick={() => scroll('right')}
            title="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 8-Card Horizontal Scrollable Row */}
      <div className={`media-shelf-row ${isHorizontal ? 'horizontal-shelf' : ''}`} ref={rowRef}>
        {items.map((item) => (
          <div key={item.url} className={`media-shelf-item ${isHorizontal ? 'horizontal' : ''}`}>
            <MediaCard
              item={item}
              isHorizontal={isHorizontal}
              isContinueWatching={title.toLowerCase().includes('continue watching') || Boolean(onRemoveItem)}
              progressPercent={progressMap ? progressMap[item.url] : undefined}
              onClick={onSelectItem}
              onPlay={onPlayItem ? (media) => onPlayItem(media) : undefined}
              onRemove={onRemoveItem ? (media) => onRemoveItem(media) : undefined}
            />
          </div>
        ))}

        {/* CloudStream expand(categoryName) pagination end card */}
        {hasNext && (
          <div className={`media-shelf-item ${isHorizontal ? 'horizontal' : ''}`}>
            <div
              className="media-shelf-more-card"
              onClick={onLoadMore || onSeeAll}
              title="Load more items from this shelf"
            >
              {isLoadingMore ? (
                <Loader2 size={24} className="animate-spin" color="var(--stremio-purple-light)" />
              ) : (
                <>
                  <div className="more-card-icon">
                    <ArrowRight size={20} />
                  </div>
                  <span className="more-card-title">Load More</span>
                  <span className="more-card-sub">Next Page</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
