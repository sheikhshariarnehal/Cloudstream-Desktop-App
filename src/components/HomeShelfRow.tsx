import React, { useCallback } from 'react';
import { ExpandableShelf, SearchResponse } from '../types';
import { MediaShelf } from './MediaShelf';

export interface HomeShelfSeeAllEntry {
  title: string;
  items: SearchResponse[];
  actionType: 'provider';
  shelfName: string;
}

interface HomeShelfRowProps {
  shelf: ExpandableShelf;
  displayTitle: string;
  shelfItems: SearchResponse[];
  isLoadingMore: boolean;
  onSelectItem: (item: SearchResponse) => void;
  onPlayItem: (item: SearchResponse) => void;
  onExpandShelf: (shelfName: string) => void;
  onSeeAllShelf: (entry: HomeShelfSeeAllEntry) => void;
}

/**
 * Thin wrapper around MediaShelf that builds the `onSeeAll` / `onLoadMore`
 * closures from stable inputs (via useCallback) instead of App re-creating
 * them inline on every render. Combined with React.memo, this means a
 * provider shelf only re-renders when its own shelf/items actually change —
 * not whenever unrelated App state changes (search input, dropdowns, etc).
 */
const HomeShelfRowComponent: React.FC<HomeShelfRowProps> = ({
  shelf,
  displayTitle,
  shelfItems,
  isLoadingMore,
  onSelectItem,
  onPlayItem,
  onExpandShelf,
  onSeeAllShelf,
}) => {
  const handleLoadMore = useCallback(() => {
    onExpandShelf(shelf.list.name);
  }, [onExpandShelf, shelf.list.name]);

  const handleSeeAll = useCallback(() => {
    onSeeAllShelf({
      title: displayTitle,
      items: shelf.list.list,
      actionType: 'provider',
      shelfName: shelf.list.name,
    });
  }, [onSeeAllShelf, displayTitle, shelf]);

  return (
    <MediaShelf
      title={displayTitle}
      isHorizontal={shelf.list.is_horizontal}
      items={shelfItems}
      hasNext={shelf.has_next}
      isLoadingMore={isLoadingMore}
      onLoadMore={handleLoadMore}
      onSelectItem={onSelectItem}
      onPlayItem={onPlayItem}
      onSeeAll={handleSeeAll}
    />
  );
};

export const HomeShelfRow = React.memo(HomeShelfRowComponent);
