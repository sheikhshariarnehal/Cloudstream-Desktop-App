import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  Episode,
  ExtractorLink,
  ExtensionInfo,
  HomePageList,
  ExpandableShelf,
  SearchResponse,
  WatchHistoryItem,
  WatchlistItem,
  WatchStatusFilter,
  LoadResponse,
} from './types';
import { Sidebar } from './components/Sidebar';
import { MediaCard } from './components/MediaCard';
import { DetailModal } from './components/DetailModal';
import { PlayerOverlay } from './components/PlayerOverlay';
import { PluginsScreen } from './screens/PluginsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SearchSuggestionsDropdown } from './components/search/SearchSuggestionsDropdown';
import { SearchFilterDropdown } from './components/search/SearchFilterDropdown';
import { useSearchEngine } from './hooks/useSearchEngine';
import { useHomeViewModel } from './hooks/useHomeViewModel';
import { ExpandedShelfModal } from './components/ExpandedShelfModal';
import { MediaShelf } from './components/MediaShelf';
import { HeroBanner } from './components/HeroBanner';
import {
  Search,
  ChevronDown,
  Maximize2,
  Puzzle,
  Check,
  Plus,
  Download,
  Film,
  Folder,
  RefreshCw,
  Trash2,
  Pin,
  Loader2,
  X,
  SlidersHorizontal,
  Dices,
  Tv,
  Sparkles,
  Heart,
  Smile,
  Compass,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import './App.css';

// CloudStream Android Main Page Categories (tvtypes_chips.xml & TvType enum parity)
export type CloudStreamCategory =
  | 'All'
  | 'Movies'
  | 'TV Series'
  | 'Anime'
  | 'Asian Dramas'
  | 'Cartoons'
  | 'Documentaries'
  | 'Livestreams'
  | 'Torrents'
  | 'NSFW'
  | 'Others';

export interface CategoryDef {
  id: CloudStreamCategory;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  types: string[];
}

export const CLOUDSTREAM_CATEGORIES: CategoryDef[] = [
  { id: 'All', label: 'All Titles', icon: Film, types: [] },
  { id: 'Movies', label: 'Movies', icon: Film, types: ['Movie', 'AnimeMovie'] },
  { id: 'TV Series', label: 'TV Series', icon: Tv, types: ['TvSeries'] },
  { id: 'Anime', label: 'Anime', icon: Sparkles, types: ['Anime', 'AnimeMovie', 'OVA'] },
  { id: 'Asian Dramas', label: 'Asian Dramas', icon: Heart, types: ['AsianDrama'] },
  { id: 'Cartoons', label: 'Cartoons', icon: Smile, types: ['Cartoon'] },
  { id: 'Documentaries', label: 'Documentaries', icon: Compass, types: ['Documentary'] },
  { id: 'Livestreams', label: 'Livestreams', icon: Radio, types: ['LiveStream', 'Live'] },
  { id: 'Torrents', label: 'Torrents', icon: Download, types: ['Torrent'] },
  { id: 'NSFW', label: 'NSFW', icon: ShieldAlert, types: ['NSFW'] },
  { id: 'Others', label: 'Others', icon: Folder, types: ['Other', 'Others'] },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [sourceFilterDropdownOpen, setSourceFilterDropdownOpen] = useState(false);

  // Extensions / Providers state
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('cloudstream_selected_extension');
      return (saved && saved !== 'all' && saved !== 'random' && saved !== 'none') ? saved : '';
    } catch {
      return '';
    }
  });

  // Home ViewModel (CloudStream HomeViewModel parity)
  const {
    shelves,
    loadingShelves,
    isRefreshing,
    setIsRefreshing,
    heroDetails,
    expandingShelf,
    loadHome,
    expandShelf,
  } = useHomeViewModel(selectedExtension);

  // Derived catalog for backward compatibility with picker/search
  const catalog: HomePageList[] = React.useMemo(() => shelves.map((s) => s.list), [shelves]);

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

  // CloudStream Main Page Categories (tvtypes_chips & TvType parity)
  const [boardCategory, setBoardCategory] = useState<CloudStreamCategory>('All');
  const [bookmarkFilter, setBookmarkFilter] = useState<WatchStatusFilter>('all');
  const [expandedShelf, setExpandedShelf] = useState<{
    title: string;
    items: SearchResponse[];
    actionType?: 'continue_watching' | 'watchlist' | 'provider';
    shelfName?: string;
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
    allEpisodes?: Episode[];
    mediaDetails?: LoadResponse;
    startTime?: number;
  } | null>(null);

  // Load available extensions
  const loadExtensions = async () => {
    try {
      const exts: ExtensionInfo[] = await invoke('get_available_extensions');
      const realExts = exts.filter((e) => e.id !== 'all' && e.id !== 'random' && e.id !== 'none');
      setExtensions(realExts);

      // Validate selectedExtension
      const saved = localStorage.getItem('cloudstream_selected_extension') || '';
      const exists = realExts.some(
        (e) => e.name.toLowerCase() === saved.toLowerCase() || e.id.toLowerCase() === saved.toLowerCase()
      );

      if (realExts.length > 0 && (!saved || !exists || saved === 'all' || saved === 'random' || saved === 'none')) {
        const defaultExt = realExts[0].name;
        setSelectedExtension(defaultExt);
        try {
          localStorage.setItem('cloudstream_selected_extension', defaultExt);
        } catch {}
        loadHome(defaultExt);
      } else if (realExts.length === 0) {
        setSelectedExtension('');
      }
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

  // Toggle or set watchlist status for an item (CloudStream Bookmark parity)
  const handleSetWatchlistStatus = async (media: SearchResponse, status?: string) => {
    try {
      const existing = watchlist.find((w) => w.media_id === media.url);
      if (!status || (existing && existing.status === status)) {
        await invoke('remove_watchlist_item', { mediaId: media.url });
      } else {
        await invoke('set_watchlist_item', {
          item: {
            media_id: media.url,
            provider_id: media.api_name,
            title: media.name,
            poster_url: media.poster_url,
            tv_type: media.tv_type,
            status: (status as any) || 'watching',
            score: media.score,
            added_at: Date.now(),
          },
        });
      }
      await loadLibraryData();
    } catch (e) {
      console.error('Watchlist status error:', e);
    }
  };

  const isInWatchlist = (media: SearchResponse) => {
    return watchlist.some((w) => w.media_id === media.url);
  };

  const getWatchlistStatus = (media: SearchResponse): string | undefined => {
    return watchlist.find((w) => w.media_id === media.url)?.status;
  };

  // Remove single item from Continue Watching (CloudStream removeLastWatched parity)
  const handleRemoveHistoryItem = async (media: SearchResponse) => {
    try {
      await invoke('remove_watch_history_item', { mediaId: media.url });
      await loadLibraryData();
    } catch (e) {
      console.error('Failed to remove history item:', e);
    }
  };

  // Quick Direct Play (Resume playback or play Ep 1 without modal)
  const handleQuickPlay = async (media: SearchResponse) => {
    try {
      const details: any = await invoke('load_media_details', {
        provider: media.api_name,
        url: media.url,
      });

      const hist = history.find((h) => h.media_id === media.url);
      let targetEp: Episode | undefined;
      if (hist && hist.episode_num && details.episodes) {
        targetEp = details.episodes.find((ep: Episode) => ep.episode === hist.episode_num);
      }
      if (!targetEp && details.episodes && details.episodes.length > 0) {
        targetEp = details.episodes[0];
      }

      if (targetEp) {
        const links: ExtractorLink[] = await invoke('extract_episode_links', {
          provider: media.api_name,
          data: targetEp.data,
        });
        if (links.length > 0) {
          const startTime =
            hist &&
            hist.position_ms > 3000 &&
            (!targetEp || targetEp.episode === (hist.episode_num ?? 1)) &&
            !hist.is_completed &&
            (hist.duration_ms === 0 || hist.position_ms / hist.duration_ms < 0.95)
              ? hist.position_ms / 1000
              : undefined;

          setPlayerState({
            item: media,
            episode: targetEp,
            links,
            allEpisodes: details.episodes,
            mediaDetails: details,
            startTime,
          });
          return;
        }
      }
      setSelectedItem(media);
    } catch (e) {
      console.error('Quick play fallback to details modal:', e);
      setSelectedItem(media);
    }
  };

  // Random Media Picker (CloudStream home_random parity)
  const handlePickRandomItem = () => {
    const allItems = Array.from(
      new Map(
        [
          ...catalog.flatMap((s) => s.list),
          ...continueWatchingItems,
          ...bookmarkSearchItems,
        ]
          .filter((it) => it.url && it.name)
          .map((it) => [it.url, it])
      ).values()
    );
    if (allItems.length === 0) return;
    const picked = allItems[Math.floor(Math.random() * allItems.length)];
    setSelectedItem(picked);
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
    const initialExt = localStorage.getItem('cloudstream_selected_extension') || '';
    if (initialExt && initialExt !== 'all' && initialExt !== 'random' && initialExt !== 'none') {
      loadHome(initialExt);
    }
    loadLibraryData();

    // When the Rust backend finishes starting the engine + loading all plugins,
    // it emits 'engine-ready'. Auto-reload so the user never sees an empty page.
    const unlisten = listen('engine-ready', () => {
      console.log('[App] engine-ready received — reloading extensions + home');
      loadExtensions();
    });

    return () => { unlisten.then(fn => fn()); };
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
      // Use actual tv_type from DB, fall back to Movie only if unknown
      tv_type: (h.tv_type as any) || 'Movie',
      poster_url: h.poster_url,
      // Don't force season=1 for movies — leave undefined so no S1:E1 badge
      season: h.tv_type === 'Movie' ? undefined : (h.season_num ?? undefined),
      episode: h.tv_type === 'Movie' ? undefined : (h.episode_num ?? undefined),
      latest_episode: h.tv_type === 'Movie' ? undefined : (h.episode_num ?? undefined),
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

  // Provider Shelves (ExpandableShelf parity)
  const filteredShelves = shelves.filter((s) => s.list.name !== 'Continue Watching');

  // Stremio Hero Spotlight items
  const heroBannerItems = React.useMemo(() => {
    const items: SearchResponse[] = [];
    for (const shelf of shelves) {
      for (const item of shelf.list.list) {
        if (item.poster_url && !items.some((existing) => existing.url === item.url)) {
          items.push(item);
        }
        if (items.length >= 8) break;
      }
      if (items.length >= 8) break;
    }
    return items;
  }, [shelves]);

  // CloudStream category matching parity
  const itemMatchesCategory = (item: SearchResponse, cat: CloudStreamCategory): boolean => {
    if (cat === 'All') return true;
    const t = (item.tv_type || '').toLowerCase();
    switch (cat) {
      case 'Movies':
        return t === 'movie' || t === 'animemovie';
      case 'TV Series':
        return t === 'tvseries';
      case 'Anime':
        return t === 'anime' || t === 'animemovie' || t === 'ova';
      case 'Asian Dramas':
        return t === 'asiandrama';
      case 'Cartoons':
        return t === 'cartoon';
      case 'Documentaries':
        return t === 'documentary';
      case 'Livestreams':
        return t === 'livestream' || t === 'live';
      case 'Torrents':
        return t === 'torrent';
      case 'NSFW':
        return t === 'nsfw';
      case 'Others':
        return t === 'other' || t === 'others';
      default:
        return true;
    }
  };

  const shelfMatchesCategory = (shelf: ExpandableShelf, cat: CloudStreamCategory): boolean => {
    if (cat === 'All') return true;
    const title = shelf.list.name.toLowerCase();

    // 1. Keyword matching on shelf title (exact category name from provider)
    switch (cat) {
      case 'Movies':
        if (title.includes('movie') || title.includes('cinema') || title.includes('film')) return true;
        break;
      case 'TV Series':
        if (title.includes('series') || title.includes('tv') || title.includes('show') || title.includes('season')) return true;
        break;
      case 'Anime':
        if (title.includes('anime') || title.includes('donghua') || title.includes('manga')) return true;
        break;
      case 'Asian Dramas':
        if (title.includes('asian') || title.includes('drama') || title.includes('kdrama') || title.includes('k-drama') || title.includes('cdrama') || title.includes('c-drama')) return true;
        break;
      case 'Cartoons':
        if (title.includes('cartoon') || title.includes('animation') || title.includes('animated') || title.includes('kids')) return true;
        break;
      case 'Documentaries':
        if (title.includes('docu')) return true;
        break;
      case 'Livestreams':
        if (title.includes('live') || title.includes('stream') || title.includes('iptv') || title.includes('channel')) return true;
        break;
      case 'Torrents':
        if (title.includes('torrent')) return true;
        break;
      case 'NSFW':
        if (title.includes('nsfw') || title.includes('adult') || title.includes('18+') || title.includes('hentai')) return true;
        break;
      case 'Others':
        if (title.includes('other')) return true;
        break;
    }

    // 2. Check if any item in this shelf matches the category
    return shelf.list.list.some((it: SearchResponse) => itemMatchesCategory(it, cat));
  };

  // Filter shelves based on board category — also drop empty shelves (no cards = no header)
  const visibleShelves = filteredShelves.filter((shelf) => {
    if (!shelf.list.list || shelf.list.list.length === 0) return false; // hide empty shelves
    return shelfMatchesCategory(shelf, boardCategory);
  });

  // CloudStream valid categories:
  // Dynamically compute valid categories matching installed providers or active shelves
  const visibleCategories = React.useMemo(() => {
    const supportedTypes = new Set<string>();

    if (selectedExtension === 'all' || selectedExtension === 'random') {
      extensions.forEach((ext) => {
        ext.supported_types?.forEach((t) => supportedTypes.add(t.toLowerCase()));
      });
    } else {
      const cur = extensions.find((e) => e.name === selectedExtension || e.id === selectedExtension);
      cur?.supported_types?.forEach((t) => supportedTypes.add(t.toLowerCase()));
    }

    shelves.forEach((shelf) => {
      shelf.list.list.forEach((item) => {
        if (item.tv_type) supportedTypes.add(item.tv_type.toLowerCase());
      });
    });

    if (supportedTypes.size === 0) {
      return CLOUDSTREAM_CATEGORIES;
    }

    return CLOUDSTREAM_CATEGORIES.filter((cat) => {
      if (cat.id === 'All') return true;
      const matchesType = cat.types.some((t) => supportedTypes.has(t.toLowerCase()));
      if (matchesType) return true;
      const catKeyword =
        cat.id === 'TV Series'
          ? 'series'
          : cat.id === 'Asian Dramas'
          ? 'drama'
          : cat.id === 'Livestreams'
          ? 'live'
          : cat.id.toLowerCase();
      return shelves.some((s) => s.list.name.toLowerCase().includes(catKeyword));
    });
  }, [extensions, selectedExtension, shelves]);

  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === boardCategory)) {
      setBoardCategory('All');
    }
  }, [visibleCategories, boardCategory]);

  const visibleContinueWatching = React.useMemo(() => {
    if (boardCategory === 'All') return continueWatchingItems;
    return continueWatchingItems.filter((it) => itemMatchesCategory(it, boardCategory));
  }, [continueWatchingItems, boardCategory]);

  const visibleBookmarks = React.useMemo(() => {
    if (boardCategory === 'All') return bookmarkSearchItems;
    return bookmarkSearchItems.filter((it) => itemMatchesCategory(it, boardCategory));
  }, [bookmarkSearchItems, boardCategory]);

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
    .filter((e) => e.id !== 'all' && e.id !== 'random' && e.id !== 'none')
    .filter((e) => {
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
        allEpisodes={playerState.allEpisodes}
        mediaDetails={playerState.mediaDetails}
        startTime={playerState.startTime}
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
            {/* CloudStream home_random Parity: Pick Random Title */}
            <button
              className="stremio-icon-btn"
              onClick={handlePickRandomItem}
              title="Surprise me with a random movie/series (CloudStream Random)"
            >
              <Dices size={16} />
            </button>

            {/* Refresh Catalog Button */}
            <button
              className="stremio-icon-btn"
              onClick={handleRefresh}
              title="Refresh provider catalog"
              disabled={loadingShelves || isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing || loadingShelves ? 'animate-spin' : ''} />
            </button>

            {/* Fullscreen Button */}
            <button className="stremio-icon-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
              <Maximize2 size={16} />
            </button>

            {/* CloudStream Extension Selector Pill (moved to rightmost position) */}
            <div className="extension-selector-container" ref={dropdownRef}>
              <div
                className="stremio-ext-badge"
                onClick={() => setShowExtensionDropdown(!showExtensionDropdown)}
                title="Select or switch active CloudStream extension"
              >
                {extensions.length === 0 ? (
                  <Puzzle size={14} color="var(--stremio-purple-light)" />
                ) : currentExtObj?.icon_url ? (
                  <>
                    <img
                      src={currentExtObj.icon_url}
                      alt={currentExtObj.name}
                      style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain', flexShrink: 0 }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (sib) sib.style.display = 'inline-flex';
                      }}
                    />
                    <span style={{ display: 'none', alignItems: 'center', justifyContent: 'center' }}>
                      <Puzzle size={14} color="var(--stremio-purple-light)" />
                    </span>
                  </>
                ) : (
                  <Puzzle size={14} color="var(--stremio-purple-light)" />
                )}
                <span className="stremio-ext-badge-text">
                  {extensions.length === 0
                    ? 'No Extensions'
                    : currentExtObj?.name || selectedExtension}
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
                        {sortedDropdownExts.length} available
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
                              {type === 'TvSeries'
                                ? 'TV Series'
                                : type === 'AsianDrama'
                                ? 'Asian Drama'
                                : type === 'AnimeMovie'
                                ? 'Anime Movie'
                                : type === 'LiveStream'
                                ? 'Livestream'
                                : type}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="ext-dropdown-list">
                    {sortedDropdownExts.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#8e8aa4' }}>
                        <Puzzle size={28} style={{ opacity: 0.35, marginBottom: '8px' }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f0f7' }}>No extensions found</div>
                        <div style={{ fontSize: '11.5px', color: '#6a6688', marginTop: '4px' }}>
                          Add a repository and install extensions in Extension Manager.
                        </div>
                      </div>
                    ) : (
                    sortedDropdownExts.map((ext) => {
                      const isSelected = selectedExtension === ext.name;
                      const isPinned = pinnedExtensions.includes(ext.name);

                      return (
                        <div
                          key={ext.id}
                          className={`ext-option-item ${isSelected ? 'active' : ''}`}
                          onClick={() => handleSelectExtension(ext.name)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                          <div className="ext-option-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            {ext.icon_url ? (
                              <img
                                src={ext.icon_url}
                                alt={ext.name}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '5px',
                                  objectFit: 'contain',
                                  background: 'rgba(255,255,255,0.04)',
                                  flexShrink: 0,
                                  border: 'none',
                                }}
                                onError={(ev) => {
                                  ev.currentTarget.style.display = 'none';
                                  const sibling = ev.currentTarget.nextElementSibling as HTMLElement | null;
                                  if (sibling) sibling.style.display = 'inline-flex';
                                }}
                              />
                            ) : null}
                            {/* Fallback icon shown only when image is absent or fails */}
                            <div
                              className="ext-option-fallback-icon"
                              style={{
                                display: ext.icon_url ? 'none' : 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                background: 'rgba(124, 58, 237, 0.15)',
                                flexShrink: 0,
                              }}
                            >
                              <Puzzle size={12} color="var(--stremio-purple-light)" />
                            </div>
                            <span className="ext-option-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ext.name}
                            </span>
                            {ext.version && (
                              <span style={{ fontSize: '10px', color: '#726e8c' }}>
                                {ext.version}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                            {isSelected && <Check size={14} color="var(--stremio-purple-light)" />}
                          </div>
                        </div>
                      );
                    })
                  )}
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
              ) : loadingShelves ? (
                <div style={{ padding: '80px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <RefreshCw size={18} className="animate-spin" />
                    Loading catalog from {selectedExtension || 'extension'}...
                  </div>
                </div>
              ) : shelves.length === 0 && continueWatchingItems.length === 0 && watchlist.length === 0 ? (
                <div className="home-error-card">
                  <Puzzle size={42} color="var(--stremio-purple-light)" />
                  <h3>No Media Returned for {selectedExtension || 'Selected Extension'}</h3>
                  <p>
                    Could not load shelves from this extension. Ensure your network has proper connectivity (or BDIX if required), or select another extension.
                  </p>
                    <div className="home-error-actions">
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          try {
                            const extInfo = extensions.find((e) => e.name === selectedExtension);
                            await openUrl(extInfo?.icon_url || 'https://google.com/search?q=' + encodeURIComponent(selectedExtension));
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        Check Provider Online
                      </button>
                      <button className="btn-secondary" onClick={() => setShowExtensionDropdown(true)}>
                        Switch Provider
                      </button>
                      <button className="btn-secondary" onClick={() => setActiveTab('plugins')}>
                        Extension Manager
                      </button>
                      <button className="btn-primary" onClick={handleRefresh}>
                        Retry Reload
                      </button>
                    </div>
                  </div>
              ) : (
                /* Stremio Media Shelves Board with CloudStream Shelves */
                <div>
                  {/* Stremio Hero Spotlight Carousel with CloudStream Preview Parity */}
                  {heroBannerItems.length > 0 && (
                    <HeroBanner
                      items={heroBannerItems}
                      loadedDetails={heroDetails}
                      onSelectItem={setSelectedItem}
                      onPlayItem={handleQuickPlay}
                      onToggleWatchlist={handleSetWatchlistStatus}
                      isInWatchlist={isInWatchlist}
                      currentWatchStatus={getWatchlistStatus}
                    />
                  )}

                  {/* CloudStream Home Page Category Chips (tvtypes_chips & TvType parity) */}
                  {visibleCategories.length > 1 && (
                    <div className="stremio-category-bar">
                      {visibleCategories.map((cat) => {
                        const IconComponent = cat.icon;
                        const isActive = boardCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            className={`stremio-category-pill ${isActive ? 'active' : ''}`}
                            onClick={() => setBoardCategory(cat.id)}
                          >
                            <IconComponent size={13} />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="stremio-board-container">
                    {/* 1. Continue Watching Shelf (Top Shelf - CloudStream getResumeWatching Parity) */}
                    {visibleContinueWatching.length > 0 && (
                      <MediaShelf
                        title="Continue Watching"
                        items={visibleContinueWatching}
                        progressMap={historyProgressMap}
                        onSelectItem={setSelectedItem}
                        onPlayItem={handleQuickPlay}
                        onRemoveItem={handleRemoveHistoryItem}
                        onSeeAll={() =>
                          setExpandedShelf({
                            title: 'Continue Watching',
                            items: visibleContinueWatching,
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
                    {visibleBookmarks.length > 0 && (
                      <MediaShelf
                        title="My Library"
                        items={visibleBookmarks}
                        onSelectItem={setSelectedItem}
                        onPlayItem={handleQuickPlay}
                        onSeeAll={() =>
                          setExpandedShelf({
                            title: `My Library (${bookmarkFilter === 'all' ? 'All' : bookmarkFilter.replace('_', ' ')})`,
                            items: visibleBookmarks,
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

                    {/* 3. Provider Shelves (CloudStream HomePageList category shelves) */}
                    {visibleShelves.map((shelf) => {
                      const displayTitle = shelf.list.name;
                      const shelfItems =
                        boardCategory === 'All'
                          ? shelf.list.list
                          : shelf.list.list.filter((it) => itemMatchesCategory(it, boardCategory)).length > 0
                          ? shelf.list.list.filter((it) => itemMatchesCategory(it, boardCategory))
                          : shelf.list.list;

                      return (
                        <MediaShelf
                          key={shelf.list.name}
                          title={displayTitle}
                          isHorizontal={shelf.list.is_horizontal}
                          items={shelfItems}
                          hasNext={shelf.has_next}
                          isLoadingMore={expandingShelf && expandedShelf?.shelfName === shelf.list.name}
                          onLoadMore={() => expandShelf(shelf.list.name)}
                          onSelectItem={setSelectedItem}
                          onPlayItem={handleQuickPlay}
                          onSeeAll={() =>
                            setExpandedShelf({
                              title: displayTitle,
                              items: shelf.list.list,
                              actionType: 'provider',
                              shelfName: shelf.list.name,
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
                      isContinueWatching={true}
                      progressPercent={h.duration_ms > 0 ? (h.position_ms / h.duration_ms) * 100 : 0}
                      onPlay={handleQuickPlay}
                      onRemove={handleRemoveHistoryItem}
                      onClick={setSelectedItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}


          {/* PLUGINS / EXTENSION MANAGER SCREEN */}
          {activeTab === 'plugins' && (
            <PluginsScreen
              onExtensionsChanged={() => {
                // Give the engine 2s to fully process /reload before re-fetching
                // extensions and home — otherwise newly installed .cs3 plugins
                // won't appear in the provider list yet.
                setTimeout(async () => {
                  await loadExtensions();
                  await loadHome();
                }, 2000);
              }}
              onSelectExtension={(name) => {
                setActiveTab('home');
                handleSelectExtension(name);
              }}
            />
          )}

          {/* SETTINGS SCREEN */}
          {activeTab === 'settings' && <SettingsScreen />}
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
          onPlay={(
            item: SearchResponse,
            episode: Episode,
            links: ExtractorLink[],
            allEpisodes?: Episode[],
            mediaDetails?: LoadResponse,
            startTime?: number
          ) => {
            setSelectedItem(null);
            setPlayerState({ item, episode, links, allEpisodes, mediaDetails, startTime });
          }}
          onSelectItem={(newItem: SearchResponse) => {
            setSelectedItem(newItem);
          }}
        />
      )}





      {/* Expanded Shelf Modal ("See All" - CloudStream Parity) */}
      {expandedShelf && (() => {
        const matchingShelf = expandedShelf.shelfName
          ? shelves.find((s) => s.list.name === expandedShelf.shelfName)
          : null;
        const currentItems = matchingShelf ? matchingShelf.list.list : expandedShelf.items;
        const hasNext = matchingShelf ? matchingShelf.has_next : false;

        return (
          <ExpandedShelfModal
            title={expandedShelf.title}
            items={currentItems}
            actionType={expandedShelf.actionType}
            progressMap={historyProgressMap}
            hasNext={hasNext}
            isLoadingMore={expandingShelf}
            onLoadMore={
              matchingShelf
                ? () => expandShelf(matchingShelf.list.name)
                : undefined
            }
            onClearHistory={handleClearHistory}
            onClose={() => setExpandedShelf(null)}
            onSelectItem={setSelectedItem}
            onPlayItem={handleQuickPlay}
            onRemoveItem={
              expandedShelf.actionType === 'continue_watching'
                ? handleRemoveHistoryItem
                : undefined
            }
          />
        );
      })()}
    </div>
  );
};

export default App;

