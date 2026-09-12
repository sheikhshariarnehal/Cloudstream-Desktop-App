import React, { useEffect, useRef } from 'react';

interface SearchSuggestionsDropdownProps {
  title?: string;
  items?: string[];
  suggestions?: string[];
  selectedIndex: number;
  onSelect: (item: string) => void;
  onHoverIndex: (index: number) => void;
  onClearHistory?: () => void;
}

export const SearchSuggestionsDropdown: React.FC<SearchSuggestionsDropdownProps> = ({
  title = 'Search Suggestions',
  items,
  suggestions,
  selectedIndex,
  onSelect,
  onHoverIndex,
  onClearHistory,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const displayItems = items || suggestions || [];

  // Scroll active item into view when navigating with Arrow keys
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (displayItems.length === 0) return null;

  return (
    <div
      className="search-suggestions-overlay"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="search-suggestions-header">
        <span className="suggestions-title">{title}</span>
        {onClearHistory && (
          <button
            type="button"
            className="suggestions-clear-history-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClearHistory();
            }}
          >
            Clear history
          </button>
        )}
      </div>

      <div className="search-suggestions-list" ref={listRef}>
        {displayItems.map((item, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <div
              key={`${item}-${idx}`}
              className={`suggestion-item ${isSelected ? 'selected' : ''}`}
              onMouseEnter={() => onHoverIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
            >
              <span className="suggestion-text">{item}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};


