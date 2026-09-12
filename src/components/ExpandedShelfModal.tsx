import React, { useState } from 'react';
import { SearchResponse } from '../types';
import { MediaCard } from './MediaCard';
import { X, Search, Trash2, SlidersHorizontal } from 'lucide-react';

interface ExpandedShelfModalProps {
  title: string;
  items: SearchResponse[];
  onClose: () => void;
  onSelectItem: (item: SearchResponse) => void;
  actionType?: 'continue_watching' | 'watchlist' | 'provider';
  onClearHistory?: () => void;
  progressMap?: Record<string, number>;
}

export const ExpandedShelfModal: React.FC<ExpandedShelfModalProps> = ({
  title,
  items,
  onClose,
  onSelectItem,
  actionType,
  onClearHistory,
  progressMap,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortOption, setSortOption] = useState<'default' | 'rating' | 'name' | 'year'>('default');

  // Filter items
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  // Sort items
  const sorted = [...filtered].sort((a, b) => {
    if (sortOption === 'rating') {
      return (b.score || 0) - (a.score || 0);
    }
    if (sortOption === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortOption === 'year') {
      return (b.year || 0) - (a.year || 0);
    }
    return 0;
  });

  return (
    <div className="expanded-modal-overlay" onClick={onClose}>
      <div className="expanded-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="expanded-modal-header">
          <div className="expanded-modal-title-wrap">
            <h2 className="expanded-modal-title">{title}</h2>
            <span className="expanded-modal-count">
              {items.length} {items.length === 1 ? 'title' : 'titles'}
            </span>
          </div>

          <div className="expanded-modal-actions">
            {/* Search within shelf */}
            <div className="expanded-search-box">
              <Search size={14} color="#8b88a8" />
              <input
                type="text"
                placeholder="Filter in this shelf..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="expanded-search-input"
              />
              {filterQuery && (
                <button
                  className="expanded-clear-search"
                  onClick={() => setFilterQuery('')}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="expanded-sort-pill">
              <SlidersHorizontal size={13} color="#8b88a8" />
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="expanded-sort-select"
              >
                <option value="default">Default Order</option>
                <option value="rating">Top Rated</option>
                <option value="year">Newest Year</option>
                <option value="name">Alphabetical (A-Z)</option>
              </select>
            </div>

            {/* Clear History Action (CloudStream parity) */}
            {actionType === 'continue_watching' && onClearHistory && items.length > 0 && (
              <button
                className="expanded-action-btn danger"
                onClick={() => {
                  if (window.confirm('Are you sure you want to clear all Continue Watching history?')) {
                    onClearHistory();
                    onClose();
                  }
                }}
                title="Clear all watch history"
              >
                <Trash2 size={14} />
                <span>Clear History</span>
              </button>
            )}

            {/* Close Button */}
            <button className="expanded-close-btn" onClick={onClose} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body Grid */}
        <div className="expanded-modal-body">
          {sorted.length === 0 ? (
            <div className="expanded-empty-state">
              <p>No media matched your filter "{filterQuery}".</p>
            </div>
          ) : (
            <div className="stremio-shelf-grid">
              {sorted.map((item) => (
                <MediaCard
                  key={item.url}
                  item={item}
                  progressPercent={progressMap ? progressMap[item.url] : undefined}
                  onClick={(media) => {
                    onSelectItem(media);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
