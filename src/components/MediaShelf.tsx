import React, { useRef } from 'react';
import { SearchResponse } from '../types';
import { MediaCard } from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaShelfProps {
  title: string;
  items: SearchResponse[];
  onSelectItem: (item: SearchResponse) => void;
  onSeeAll?: () => void;
  subactions?: React.ReactNode;
  progressMap?: Record<string, number>;
}

export const MediaShelf: React.FC<MediaShelfProps> = ({
  title,
  items,
  onSelectItem,
  onSeeAll,
  subactions,
  progressMap,
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
          <h2 className="media-shelf-title">{title}</h2>
          {subactions}
        </div>

        <div className="media-shelf-nav">
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
      <div className="media-shelf-row" ref={rowRef}>
        {items.map((item) => (
          <div key={item.url} className="media-shelf-item">
            <MediaCard
              item={item}
              progressPercent={progressMap ? progressMap[item.url] : undefined}
              onClick={onSelectItem}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
