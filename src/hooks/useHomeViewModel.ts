import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ExpandableShelf, SearchResponse, LoadResponse, HomePageList } from '../types';

export function useHomeViewModel(selectedExtension: string) {
  const [shelves, setShelves] = useState<ExpandableShelf[]>([]);
  const [loadingShelves, setLoadingShelves] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [heroDetails, setHeroDetails] = useState<Record<string, LoadResponse>>({});
  const [expandedShelf, setExpandedShelf] = useState<ExpandableShelf | null>(null);
  const [expandingShelfName, setExpandingShelfName] = useState<string | null>(null);
  const expandingShelf = Boolean(expandingShelfName);

  // Request cancellation tracker (CloudStream HomeViewModel.loadAndCancel parity)
  const currentRequestId = useRef<number>(0);

  // Pre-fetch LoadResponse for hero spotlight items (CloudStream updatePreviewResponses parity).
  // Staggered (rather than all fired at once) so the burst of `invoke` calls
  // and resulting state updates don't compete with the initial home render
  // for the main thread / IPC right as the page first paints.
  const prefetchHeroDetails = useCallback((items: SearchResponse[]) => {
    const candidates = items.slice(0, 6);
    candidates.forEach((item, idx) => {
      if (!item.url || !item.api_name) return;

      const fetchOne = () => {
        setHeroDetails((prev) => {
          if (prev[item.url]) return prev;

          invoke<LoadResponse>('load_media', {
            provider: item.api_name,
            url: item.url,
          })
            .then((res) => {
              if (res) {
                setHeroDetails((d) => ({ ...d, [item.url]: res }));
              }
            })
            .catch((err) => {
              console.warn('[useHomeViewModel] prefetch error for item:', item.name, err);
            });

          return prev;
        });
      };

      // Only the first hero item is fetched immediately (it's what's visible
      // right away); the rest are staggered so this burst of `invoke` calls
      // doesn't compete with the initial shelf render for the main thread.
      if (idx === 0) {
        fetchOne();
      } else {
        setTimeout(fetchOne, idx * 400);
      }
    });
  }, []);

  // Load home shelves
  const loadHome = useCallback(
    async (extName?: string) => {
      const requestId = ++currentRequestId.current;
      setLoadingShelves(true);

      const target = extName !== undefined ? extName : selectedExtension;

      if (!target || target === 'none' || target === 'None' || target === 'None (Offline Mode)') {
        setShelves([]);
        setLoadingShelves(false);
        return;
      }

      const providerArg =
        target === 'all' || target === 'All Extensions'
          ? null
          : target === 'random' || target === 'Random Aggregator'
          ? 'random'
          : target;

      try {
        let loadedShelves: ExpandableShelf[] = [];
        try {
          loadedShelves = await invoke<ExpandableShelf[]>('get_home_shelves', {
            provider: providerArg,
          });
        } catch {
          // Fallback to get_home_catalog if needed
          const rawCatalog = await invoke<HomePageList[]>('get_home_catalog', {
            provider: providerArg,
            page: 1,
          });
          loadedShelves = rawCatalog.map((s) => ({
            list: s,
            current_page: 1,
            has_next: s.list.length >= 10,
          }));
        }

        if (requestId !== currentRequestId.current) return;

        setShelves(loadedShelves);

        // Extract hero items to prefetch real LoadResponse data
        const heroItems: SearchResponse[] = [];
        for (const s of loadedShelves) {
          for (const it of s.list.list) {
            if (it.poster_url && !heroItems.some((e) => e.url === it.url)) {
              heroItems.push(it);
            }
            if (heroItems.length >= 8) break;
          }
          if (heroItems.length >= 8) break;
        }

        if (heroItems.length > 0) {
          prefetchHeroDetails(heroItems);
        }
      } catch (err) {
        console.error('[useHomeViewModel] Failed to load home shelves:', err);
        if (requestId === currentRequestId.current) {
          setShelves([]);
        }
      } finally {
        if (requestId === currentRequestId.current) {
          setLoadingShelves(false);
        }
      }
    },
    [selectedExtension, prefetchHeroDetails]
  );

  // Expand shelf (CloudStream expand(categoryName) parity)
  const expandShelf = useCallback(
    async (shelfName: string) => {
      const shelf = shelves.find((s) => s.list.name === shelfName);
      if (!shelf || !shelf.has_next || expandingShelfName) return;

      setExpandingShelfName(shelfName);
      const nextPage = shelf.current_page + 1;

      const providerArg =
        selectedExtension === 'all' || selectedExtension === 'All Extensions'
          ? null
          : selectedExtension === 'random' || selectedExtension === 'Random Aggregator'
          ? 'random'
          : selectedExtension;

      try {
        const result: ExpandableShelf = await invoke('expand_shelf', {
          provider: providerArg,
          shelfName,
          page: nextPage,
        });

        setShelves((prevShelves) => {
          return prevShelves.map((s) => {
            if (s.list.name === shelfName) {
              const existingUrls = new Set(s.list.list.map((it) => it.url));
              const newItems = result.list.list.filter((it) => !existingUrls.has(it.url));
              const updatedShelf: ExpandableShelf = {
                list: {
                  ...s.list,
                  list: [...s.list.list, ...newItems],
                },
                current_page: nextPage,
                has_next: result.has_next && newItems.length > 0,
              };

              setExpandedShelf((curr) => (curr && curr.list.name === shelfName ? updatedShelf : curr));
              return updatedShelf;
            }
            return s;
          });
        });
      } catch (e) {
        console.error(`[useHomeViewModel] Failed to expand shelf '${shelfName}':`, e);
      } finally {
        setExpandingShelfName(null);
      }
    },
    [shelves, selectedExtension, expandingShelfName]
  );

  return {
    shelves,
    setShelves,
    loadingShelves,
    isRefreshing,
    setIsRefreshing,
    heroDetails,
    expandedShelf,
    setExpandedShelf,
    expandingShelf,
    expandingShelfName,
    loadHome,
    expandShelf,
  };
}
