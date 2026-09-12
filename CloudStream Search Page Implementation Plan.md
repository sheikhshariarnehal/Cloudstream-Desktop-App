# Full CloudStream Search Page Implementation Plan

Implement 100% of the CloudStream Search system into **CloudStream Desktop** based on the architectural specification in [`search_page_architecture_and_implementation_guide.md`](file:///d:/Poject/CloudStream/CloudStream-Desktop/search_page_architecture_and_implementation_guide.md).

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions:**
> 1. **Dual Search Display Modes**: Users can freely toggle between **Grouped Shelves (Advanced Mode)** (shows a horizontal shelf for each provider with pinned providers at the top) and **Unified Grid (Autofit Mode)** (combines all providers using the exact CloudStream **Round-Robin Interleaving Algorithm**).
> 2. **TMDB Live Suggestions**: Fetched via a dedicated Rust backend command using TheMovieDB Multi-Search API with 300ms debouncing, allowing both direct search and "Fill into box" actions.
> 3. **Search History in SQLite**: Recent searches will be stored locally in the existing SQLite database (`search_history` table) with timestamps, query text, and type tags, supporting individual item deletion and full history wipe with confirmation.
> 4. **Provider Filter Modal**: A dedicated modal allowing users to enable/disable specific source extensions with country flags (`🇺🇸`, `🇯🇵`, `🇧🇩`, etc.), "Select All / Deselect All", and `TvType` filters.

---

## Open Questions

> [!NOTE]
> - Should the Search screen replace the current Discover tab in the sidebar or be a dedicated Search screen accessible via the top search bar and hotkey (`/` or `Ctrl+F`)?  
>   *(Recommended approach: Accessible directly from the top search bar as well as a dedicated Search button in the sidebar / navigation).*

---

## Proposed Changes

### 1. Rust Backend (`src-tauri`)

#### [MODIFY] [`src-tauri/src/models.rs`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src-tauri/src/models.rs)
- Add `SearchHistoryItem` struct (`id`, `search_text`, `searched_at`, `types`, `key`).
- Add `quality`, `season`, `episode` fields to `SearchResponse` (with `#[serde(default)]`).
- Add `SearchMultiResult` struct containing `grouped: Vec<ProviderSearchResult>` and `bundled: Vec<SearchResponse>`.

#### [MODIFY] [`src-tauri/src/database.rs`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src-tauri/src/database.rs)
- Add `CREATE TABLE IF NOT EXISTS search_history` in `init()`.
- Add methods:
  - `add_search_history(&self, item: &SearchHistoryItem) -> Result<()>`
  - `get_search_history(&self, limit: usize) -> Result<Vec<SearchHistoryItem>>`
  - `remove_search_history_item(&self, key: &str) -> Result<()>`
  - `clear_search_history(&self) -> Result<()>`

#### [MODIFY] [`src-tauri/src/lib.rs`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src-tauri/src/lib.rs)
- Implement Tauri IPC commands:
  - `get_search_suggestions(query: String) -> Result<Vec<String>, String>` (TMDB multi-search with error fallback).
  - `get_search_history(limit: usize, state: State<'_, AppState>) -> Result<Vec<SearchHistoryItem>, String>`
  - `add_search_history(item: SearchHistoryItem, state: State<'_, AppState>) -> Result<(), String>`
  - `remove_search_history_item(key: String, state: State<'_, AppState>) -> Result<(), String>`
  - `clear_search_history(state: State<'_, AppState>) -> Result<(), String>`
  - `search_media_multi(query: String, providers: Option<Vec<String>>, state: State<'_, AppState>) -> Result<SearchMultiResult, String>`
- Register all new commands in `.invoke_handler(tauri::generate_handler![...])`.

---

### 2. Frontend Types & State Management (`src/`)

#### [MODIFY] [`src/types.ts`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/types.ts)
- Export `SearchHistoryItem` interface.
- Export `ProviderSearchResult` and `SearchMultiResult` interfaces.
- Export `SearchDisplayMode` type (`'grouped' | 'grid'`).

#### [NEW] [`src/hooks/useSearchEngine.ts`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/hooks/useSearchEngine.ts)
- Comprehensive search hook managing:
  - Active query and debounced TMDB suggestions (300ms).
  - Search history loading, saving, single deletion, and clearing.
  - Concurrency index counter (`currentSearchIndex`) to abort and prevent race conditions.
  - Round-robin interleaving algorithm for grid mode and grouped maps for shelf mode.
  - Active provider selection and `TvType` chips filtering.
  - View mode state ('grouped' vs 'grid') with localStorage persistence.

---

### 3. UI Components (`src/components/search/` and `src/screens/`)

#### [NEW] [`src/components/search/SearchSuggestionsDropdown.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/search/SearchSuggestionsDropdown.tsx)
- Floating dropdown anchored beneath search bar when typing:
  - Displays top 10 unique TMDB suggestions.
  - Clicking item executes search immediately.
  - Arrow button (`↗` or `↵`) fills text into search bar without executing.
  - "Clear Suggestions" footer.

#### [NEW] [`src/components/search/SearchHistoryView.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/search/SearchHistoryView.tsx)
- Shown when search query is empty:
  - Displays list of recent searches with relative timestamps (`2 hours ago`, `yesterday`).
  - Click to re-search.
  - Remove button (`X`) per item.
  - "Clear All History" button with confirmation dialog.

#### [NEW] [`src/components/search/SearchFilterModal.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/search/SearchFilterModal.tsx)
- CloudStream source extension filter dialog:
  - Country flag emojis according to extension language.
  - Checkboxes for each installed provider.
  - Filter providers by `TvType` chips inside modal.
  - "Select All" / "Deselect All" quick buttons.
  - Persisted selection.

#### [NEW] [`src/screens/SearchScreen.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/screens/SearchScreen.tsx)
- Main dedicated Search Page:
  - Header: Search query title, stats counter, view mode toggle (Shelves 📑 / Grid ⊞), Filter button (`SlidersHorizontal` with badge).
  - `TvType` Chips Bar: Horizontal scrolling filter chips (`All`, `Movie`, `TvSeries`, `Anime`, `AsianDrama`, `Cartoon`, `LiveStream`, `Torrent`).
  - View rendering:
    - If query empty: Renders `SearchHistoryView`.
    - If searching: Skeleton loaders / progress spinner.
    - If results in Grouped Mode: Renders provider shelves with horizontal carousels, pinned provider prioritization, and "See All" modals.
    - If results in Grid Mode: Renders responsive unified grid using Round-Robin bundled results.
    - If no results: Helpful empty state with recommendation tags.

#### [MODIFY] [`src/components/MediaCard.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/MediaCard.tsx)
- Support rich CloudStream badges:
  - Dub/Sub badge (e.g. `DUB`, `SUB 12 eps`).
  - Quality badge (e.g. `4K`, `HD`, `CAM`).
  - Rating badge (`⭐ 8.2`).
  - Provider name tag on card corner.

#### [MODIFY] [`src/App.tsx`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/App.tsx)
- Integrate `SearchScreen` into main tab navigation (`activeTab === 'search'`).
- Integrate `SearchSuggestionsDropdown` into the header search bar.
- Add global keyboard shortcut (`/` or `Ctrl+F` to focus search, `Esc` to close overlays).

#### [MODIFY] [`src/App.css`](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/App.css)
- Add sleek dark glassmorphic styles for search suggestions, history items, filter modal, view mode toggle pills, and card badges.

---

## Verification Plan

### Automated Tests
- Run `cargo check` in `d:\Poject\CloudStream\CloudStream-Desktop\src-tauri` to verify Rust code compiles without errors.
- Run `npx tsc --noEmit` in `d:\Poject\CloudStream\CloudStream-Desktop` to ensure zero TypeScript errors.

### Manual Verification
1. **Search Query & Suggestions**:
   - Type `"spider"` in search bar -> Verify TMDB suggestions dropdown appears after 300ms debounce.
   - Click arrow icon -> Verify search input fills with suggestion without submitting.
   - Click suggestion -> Verify search executes and navigates to Search tab.
2. **Search History**:
   - Clear input -> Verify recent search history is displayed with timestamps.
   - Click single delete `X` -> Verify item disappears.
   - Click "Clear All" -> Verify confirmation modal and complete clear.
3. **Dual Display Modes**:
   - Execute search -> Toggle between **Grouped Mode (Shelves)** and **Grid Mode (Round-Robin)**.
   - In Grouped Mode: Verify each provider has its own horizontal shelf with count and expand action.
   - In Grid Mode: Verify results are interleaved across providers.
4. **Filters**:
   - Toggle `TvType` chips (e.g. `Anime`, `Movie`) -> Verify instant filtering.
   - Open Provider Filter Modal -> Deselect a provider -> Verify search updates.
5. **Keyboard Hotkeys**:
   - Press `/` or `Ctrl+F` -> Verify search bar is focused.
   - Press `Esc` -> Verify suggestions or modals dismiss.
