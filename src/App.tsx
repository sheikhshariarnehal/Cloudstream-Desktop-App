import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Episode,
  ExtractorLink,
  ExtensionInfo,
  HomePageList,
  SearchResponse,
  WatchHistoryItem,
  WatchlistItem,
  WatchStatusFilter,
} from './types';
import { Sidebar } from './components/Sidebar';
import { MediaCard } from './components/MediaCard';
import { DetailModal } from './components/DetailModal';
import { PlayerOverlay } from './components/PlayerOverlay';
import { PluginsScreen } from './screens/PluginsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SearchSuggestionsDropdown } from './components/search/SearchSuggestionsDropdown';
import { SearchFilterDropdown } from './components/search/SearchFilterDropdown';
import { useSearchEngine } from './hooks/useSearchEngine';
import { ExpandedShelfModal } from './components/ExpandedShelfModal';
import { MediaShelf } from './components/MediaShelf';
import { HeroBanner } from './components/HeroBanner';
import {
  Search,
  ChevronDown,
  Maximize2,
  Puzzle,
  Globe,
  Check,
  Plus,
  Download,
  Film,
  Calendar,
  Folder,
  RefreshCw,
  Trash2,
  Pin,
  Loader2,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import './App.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [sourceFilterDropdownOpen, setSourceFilterDropdownOpen] = useState(false);
  const [catalog, setCatalog] = useState<HomePageList[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Extensions / Providers state
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<string>(() => {
    try {
      return localStorage.getItem('cloudstream_selected_extension') || 'all';
    } catch {
      return 'all';
    }
  });
  const [showExtensionDropdown, setShowExtensionDropdown] = useState(false);
  const [extensionSearchQuery, setExtensionSearchQuery] = useState('');
  const [selectedTvTypes, setSelectedTvTypes] = useState<string[]>([]);
  const [pinnedExtensions, setPinnedExtensions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cloudstream_pinned_providers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const togglePinExtension = (extName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedExtensions((prev) => {
      const updated = prev.includes(extName) ? prev.filter((p) => p !== extName) : [...prev, extName];
      try {
        localStorage.setItem('cloudstream_pinned_providers', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Home Filters & Shelf Expansion
  const [boardCategory, setBoardCategory] = useState<'All' | 'Movies' | 'Series' | 'Anime'>('All');
  const [bookmarkFilter, setBookmarkFilter] = useState<WatchStatusFilter>('all');
  const [expandedShelf, setExpandedShelf] = useState<{
    title: string;
    items: SearchResponse[];
    actionType?: 'continue_watching' | 'watchlist' | 'provider';
  } | null>(null);

  // Search state powered by CloudStream Search Engine
  const searchEngine = useSearchEngine();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxWrapperRef = useRef<HTMLDivElement>(null);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState<'All' | 'Movie' | 'TvSeries' | 'Anime'>('All');

  // Close search and sources dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxWrapperRef.current && !searchBoxWrapperRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
        searchEngine.setShowSuggestions(false);
        setSourceFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchEngine]);

  // Library state
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [libraryTab, setLibraryTab] = useState<'watchlist' | 'history'>('watchlist');

  // Modal & Player
  const [selectedItem, setSelectedItem] = useState<SearchResponse | null>(null);
  const [playerState, setPlayerState] = useState<{
    item: SearchResponse;
    episode: Episode;
    links: ExtractorLink[];
  } | null>(null);

  // Load available extensions
  const loadExtensions = async () => {
    try {
      const exts: ExtensionInfo[] = await invoke('get_available_extensions');
      setExtensions(exts);
    } catch (e) {
      console.error('Failed to load extensions:', e);
    }
  };

  // Load Library data (Watchlist & History)
  const loadLibraryData = async () => {
    try {
      const [wl, hist] = await Promise.all([
        invoke<WatchlistItem[]>('get_watchlist'),
        invoke<WatchHistoryItem[]>('get_watch_history', { limit: 40 }),
      ]);
      setWatchlist(wl);
      setHistory(hist);
    } catch (e) {
      console.error('Failed to load library data:', e);
    }
  };

  // Toggle watchlist for an item (Stremio parity)
  const handleToggleWatchlist = async (media: SearchResponse) => {
    try {
      const isWatchlisted = watchlist.some((w) => w.media_id === media.url);
      if (isWatchlisted) {
        await invoke('remove_watchlist_item', { mediaId: media.url });
      } else {
        await invoke('set_watchlist_item', {
          item: {
            media_id: media.url,
            provider_id: media.api_name,
            title: media.name,
            poster_url: media.poster_url,
            tv_type: media.tv_type,
            status: 'watching',
            score: media.score,
            added_at: Date.now(),
          },
        });
      }
      await loadLibraryData();
    } catch (e) {
      console.error('Watchlist toggle error:', e);
    }
  };

  const isInWatchlist = (media: SearchResponse) => {
    return watchlist.some((w) => w.media_id === media.url);
  };

  // Clear Watch History (CloudStream deleteResumeWatching parity)
  const handleClearHistory = async () => {
    try {
      await invoke('clear_watch_history');
      await loadLibraryData();
      await loadHome();
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  };

  // Refresh active provider (CloudStream home_preview_reload_provider parity)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadHome(), loadLibraryData()]);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  // Load Home Catalog
  const loadHome = async (extName?: string) => {
    setLoadingCatalog(true);
    const target = extName !== undefined ? extName : selectedExtension;
    try {
      const data: HomePageList[] = await invoke('get_home_catalog', {
        provider: target === 'all' || target === 'All Extensions' ? null : target,
      });
      setCatalog(data);
    } catch (e) {
      console.error('Failed to load home catalog:', e);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExtensionDropdown(false);
      }
      if (searchBoxWrapperRef.current && !searchBoxWrapperRef.current.contains(event.target as Node)) {
        searchEngine.setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchEngine]);

  useEffect(() => {
    loadExtensions();
    const initialExt = localStorage.getItem('cloudstream_selected_extension') || 'all';
    loadHome(initialExt);
    loadLibraryData();
  }, []);

  const handleSelectExtension = (extName: string) => {
    setSelectedExtension(extName);
    try {
      localStorage.setItem('cloudstream_selected_extension', extName);
    } catch (e) {
      console.error(e);
    }
    setShowExtensionDropdown(false);
    loadHome(extName);
  };

  // Global Hotkeys for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') ||
        (e.ctrlKey && e.key.toLowerCase() === 'f')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setActiveTab('search');
      } else if (e.key === 'Escape') {
        searchEngine.setShowSuggestions(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchEngine]);

  // Handle direct link paste in search bar or Enter to search with keyboard arrow navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchEngine.showSuggestions && searchEngine.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < searchEngine.suggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : searchEngine.suggestions.length - 1
        );
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        searchEngine.setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (
        searchEngine.showSuggestions &&
        selectedSuggestionIndex >= 0 &&
        selectedSuggestionIndex < searchEngine.suggestions.length
      ) {
        e.preventDefault();
        const selected = searchEngine.suggestions[selectedSuggestionIndex];
        searchEngine.setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        searchEngine.setSearchQuery(selected);
        searchEngine.executeSearch(selected);
        setActiveTab('search');
        return;
      }

      searchEngine.setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);

      const val = searchEngine.searchQuery.trim();
      if (val.startsWith('http://') || val.startsWith('https://')) {
        // Direct stream playback
        const isM3u8 = val.includes('.m3u8');
        setPlayerState({
          item: {
            name: 'Direct Stream',
            url: val,
            api_name: 'Custom URL',
            tv_type: 'Movie',
            score: 9.0,
          },
          episode: {
            name: 'Direct Playback',
            season: null,
            episode: 1,
            data: val,
            poster_url: null,
            rating: null,
            description: null,
            release_date: null,
          } as any,
          links: [
            {
              source: 'Direct',
              name: 'Direct Web Stream',
              url: val,
              referer: '',
              quality: 'Quality1080p' as any,
              is_m3u8: isM3u8,
              is_dash: false,
              headers: {},
            },
          ],
        });
        return;
      }

      if (val.length > 0) {
        searchEngine.executeSearch(val);
        setActiveTab('search');
      }
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  // Load Library data
  useEffect(() => {
    if (activeTab === 'library') {
      invoke<WatchlistItem[]>('get_watchlist')
        .then(setWatchlist)
        .catch(console.error);
      invoke<WatchHistoryItem[]>('get_watch_history', { limit: 40 })
        .then(setHistory)
        .catch(console.error);
    }
  }, [activeTab]);

  // Continue Watching items computed from history
  const continueWatchingItems: SearchResponse[] = history
    .filter((h) => !h.is_completed && h.position_ms > 10000)
    .map((h) => ({
      name: h.title,
      url: h.media_id,
      api_name: h.provider_id,
      tv_type: 'Movie',
      poster_url: h.poster_url,
      season: h.season_num || 1,
      episode: h.episode_num,
      latest_episode: h.episode_num,
    }));

  const historyProgressMap: Record<string, number> = {};
  history.forEach((h) => {
    if (h.duration_ms > 0) {
      historyProgressMap[h.media_id] = (h.position_ms / h.duration_ms) * 100;
    }
  });

  // Filtered Bookmarks on Home
  const filteredBookmarks = watchlist.filter((w) => {
    if (bookmarkFilter === 'all') return true;
    return w.status === bookmarkFilter;
  });

  const bookmarkSearchItems: SearchResponse[] = filteredBookmarks.map((w) => ({
    name: w.title,
    url: w.media_id,
    api_name: w.provider_id,
    tv_type: (w.tv_type as any) || 'Movie',
    poster_url: w.poster_url,
    score: w.score,
  }));

  // Watch status counts for chips
  const statusCounts = {
    watching: watchlist.filter((w) => w.status === 'watching').length,
    plan_to_watch: watchlist.filter((w) => w.status === 'plan_to_watch').length,
    completed: watchlist.filter((w) => w.status === 'completed').length,
    on_hold: watchlist.filter((w) => w.status === 'on_hold').length,
    dropped: watchlist.filter((w) => w.status === 'dropped').length,
  };

  // Provider Shelves
  const filteredShelves = catalog.filter((s) => s.name !== 'Continue Watching');

  // Stremio Hero Spotlight items
  const heroBannerItems = React.useMemo(() => {
    const items: SearchResponse[] = [];
    for (const shelf of catalog) {
      for (const item of shelf.list) {
        if (item.poster_url && !items.some((existing) => existing.url === item.url)) {
          items.push(item);
        }
        if (items.length >= 8) break;
      }
      if (items.length >= 8) break;
    }
    return items;
  }, [catalog]);

  // Filter shelves based on board category
  const visibleShelves = filteredShelves.filter((shelf) => {
    if (boardCategory === 'All') return true;
    const lower = shelf.name.toLowerCase();
    if (boardCategory === 'Movies') {
      return lower.includes('movie') || shelf.list.some((it) => it.tv_type === 'Movie');
    }
    if (boardCategory === 'Series') {
      return lower.includes('series') || lower.includes('show') || shelf.list.some((it) => it.tv_type === 'TvSeries');
    }
    if (boardCategory === 'Anime') {
      return lower.includes('anime') || shelf.list.some((it) => it.tv_type === 'Anime');
    }
    return true;
  });

  const currentExtObj = extensions.find(
    (e) => e.name === selectedExtension || (selectedExtension === 'all' && e.id === 'all')
  );

  // Available TvTypes across all installed extensions
  const availableTvTypes = Array.from(
    new Set(extensions.flatMap((e) => e.supported_types || []))
  ).filter(Boolean);

  const toggleTvTypeFilter = (type: string) => {
    setSelectedTvTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // Sort & filter extensions:
  // 1. Filter by search query
  // 2. Filter by selected TV Types (if any selected)
  // 3. Pinned extensions appear at the top, followed by alphabetically sorted
  const sortedDropdownExts = extensions
    .filter((e) => {
      if (e.id === 'all') return true;
      const matchesQuery =
        e.name.toLowerCase().includes(extensionSearchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(extensionSearchQuery.toLowerCase());
      if (!matchesQuery) return false;
      if (selectedTvTypes.length > 0) {
        return e.supported_types?.some((t) => selectedTvTypes.includes(t));
      }
      return true;
    })
    .sort((a, b) => {
      if (a.id === 'all') return -1;
      if (b.id === 'all') return 1;
      const aPinned = pinnedExtensions.includes(a.name);
      const bPinned = pinnedExtensions.includes(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return a.name.localeCompare(b.name);
    });

  if (playerState) {
    return (
      <PlayerOverlay
        item={playerState.item}
        episode={playerState.episode}
        links={playerState.links}
        onClose={() => {
          invoke('player_stop').catch(() => {});
          setPlayerState(null);
          loadLibraryData();
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Left Navigation Rail (Stremio Exact) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Top Header Bar (Stremio Exact) */}
        <header className="stremio-header">
          <div className="stremio-header-left">
            {/* Empty or subtle navigation space matching Stremio header spacing */}
          </div>

          {/* Centered Stremio Search Bar with TMDB Live Suggestions */}
          <div
            className="stremio-search-box-wrapper"
            ref={searchBoxWrapperRef}
            style={{ position: 'relative' }}
          >
            <div className="stremio-search-box">
              <Search
                size={17}
                color="#8e8aa4"
                strokeWidth={2.1}
                style={{ marginRight: '10px', cursor: 'pointer', flexShrink: 0, opacity: 0.85 }}
                onClick={() => {
                  if (searchEngine.searchQuery.trim()) {
                    searchEngine.setShowSuggestions(false);
                    setSelectedSuggestionIndex(-1);
                    searchEngine.executeSearch();
                    setActiveTab('search');
                  } else {
                    searchInputRef.current?.focus();
                  }
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                className="stremio-search-input"
                value={searchEngine.searchQuery}
                onChange={(e) => {
                  searchEngine.setSearchQuery(e.target.value);
                  setSelectedSuggestionIndex(-1);
                  setIsSearchFocused(true);
                  if (activeTab !== 'search') {
                    setActiveTab('search');
                  }
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  if (searchEngine.suggestions.length > 0 && searchEngine.searchQuery.trim().length >= 2) {
                    searchEngine.setShowSuggestions(true);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search or paste link"
              />

              <div className="stremio-search-right-actions">
                {searchEngine.searching && (
                  <Loader2
                    size={17}
                    className="animate-spin stremio-search-spinner"
                  />
                )}

                {searchEngine.searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    className="stremio-search-clear-btn"
                    title="Clear search"
                    onClick={() => {
                      searchEngine.setSearchQuery('');
                      searchEngine.setShowSuggestions(false);
                      setSelectedSuggestionIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X
                      size={16}
                      color="#8e8aa4"
                      strokeWidth={2}
                    />
                  </button>
                )}

                <button
                  type="button"
                  className={`stremio-search-sources-btn ${searchEngine.selectedProviders.length > 0 ? 'active' : ''}`}
                  title="Filter Sources"
                  onClick={() => {
                    searchEngine.setShowSuggestions(false);
                    setSourceFilterDropdownOpen((prev) => !prev);
                  }}
                >
                  <SlidersHorizontal size={17} strokeWidth={2.1} />
                  {searchEngine.selectedProviders.length > 0 && (
                    <span className="stremio-search-sources-dot" />
                  )}
                </button>
              </div>
            </div>

            {/* Live TMDB Suggestions Dropdown (when typing >= 2 chars) */}
            {!sourceFilterDropdownOpen && isSearchFocused && searchEngine.searchQuery.trim().length >= 2 && searchEngine.suggestions.length > 0 && (
              <SearchSuggestionsDropdown
                title="Search Suggestions"
                items={searchEngine.suggestions}
                selectedIndex={selectedSuggestionIndex}
                onHoverIndex={setSelectedSuggestionIndex}
                onSelect={(suggestion) => {
                  setIsSearchFocused(false);
                  searchEngine.setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                  searchEngine.setSearchQuery(suggestion);
                  searchEngine.executeSearch(suggestion);
                  setActiveTab('search');
                }}
              />
            )}

            {/* Search History Dropdown (when query is empty or short) */}
            {!sourceFilterDropdownOpen && isSearchFocused && searchEngine.searchQuery.trim().length < 2 && searchEngine.history.length > 0 && (
              <SearchSuggestionsDropdown
                title="Search History"
                items={searchEngine.history.map((h) => h.search_text)}
                selectedIndex={selectedSuggestionIndex}
                onHoverIndex={setSelectedSuggestionIndex}
                onClearHistory={() => {
                  searchEngine.clearAllHistory();
                }}
                onSelect={(item) => {
                  setIsSearchFocused(false);
                  searchEngine.setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                  searchEngine.setSearchQuery(item);
                  searchEngine.executeSearch(item);
                  setActiveTab('search');
                }}
              />
            )}

            {/* Sources Filter Dropdown */}
            {sourceFilterDropdownOpen && (
              <SearchFilterDropdown
                extensions={extensions}
                selectedProviders={searchEngine.selectedProviders}
                onClose={() => setSourceFilterDropdownOpen(false)}
                onApply={(providers: string[]) => {
                  searchEngine.setSelectedProviders(providers);
                  if (searchEngine.lastSearchedQuery.length > 0) {
                    searchEngine.executeSearch();
                  }
                }}
              />
            )}
          </div>

          {/* Header Right Actions */}
          <div className="stremio-header-right">
            {/* CloudStream Extension Selector Pill */}
            <div className="extension-selector-container" ref={dropdownRef}>
              <div
                className="stremio-ext-badge"
                onClick={() => setShowExtensionDropdown(!showExtensionDropdown)}
                title="Select or switch active CloudStream extension"
              >
                <Puzzle size={14} color="var(--stremio-purple-light)" />
                <span className="stremio-ext-badge-text">
                  {currentExtObj?.name || (selectedExtension === 'all' ? 'All Extensions' : selectedExtension)}
                </span>
                <ChevronDown size={13} color="#8e8aa4" />
              </div>

              {/* Extension Dropdown Menu (CloudStream home_select_mainpage Parity) */}
              {showExtensionDropdown && (
                <div className="extension-dropdown">
                  <div className="ext-dropdown-header">
                    <div className="ext-dropdown-title">
                      <span>Source Extensions</span>
                      <span style={{ fontSize: '11.5px', color: '#8e8aa4', fontWeight: 500 }}>
                        {sortedDropdownExts.filter((e) => e.id !== 'all').length} available
                      </span>
                    </div>

                    <input
                      type="text"
                      className="ext-search-input"
                      placeholder="Search extensions..."
                      value={extensionSearchQuery}
                      onChange={(e) => setExtensionSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* TvType Filter Chips (CloudStream tvtypes_chips_scroll parity) */}
                    {availableTvTypes.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                        {availableTvTypes.map((type) => {
                          const active = selectedTvTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTvTypeFilter(type);
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 600,
                                border: 'none',
                                background: active ? 'rgba(124, 58, 237, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                                color: active ? '#fff' : '#8e8aa4',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="ext-dropdown-list">
                    {sortedDropdownExts.map((ext) => {
                      const isAll = ext.id === 'all';
                      const isSelected = selectedExtension === ext.name || (isAll && selectedExtension === 'all');
                      const isPinned = pinnedExtensions.includes(ext.name);

                      return (
                        <div
                          key={ext.id}
                          className={`ext-option-item ${isSelected ? 'active' : ''}`}
                          onClick={() => handleSelectExtension(isAll ? 'all' : ext.name)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <div className="ext-option-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            {isAll ? (
                              <Globe size={15} color="var(--stremio-purple-light)" />
                            ) : (
                              <Puzzle size={15} color="var(--stremio-purple-light)" />
                            )}
                            <span className="ext-option-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ext.name}
                            </span>
                            {ext.version && (
                              <span style={{ fontSize: '10px', color: '#726e8c' }}>
                                v{ext.version}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {!isAll && (
                              <button
                                type="button"
                                title={isPinned ? 'Unpin extension' : 'Pin extension to top'}
                                onClick={(e) => togglePinExtension(ext.name, e)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: isPinned ? 'var(--stremio-purple-light)' : '#555175',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'color 0.15s ease',
                                }}
                              >
                                <Pin size={13} fill={isPinned ? 'var(--stremio-purple-light)' : 'none'} />
                              </button>
                            )}
                            {isSelected && <Check size={14} color="var(--stremio-purple-light)" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="ext-dropdown-footer">
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        width: '100%',
                        fontSize: '12.5px',
                        padding: '9px 16px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.06)',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                      onClick={() => {
                        setShowExtensionDropdown(false);
                        setActiveTab('plugins');
                      }}
                    >
                      <Plus size={14} />
                      <span>Extension Manager</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Catalog Button */}
            <button
              className="stremio-icon-btn"
              onClick={handleRefresh}
              title="Refresh provider catalog"
              disabled={loadingCatalog || isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing || loadingCatalog ? 'animate-spin' : ''} />
            </button>

            {/* Fullscreen Button */}
            <button className="stremio-icon-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
              <Maximize2 size={16} />
            </button>

            {/* User Avatar Circle with Dropdown Arrow (Stremio Exact) */}
            <div className="stremio-avatar-group" title="Profile">
              <div className="stremio-avatar">
                N
              </div>
              <ChevronDown size={13} color="#8e8aa4" />
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="main-content">
          {/* HOME SCREEN (Exact Stremio Board with CloudStream Parity) */}
          {activeTab === 'home' && (
            <div>


              {/* Onboarding State if 0 Extensions Installed */}
              {extensions.length === 0 ? (
                <div
                  style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    margin: '60px auto',
                    maxWidth: '640px',
                    background: 'var(--stremio-surface)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '20px',
                      background: 'rgba(124, 58, 237, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Puzzle size={36} color="var(--stremio-purple-light)" />
                  </div>
                  <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    No Extensions Installed
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: '14.5px', lineHeight: '1.6', margin: 0 }}>
                    CloudStream is a modular media player. Install extensions from Nehal's Server repository (such as{' '}
                    <strong>DiscoveryFTP</strong>, <strong>DhakaFlix (BDIX)</strong>, <strong>CineplexBD</strong>, or{' '}
                    <strong>CircleFTP</strong>) to populate your catalog.
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => setActiveTab('plugins')}
                    style={{ padding: '12px 24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={16} />
                    Open Extension Manager
                  </button>
                </div>
              ) : loadingCatalog ? (
                <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <RefreshCw size={18} className="animate-spin" />
                    Loading catalog from {selectedExtension === 'all' ? 'active extensions' : selectedExtension}...
                  </div>
                </div>
              ) : catalog.length === 0 && continueWatchingItems.length === 0 && watchlist.length === 0 ? (
                <div
                  style={{
                    padding: '60px 40px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    margin: '40px 36px',
                    borderRadius: '16px',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Globe size={40} color="#64748b" />
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    No Media Returned for {selectedExtension}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '13.5px', maxWidth: '440px', margin: 0 }}>
                    Could not load shelves from this extension. Ensure your network has BDIX connectivity, or select another extension.
                  </p>
                  <button className="btn-secondary" onClick={() => setActiveTab('plugins')}>
                    Manage Extensions
                  </button>
                </div>
              ) : (
                /* Stremio Media Shelves Board with CloudStream Shelves */
                <div>
                  {/* Stremio Hero Spotlight Carousel */}
                  {heroBannerItems.length > 0 && (
                    <HeroBanner
                      items={heroBannerItems}
                      onSelectItem={setSelectedItem}
                      onToggleWatchlist={handleToggleWatchlist}
                      isInWatchlist={isInWatchlist}
                    />
                  )}

                  {/* Stremio Board Quick Category Filter Pills */}
                  <div className="stremio-category-bar">
                    {(['All', 'Movies', 'Series', 'Anime'] as const).map((cat) => (
                      <button
                        key={cat}
                        className={`stremio-category-pill ${boardCategory === cat ? 'active' : ''}`}
                        onClick={() => setBoardCategory(cat)}
                      >
                        {cat === 'All' && <Film size={13} />}
                        {cat === 'Movies' && <Film size={13} />}
                        {cat === 'Series' && <Calendar size={13} />}
                        {cat === 'Anime' && <Folder size={13} />}
                        <span>{cat === 'All' ? 'All Titles' : cat}</span>
                      </button>
                    ))}
                  </div>

                  <div className="stremio-board-container">
                    {/* 1. Continue Watching Shelf (Top Shelf - CloudStream getResumeWatching Parity) */}
                    {(boardCategory === 'All' || boardCategory === 'Series') && continueWatchingItems.length > 0 && (
                      <MediaShelf
                        title="Continue Watching"
                        items={continueWatchingItems}
                        progressMap={historyProgressMap}
                        onSelectItem={setSelectedItem}
                        onSeeAll={() =>
                          setExpandedShelf({
                            title: 'Continue Watching',
                            items: continueWatchingItems,
                            actionType: 'continue_watching',
                          })
                        }
                        subactions={
                          <button
                            className="stremio-clear-btn"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to clear all Continue Watching history?')) {
                                handleClearHistory();
                              }
                            }}
                            title="Clear Continue Watching history"
                          >
                            <Trash2 size={13} />
                            <span>Clear</span>
                          </button>
                        }
                      />
                    )}

                    {/* 2. My Library / Bookmarks Shelf (CloudStream loadStoredData Parity) */}
                    {boardCategory === 'All' && watchlist.length > 0 && (
                      <MediaShelf
                        title="My Library"
                        items={bookmarkSearchItems}
                        onSelectItem={setSelectedItem}
                        onSeeAll={() =>
                          setExpandedShelf({
                            title: `My Library (${bookmarkFilter === 'all' ? 'All' : bookmarkFilter.replace('_', ' ')})`,
                            items: bookmarkSearchItems,
                            actionType: 'watchlist',
                          })
                        }
                        subactions={
                          <div className="stremio-chips-row">
                            <button
                              className={`stremio-chip-pill ${bookmarkFilter === 'all' ? 'active' : ''}`}
                              onClick={() => setBookmarkFilter('all')}
                            >
                              All ({watchlist.length})
                            </button>
                            {statusCounts.watching > 0 && (
                              <button
                                className={`stremio-chip-pill ${bookmarkFilter === 'watching' ? 'active' : ''}`}
                                onClick={() => setBookmarkFilter('watching')}
                              >
                                Watching ({statusCounts.watching})
                              </button>
                            )}
                            {statusCounts.plan_to_watch > 0 && (
                              <button
                                className={`stremio-chip-pill ${bookmarkFilter === 'plan_to_watch' ? 'active' : ''}`}
                                onClick={() => setBookmarkFilter('plan_to_watch')}
                              >
                                Plan to Watch ({statusCounts.plan_to_watch})
                              </button>
                            )}
                            {statusCounts.completed > 0 && (
                              <button
                                className={`stremio-chip-pill ${bookmarkFilter === 'completed' ? 'active' : ''}`}
                                onClick={() => setBookmarkFilter('completed')}
                              >
                                Completed ({statusCounts.completed})
                              </button>
                            )}
                            {statusCounts.on_hold > 0 && (
                              <button
                                className={`stremio-chip-pill ${bookmarkFilter === 'on_hold' ? 'active' : ''}`}
                                onClick={() => setBookmarkFilter('on_hold')}
                              >
                                On Hold ({statusCounts.on_hold})
                              </button>
                            )}
                            {statusCounts.dropped > 0 && (
                              <button
                                className={`stremio-chip-pill ${bookmarkFilter === 'dropped' ? 'active' : ''}`}
                                onClick={() => setBookmarkFilter('dropped')}
                              >
                                Dropped ({statusCounts.dropped})
                              </button>
                            )}
                          </div>
                        }
                      />
                    )}

                    {/* 3. Provider Shelves (8-Card Carousels with < and > Nav) */}
                    {visibleShelves.map((shelf) => {
                      const lower = shelf.name.toLowerCase();
                      let displayTitle = shelf.name;
                      if (lower.includes('movie')) {
                        displayTitle = 'Popular - Movie';
                      } else if (lower.includes('series') || lower.includes('tv') || lower.includes('show')) {
                        displayTitle = 'Popular - Series';
                      } else if (lower.includes('anime')) {
                        displayTitle = 'Popular - Anime';
                      } else if (!lower.startsWith('popular')) {
                        displayTitle = `Popular - ${shelf.name}`;
                      }

                      return (
                        <MediaShelf
                          key={shelf.name}
                          title={displayTitle}
                          items={shelf.list}
                          onSelectItem={setSelectedItem}
                          onSeeAll={() =>
                            setExpandedShelf({
                              title: displayTitle,
                              items: shelf.list,
                              actionType: 'provider',
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DISCOVER SCREEN */}
          {activeTab === 'discover' && (
            <div style={{ padding: '24px 36px 60px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>Discover Media</h1>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['All', 'Movie', 'TvSeries', 'Anime'].map((t) => (
                    <button
                      key={t}
                      className={`stremio-filter-pill ${discoverFilter === t ? 'active' : ''}`}
                      onClick={() => setDiscoverFilter(t as any)}
                    >
                      {t === 'All' ? 'All Types' : t === 'TvSeries' ? 'Series' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stremio-shelf-grid">
                {catalog
                  .flatMap((s) => s.list)
                  .filter((m, idx, self) => self.findIndex((o) => o.url === m.url) === idx)
                  .filter((m) => {
                    if (discoverFilter === 'All') return true;
                    if (discoverFilter === 'Movie') return m.tv_type === 'Movie';
                    if (discoverFilter === 'TvSeries') return m.tv_type === 'TvSeries';
                    if (discoverFilter === 'Anime') return m.tv_type === 'Anime';
                    return true;
                  })
                  .map((media) => (
                    <MediaCard key={media.url} item={media} onClick={setSelectedItem} />
                  ))}
              </div>
            </div>
          )}

          {/* SEARCH SCREEN (CloudStream Dual-Mode Search Engine) */}
          {activeTab === 'search' && (
            <SearchScreen
              searchEngine={searchEngine}
              extensions={extensions}
              onSelectItem={setSelectedItem}
            />
          )}

          {/* LIBRARY SCREEN */}
          {activeTab === 'library' && (
            <div style={{ padding: '24px 36px 60px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <button
                  className={`stremio-filter-pill ${libraryTab === 'watchlist' ? 'active' : ''}`}
                  onClick={() => setLibraryTab('watchlist')}
                >
                  <Folder size={14} />
                  Watchlist ({watchlist.length})
                </button>
                <button
                  className={`stremio-filter-pill ${libraryTab === 'history' ? 'active' : ''}`}
                  onClick={() => setLibraryTab('history')}
                >
                  <Film size={14} />
                  Continue Watching ({history.length})
                </button>
              </div>

              {libraryTab === 'watchlist' ? (
                watchlist.length === 0 ? (
                  <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                    <Folder size={40} color="#64748b" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>Your Watchlist is empty</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      Click on any title and bookmark it to watch later.
                    </div>
                  </div>
                ) : (
                  <div className="stremio-shelf-grid">
                    {watchlist.map((w) => (
                      <MediaCard
                        key={w.media_id}
                        item={{
                          name: w.title,
                          url: w.media_id,
                          api_name: w.provider_id,
                          tv_type: (w.tv_type as any) || 'Movie',
                          poster_url: w.poster_url,
                        }}
                        onClick={setSelectedItem}
                      />
                    ))}
                  </div>
                )
              ) : history.length === 0 ? (
                <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                  <Film size={40} color="#64748b" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>No Watch History</div>
                </div>
              ) : (
                <div className="stremio-shelf-grid">
                  {history.map((h) => (
                    <MediaCard
                      key={h.media_id}
                      item={{
                        name: h.title,
                        url: h.media_id,
                        api_name: h.provider_id,
                        tv_type: 'Movie',
                        poster_url: h.poster_url,
                        latest_episode: h.episode_num,
                      }}
                      progressPercent={h.duration_ms > 0 ? (h.position_ms / h.duration_ms) * 100 : 0}
                      onClick={setSelectedItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CALENDAR SCREEN */}
          {activeTab === 'calendar' && (
            <div style={{ padding: '36px 40px 60px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={24} color="var(--stremio-purple-light)" />
                Release Calendar & Upcoming Episodes
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '28px' }}>
                Track newly released domestic BDIX episodes, series updates, and theater releases.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {catalog
                  .filter((s) => s.name.toLowerCase().includes('series') || s.name.toLowerCase().includes('anime'))
                  .map((shelf) => (
                    <div key={shelf.name} className="stremio-shelf">
                      <h2 className="stremio-shelf-title" style={{ marginBottom: '14px' }}>
                        {shelf.name}
                      </h2>
                      <div className="stremio-shelf-grid">
                        {shelf.list.slice(0, 7).map((media) => (
                          <MediaCard key={media.url} item={media} onClick={setSelectedItem} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* PLUGINS / EXTENSION MANAGER SCREEN */}
          {activeTab === 'plugins' && (
            <PluginsScreen
              onExtensionsChanged={() => {
                loadExtensions();
                loadHome();
              }}
              onSelectExtension={(name) => {
                setActiveTab('home');
                handleSelectExtension(name);
              }}
            />
          )}

          {/* SETTINGS SCREEN */}
          {activeTab === 'settings' && (
            <div style={{ padding: '40px 60px', maxWidth: '800px', margin: '0 auto' }}>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>
                Settings
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'var(--stremio-surface)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                    Playback & Domestic Gigabit BDIX Proxy
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                    Embedded local Rust stream proxy rewriting m3u8 playlists, bypassing IP restrictions and domestic bandwidth throttling.
                  </p>
                </div>

                <div style={{ background: 'var(--stremio-surface)', padding: '20px 24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                    Active Repository
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-link)', fontFamily: 'monospace' }}>
                    https://raw.githubusercontent.com/nehalDIU/nehal-CloudStream/master/repo.json
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Media Detail Modal */}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            loadLibraryData();
          }}
          onPlay={(item: SearchResponse, episode: Episode, links: ExtractorLink[]) => {
            setSelectedItem(null);
            setPlayerState({ item, episode, links });
          }}
        />
      )}





      {/* Expanded Shelf Modal ("See All" - CloudStream Parity) */}
      {expandedShelf && (
        <ExpandedShelfModal
          title={expandedShelf.title}
          items={expandedShelf.items}
          actionType={expandedShelf.actionType}
          progressMap={historyProgressMap}
          onClearHistory={handleClearHistory}
          onClose={() => setExpandedShelf(null)}
          onSelectItem={setSelectedItem}
        />
      )}
    </div>
  );
};

export default App;

