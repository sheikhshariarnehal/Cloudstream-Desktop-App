import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  SearchResponse,
  SearchHistoryItem,
  ProviderSearchResult,
  SearchMultiResult,
  SearchChunkEvent,
  SearchDisplayMode,
  TvType,
} from '../types';
import { trackSearch } from '../utils/openpulse';

interface CachedSearchResult {
  grouped: ProviderSearchResult[];
  bundled: SearchResponse[];
  timestamp: number;
}

// Interleave results across providers fairly (Row 1 gets item 0 from every provider, Row 2 gets item 1, etc.)
function interleaveBundledResults(groups: ProviderSearchResult[]): SearchResponse[] {
  const lists = groups.map((g) => g.items);
  const bundled: SearchResponse[] = [];
  const seenUrls = new Set<string>();
  let idx = 0;
  while (true) {
    let added = 0;
    for (const list of lists) {
      if (list.length > idx) {
        const item = list[idx];
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          bundled.push(item);
        }
        added++;
      }
    }
    if (added === 0) break;
    idx++;
  }
  return bundled;
}

export function useSearchEngine() {
  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedTvTypes, setSelectedTvTypes] = useState<TvType[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  // Progressive streaming search progress
  const [searchProgress, setSearchProgress] = useState<{
    completed: number;
    total: number;
    completedProviders: string[];
  }>({ completed: 0, total: 0, completedProviders: [] });

  // Always default to 'grouped' (shelves per provider) — matches CloudStream Android behavior.
  // Grid mode is available via toggle but does not persist as the startup default.
  const [viewMode, setViewModeState] = useState<SearchDisplayMode>('grouped');

  const setViewMode = (mode: SearchDisplayMode) => {
    setViewModeState(mode);
  };

  // Results
  const [groupedResults, setGroupedResults] = useState<ProviderSearchResult[]>([]);
  const [bundledResults, setBundledResults] = useState<SearchResponse[]>([]);

  // Concurrency & active query control
  const activeQueryRef = useRef('');
  const searchIndexRef = useRef(0);
  const debounceTimerRef = useRef<any>(null);
  const liveSearchTimerRef = useRef<any>(null);
  const suppressSuggestionsRef = useRef(false);

  // In-memory LRU cache (key -> results, max 20 entries, 5-min TTL)
  const searchCache = useRef<Map<string, CachedSearchResult>>(new Map());

  // Load Search History from SQLite
  const loadHistory = useCallback(async () => {
    try {
      const res: SearchHistoryItem[] = await invoke('get_search_history', { limit: 30 });
      setHistory(res);
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Set up Tauri event listener for real-time progressive streaming chunks
  useEffect(() => {
    let unlistenChunk: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;

    listen<SearchChunkEvent>('search://chunk', (event) => {
      const chunk = event.payload;
      if (!chunk || !activeQueryRef.current) return;

      // Ignore chunks for outdated queries
      if (chunk.query.trim().toLowerCase() !== activeQueryRef.current.trim().toLowerCase()) {
        return;
      }

      setSearchProgress((prev) => ({
        completed: chunk.completed_count,
        total: chunk.total_count,
        completedProviders: prev.completedProviders.includes(chunk.provider)
          ? prev.completedProviders
          : [...prev.completedProviders, chunk.provider],
      }));

      if (chunk.items && chunk.items.length > 0) {
        setGroupedResults((prev) => {
          const existingIdx = prev.findIndex(
            (g) => g.provider.toLowerCase() === chunk.provider.toLowerCase()
          );

          let updated: ProviderSearchResult[];
          if (existingIdx >= 0) {
            updated = [...prev];
            const existingUrls = new Set(updated[existingIdx].items.map((it) => it.url));
            const newItems = chunk.items.filter((it) => !existingUrls.has(it.url));
            updated[existingIdx] = {
              ...updated[existingIdx],
              items: [...updated[existingIdx].items, ...newItems],
            };
          } else {
            updated = [
              ...prev,
              {
                provider: chunk.provider,
                items: chunk.items,
                current_page: 1,
                has_next: false,
              },
            ];
          }

          // Progressively update the round-robin bundled grid
          const interleaved = interleaveBundledResults(updated);
          setBundledResults(interleaved);

          return updated;
        });
      }

      if (chunk.is_done) {
        setSearching(false);
      }
    }).then((unlisten) => {
      unlistenChunk = unlisten;
    });

    listen('search://complete', (event: any) => {
      const payload = event.payload;
      if (payload?.query?.trim().toLowerCase() === activeQueryRef.current.trim().toLowerCase()) {
        setSearching(false);
      }
    }).then((unlisten) => {
      unlistenComplete = unlisten;
    });

    return () => {
      if (unlistenChunk) unlistenChunk();
      if (unlistenComplete) unlistenComplete();
    };
  }, []);

  // Fetch TMDB live suggestions with 300ms debounce
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res: string[] = await invoke('get_search_suggestions', { query: q });
        setSuggestions(res);
        if (!suppressSuggestionsRef.current && res.length > 0) {
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error('Failed to fetch TMDB suggestions:', e);
      }
    }, 280);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const updateSearchQuery = useCallback((query: string) => {
    suppressSuggestionsRef.current = false;
    setSearchQuery(query);
  }, []);

  // Execute Search (with in-memory cache check, streaming dispatch, and history save)
  const executeSearch = useCallback(
    async (queryToSearch?: string, saveHistory = true) => {
      suppressSuggestionsRef.current = true;
      setShowSuggestions(false);

      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
      }

      const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
      if (q.length <= 1) {
        setGroupedResults([]);
        setBundledResults([]);
        setLastSearchedQuery('');
        setSearching(false);
        activeQueryRef.current = '';
        setSearchProgress({ completed: 0, total: 0, completedProviders: [] });
        return;
      }

      activeQueryRef.current = q;
      setLastSearchedQuery(q);
      const currentIndex = ++searchIndexRef.current;

      // Check In-Memory LRU Cache for instant 0ms retrieval
      const cacheKey = `${q.toLowerCase()}__${[...selectedProviders].sort().join(',')}`;
      const cached = searchCache.current.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp < 300000) {
        setGroupedResults(cached.grouped);
        setBundledResults(cached.bundled);
        setSearching(false);
        setSearchProgress({
          completed: cached.grouped.length,
          total: cached.grouped.length,
          completedProviders: cached.grouped.map((g) => g.provider),
        });
        return;
      }

      // Reset state for new live search
      setSearching(true);
      setGroupedResults([]);
      setBundledResults([]);
      setSearchProgress({ completed: 0, total: 0, completedProviders: [] });

      // Save to SQLite search history asynchronously when requested
      if (saveHistory) {
        const historyKey = String(Math.abs(q.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)));
        invoke('add_search_history', {
          item: {
            search_text: q,
            searched_at: Date.now(),
            types: selectedTvTypes,
            key: historyKey,
          },
        })
          .then(() => loadHistory())
          .catch((e) => console.error('Failed to save search history:', e));
      }

      try {
        // Dispatches the streaming search in Rust backend
        const res: SearchMultiResult = await invoke('search_media_stream', {
          query: q,
          providers: selectedProviders.length > 0 ? selectedProviders : null,
        });

        if (searchIndexRef.current !== currentIndex) return;

        // Populate and cache final aggregated results
        const finalGrouped = res.grouped || [];
        const finalBundled = res.bundled || [];
        setGroupedResults(finalGrouped);
        setBundledResults(finalBundled);

        // OpenPulse Telemetry: Track search query & results count
        trackSearch(q, finalBundled.length, selectedProviders.join(',') || 'all');

        // Store in LRU cache (limit to 20 entries)
        if (searchCache.current.size >= 20) {
          const oldestKey = searchCache.current.keys().next().value;
          if (oldestKey) searchCache.current.delete(oldestKey);
        }
        searchCache.current.set(cacheKey, {
          grouped: finalGrouped,
          bundled: finalBundled,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('Search execution error:', e);
      } finally {
        if (searchIndexRef.current === currentIndex) {
          setSearching(false);
        }
      }
    },
    [searchQuery, selectedProviders, selectedTvTypes, loadHistory]
  );

  // Auto-search effect as user types with 350ms debounce
  useEffect(() => {
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
    }

    const q = searchQuery.trim();
    if (q.length < 2) {
      if (q.length === 0) {
        setGroupedResults([]);
        setBundledResults([]);
        setLastSearchedQuery('');
        setSearching(false);
        activeQueryRef.current = '';
        setSearchProgress({ completed: 0, total: 0, completedProviders: [] });
      }
      return;
    }

    liveSearchTimerRef.current = setTimeout(() => {
      executeSearch(q, false);
    }, 350);

    return () => {
      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
      }
    };
  }, [searchQuery, selectedProviders, executeSearch]);

  // Toggle TvType chip
  const toggleTvType = (type: TvType) => {
    setSelectedTvTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // History Actions
  const removeHistoryItem = async (key: string) => {
    try {
      await invoke('remove_search_history_item', { key });
      setHistory((prev) => prev.filter((h) => h.key !== key));
    } catch (e) {
      console.error('Failed to remove history item:', e);
    }
  };

  const clearAllHistory = async () => {
    try {
      await invoke('clear_search_history');
      setHistory([]);
    } catch (e) {
      console.error('Failed to clear search history:', e);
    }
  };

  // Filtered Results based on selected TvTypes (case-insensitive safe match)
  const filterMediaList = (list: SearchResponse[]) => {
    if (selectedTvTypes.length === 0) return list;
    return list.filter((item) =>
      selectedTvTypes.some(
        (t) => t.toLowerCase() === (item.tv_type || '').toLowerCase()
      )
    );
  };

  const filteredBundledResults = filterMediaList(bundledResults);

  // Grouped results filtered by TvType and sorted with Pinned Providers first (Parity with CloudStream Android)
  const filteredGroupedResults = (() => {
    let pinned: string[] = [];
    try {
      pinned = JSON.parse(localStorage.getItem('cloudstream_pinned_extensions') || '[]');
    } catch {}

    return groupedResults
      .map((group) => ({
        ...group,
        items: filterMediaList(group.items),
      }))
      .filter((group) => group.items.length > 0)
      .sort((a, b) => {
        const aPinned = pinned.includes(a.provider);
        const bPinned = pinned.includes(b.provider);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return a.provider.localeCompare(b.provider);
      });
  })();

  return {
    searchQuery,
    setSearchQuery: updateSearchQuery,
    lastSearchedQuery,
    searching,
    searchProgress,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    history,
    selectedTvTypes,
    toggleTvType,
    setSelectedTvTypes,
    selectedProviders,
    setSelectedProviders,
    viewMode,
    setViewMode,
    groupedResults: filteredGroupedResults,
    bundledResults: filteredBundledResults,
    rawGroupedCount: groupedResults.length,
    executeSearch,
    removeHistoryItem,
    clearAllHistory,
  };
}
