import React, { useState } from 'react';
import {
  SlidersHorizontal,
  LayoutGrid,
  Rows,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  ExtensionInfo,
  SearchResponse,
  TvType,
} from '../types';
import { MediaCard } from '../components/MediaCard';
import { MediaShelf } from '../components/MediaShelf';
import { ExpandedShelfModal } from '../components/ExpandedShelfModal';
import { useSearchEngine } from '../hooks/useSearchEngine';

interface SearchScreenProps {
  searchEngine: ReturnType<typeof useSearchEngine>;
  extensions: ExtensionInfo[];
  onSelectItem: (item: SearchResponse) => void;
}

const TV_TYPE_OPTIONS: { type: TvType; label: string }[] = [
  { type: 'Movie', label: 'Movies' },
  { type: 'TvSeries', label: 'TV Series' },
  { type: 'Anime', label: 'Anime' },
  { type: 'AsianDrama', label: 'Asian Dramas' },
  { type: 'Cartoon', label: 'Cartoons' },
  { type: 'Documentary', label: 'Documentaries' },
  { type: 'LiveStream', label: 'Live Streams' },
  { type: 'Torrent', label: 'Torrents' },
];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  searchEngine,
  extensions,
  onSelectItem,
}) => {
  const {
    searchQuery,
    lastSearchedQuery,
    searching,
    searchProgress,
    selectedTvTypes,
    toggleTvType,
    setSelectedTvTypes,
    selectedProviders,
    setSelectedProviders,
    viewMode,
    setViewMode,
    groupedResults,
    bundledResults,
    executeSearch,
  } = searchEngine;

  const [expandedShelf, setExpandedShelf] = useState<{
    title: string;
    items: SearchResponse[];
  } | null>(null);

  const hasSearched = lastSearchedQuery.length > 0;
  const totalFound = bundledResults.length;

  return (
    <div className="search-screen-container">
      {/* Top Controls Bar */}
      <div className="search-top-bar">
        <div className="search-title-block">
          {hasSearched ? (
            <div>
              <h1 className="search-main-title">
                Results for <span className="search-query-highlight">"{lastSearchedQuery}"</span>
              </h1>
              <div className="search-stats-sub">
                {searching ? (
                  <span className="search-stats-streaming">
                    <span className="live-pulse-dot" />
                    <span>Streaming results ({searchProgress.completed}/{searchProgress.total || extensions.length} extensions)...</span>
                  </span>
                ) : (
                  <span className="search-stats-complete">
                    <span>Found <strong style={{ color: '#f1f5f9' }}>{totalFound}</strong> title{totalFound === 1 ? '' : 's'} across <strong style={{ color: '#f1f5f9' }}>{groupedResults.length}</strong> provider{groupedResults.length === 1 ? '' : 's'}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="search-main-title">Search & Explore</h1>
              <div className="search-stats-sub">
                Query domestic BDIX & community CloudStream extensions simultaneously
              </div>
            </div>
          )}
        </div>

        {/* Right Actions: View Mode Switcher & Source Filter */}
        <div className="search-actions-block">
          {hasSearched && (
            <div className="view-mode-toggle">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setViewMode('grouped')}
                title="Grouped by Provider (Shelves)"
              >
                <Rows size={17} />
                <span>Shelves</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Unified Round-Robin Grid"
              >
                <LayoutGrid size={17} />
                <span>Grid</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TvType Chips Bar (Exact Parity with CloudStream Android) */}
      <div className="search-chips-bar">
        <button
          type="button"
          className={`search-chip-pill ${selectedTvTypes.length === 0 ? 'active' : ''}`}
          onClick={() => setSelectedTvTypes([])}
        >
          <span>All</span>
        </button>

        {TV_TYPE_OPTIONS.map(({ type, label }) => {
          const isActive = selectedTvTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={`search-chip-pill ${isActive ? 'active' : ''}`}
              onClick={() => toggleTvType(type)}
            >
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {searching && totalFound === 0 ? (
        /* Only show initial loading screen if 0 results have arrived so far */
        <div className="search-loading-state">
          <RefreshCw size={28} className="animate-spin search-loading-spinner" />
          <div className="search-loading-text">
            Searching across {selectedProviders.length > 0 ? `${selectedProviders.length} selected` : 'all'} extensions...
          </div>
          <div className="search-loading-sub">
            Gathering streams from BDIX FTP servers, scrapers, and video hosts
          </div>
        </div>
      ) : !hasSearched || (!searchQuery && totalFound === 0) ? (
        /* Empty / Idle State */
        <div className="search-idle-empty-state">
          <div className="search-welcome-icon">
            <Search size={32} color="var(--stremio-purple-light)" />
          </div>
          <h3 className="search-idle-title">Search & Explore Media</h3>
          <p className="search-idle-sub">
            Type any movie, series, or anime in the search bar above to query all active providers
          </p>
        </div>
      ) : totalFound === 0 ? (
        /* No Results Found */
        <div className="search-no-results">
          <Search size={44} color="#64748b" style={{ margin: '0 auto 16px' }} />
          <h3 className="no-results-title">No Media Found</h3>
          <p className="no-results-sub">
            No results returned for <strong>"{lastSearchedQuery}"</strong>. Try checking your spelling,
            adjusting active type filters, or verifying your installed extensions.
          </p>
          <div className="no-results-actions">
            {selectedProviders.length > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSelectedProviders([]);
                  executeSearch();
                }}
              >
                <SlidersHorizontal size={14} />
                <span>Reset to All Sources</span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'grouped' ? (
        /* Grouped Mode (Shelves per Provider) - Progressive live render as each provider returns */
        <div className="search-grouped-container">
          {groupedResults.map((group) => {
            const matchingExt = extensions.find((e) => e.name === group.provider);
            return (
              <div key={group.provider} className="search-provider-shelf-wrap">
                <MediaShelf
                  title={group.provider}
                  iconUrl={matchingExt?.icon_url}
                  items={group.items}
                  onSelectItem={onSelectItem}
                  onSeeAll={() =>
                    setExpandedShelf({
                      title: `${group.provider} Results`,
                      items: group.items,
                    })
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid Mode (Unified Round-Robin Interleaved Grid) - Live stream render */
        <div className="search-grid-container">
          <div className="stremio-shelf-grid">
            {bundledResults.map((item, idx) => (
              <MediaCard
                key={`${item.api_name}-${item.url}-${idx}`}
                item={item}
                onClick={onSelectItem}
                showProvider={true}
              />
            ))}
          </div>
        </div>
      )}



      {/* Expanded Shelf Modal for Provider "See All" */}
      {expandedShelf && (
        <ExpandedShelfModal
          title={expandedShelf.title}
          items={expandedShelf.items}
          onClose={() => setExpandedShelf(null)}
          onSelectItem={(item) => {
            setExpandedShelf(null);
            onSelectItem(item);
          }}
        />
      )}
    </div>
  );
};
