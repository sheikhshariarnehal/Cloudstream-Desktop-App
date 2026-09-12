import React from 'react';
import { History, Search, Trash2, X, Clock, Flame } from 'lucide-react';
import { SearchHistoryItem } from '../../types';

interface SearchHistoryViewProps {
  history: SearchHistoryItem[];
  onSelectHistory: (query: string) => void;
  onRemoveItem: (key: string) => void;
  onClearAll: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const POPULAR_SUGGESTIONS = [
  'Avatar',
  'Spider-Man',
  'Interstellar',
  'Breaking Bad',
  'Attack on Titan',
  'Jujutsu Kaisen',
  'Game of Thrones',
  'Demon Slayer',
];

export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({
  history,
  onSelectHistory,
  onRemoveItem,
  onClearAll,
}) => {
  return (
    <div className="search-history-container">
      {history.length > 0 ? (
        <div className="search-history-card">
          <div className="search-history-header">
            <div className="history-title-group">
              <History size={16} color="var(--stremio-purple-light)" />
              <span className="history-title">Recent Searches</span>
              <span className="history-count">({history.length})</span>
            </div>

            <button
              type="button"
              className="history-clear-all-btn"
              onClick={() => {
                if (window.confirm('Clear all search history?')) {
                  onClearAll();
                }
              }}
              title="Clear all search history"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          </div>

          <div className="search-history-list">
            {history.map((item) => (
              <div
                key={item.key}
                className="search-history-row"
                onClick={() => onSelectHistory(item.search_text)}
              >
                <div className="history-row-left">
                  <Clock size={14} className="history-clock-icon" />
                  <span className="history-query-text">{item.search_text}</span>
                  {item.types && item.types.length > 0 && (
                    <div className="history-type-tags">
                      {item.types.map((t) => (
                        <span key={t} className="history-type-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="history-row-right">
                  <span className="history-time">{formatRelativeTime(item.searched_at)}</span>
                  <button
                    type="button"
                    className="history-remove-btn"
                    title="Remove from history"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.key);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="search-empty-welcome">
          <div className="search-welcome-icon">
            <Search size={32} color="var(--stremio-purple-light)" />
          </div>
          <h2 className="search-welcome-title">Search Titles Across All Extensions</h2>
          <p className="search-welcome-sub">
            Type any movie, TV show, or anime name to search across all your installed BDIX & community plugins.
          </p>
        </div>
      )}

      {/* Popular Trending Suggestions */}
      <div className="popular-suggestions-card">
        <div className="popular-header">
          <Flame size={15} color="#f59e0b" />
          <span>Popular Searches</span>
        </div>
        <div className="popular-chips-wrap">
          {POPULAR_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="popular-chip-btn"
              onClick={() => onSelectHistory(s)}
            >
              <Search size={12} />
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
