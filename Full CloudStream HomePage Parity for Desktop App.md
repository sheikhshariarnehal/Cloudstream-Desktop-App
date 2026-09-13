# Implementation Plan: Full CloudStream HomePage Parity for Desktop App

Bring 100% feature and visual parity from CloudStream's Android/TV MainPage architecture ([MAINPAGE_CONTEXT.md](file:///d:/Poject/CloudStream/cloudstream/MAINPAGE_CONTEXT.md)) to the desktop application ([CloudStream-Desktop](file:///d:/Poject/CloudStream/CloudStream-Desktop)).

## User Review Required

> [!IMPORTANT]
> - **Virtual Providers**: Selecting **"None"** will switch the home screen into clean offline mode (showing Continue Watching, My Library, and Search without making external provider requests). Selecting **"Random"** will aggregate and shuffle shelves across all installed and active providers.
> - **Continue Watching Item Removal**: Users can now remove an individual title from Continue Watching directly via card hover / context action, in addition to clearing the whole history.
> - **Random Media Picker**: A dedicated shuffle/dice action will pick a random movie/show from currently loaded shelves and open it instantly.

---

## Proposed Changes

### Component 1: Rust Backend Engine & Commands (`src-tauri/src/`)

#### [MODIFY] [providers/mod.rs](file:///d:/Poject/CloudStream/CloudStream-Desktop/src-tauri/src/providers/mod.rs)
- Update `get_home_page` to support virtual providers:
  - `Some("none") | Some("None")`: returns empty list immediately without hitting network/engine.
  - `Some("random") | Some("Random")`: aggregates shelves across all installed providers with `has_main_page == true`.
  - Supports pagination parameter `page: i32`.

#### [MODIFY] [lib.rs](file:///d:/Poject/CloudStream/CloudStream-Desktop/src-tauri/src/lib.rs)
- Update `get_home_catalog` to accept `page: Option<i32>`.
- Ensure `remove_watch_history_item` is properly exposed and updates DB immediately.

---

### Component 2: Frontend Data Models & Helper Utilities (`src/`)

#### [MODIFY] [types.ts](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/types.ts)
- Add helper types for virtual providers (`'all' | 'none' | 'random' | string`).
- Add language flag emoji lookup helper `getFlagFromIso(lang?: string): string`.
- Ensure `SearchResponse` supports full duration, cast, and tags metadata for rich previews.

---

### Component 3: Hero Billboard Carousel (`src/components/HeroBanner.tsx`)

#### [MODIFY] [HeroBanner.tsx](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/HeroBanner.tsx)
- Upgrade to match CloudStream's `HomeParentItemAdapterPreview` / `HomeScrollAdapter`:
  - Score badge with exact CloudStream color thresholds:
    - Score `< 5.0` &rarr; Red (`#eb2f2f`)
    - Score `5.0 - 7.9` &rarr; Yellow (`#eda009`)
    - Score `&ge; 8.0` &rarr; Green (`#3bb33b`)
  - Real metadata: Year, duration (in minutes, e.g. `142 min`), media type chip (`Movie`, `Series`, `Anime`), quality badge (`4K UHD`, `1080p`).
  - Synopsis / Plot preview with fallback.
  - Cast / Actors chips row and Genre / Tag chips.
  - Quick action buttons:
    - **"Play Now"**: Direct playback resumption.
    - **"Details & Streams"**: Opens modal.
    - **"Add to Library"**: Dropdown status picker (`Watching`, `Plan to Watch`, `Completed`, `On Hold`, `Dropped`).

---

### Component 4: Media Cards & Shelves (`src/components/`)

#### [MODIFY] [MediaCard.tsx](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/MediaCard.tsx)
- Add quick action overlay on hover:
  - Play button overlay for quick start.
  - Trash / Remove button (when rendered in Continue Watching shelf) calling `onRemoveFromHistory(item)`.
- Support episode badge (`S1:E4` or `Ep 4`) and progress bar.

#### [MODIFY] [MediaShelf.tsx](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/MediaShelf.tsx)
- Support `onRemoveItem` callback for Continue Watching.
- Support smooth pagination buttons and custom action headers.

#### [MODIFY] [ExpandedShelfModal.tsx](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/components/ExpandedShelfModal.tsx)
- Fullscreen responsive grid with search filter, sort selector (Top Rated, Year, Alphabetical), and bulk actions.

---

### Component 5: Main Application & Home Screen (`src/App.tsx` & `src/App.css`)

#### [MODIFY] [App.tsx](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/App.tsx)
- Integrate Virtual Providers: `"All Extensions"`, `"None"`, `"Random"`, and installed providers.
- Provider selector modal / dropdown:
  - Search input for installed providers.
  - `TvType` chips filter.
  - Pinned providers floating at top.
  - ISO language flags (`🇺🇸`, `🇧🇩`, `🇯🇵`, `🇮🇳`, etc.).
- Add **Random Media Picker Button** (CloudStream `home_random` parity) in header to surprise-play or inspect a random title from loaded items.
- Continue Watching shelf:
  - Real-time progress bar.
  - Individual item removal via `remove_watch_history_item`.
  - Full history clear with confirmation.
- Bookmarks shelf:
  - Chips for `Watching`, `Plan to Watch`, `Completed`, `On Hold`, `Dropped` with live counts.
  - Filter items instantaneously.
- Error state and offline fallback with "Open in Browser", "Go to Library", and "Retry".

#### [MODIFY] [App.css](file:///d:/Poject/CloudStream/CloudStream-Desktop/src/App.css)
- Add styles for the upgraded Hero Banner rating badges, flags, random picker button, card context actions, and offline error state.

---

## Verification Plan

### Automated Tests
- Run `npm run build` or `npx tsc --noEmit` to verify TypeScript types and compilation without errors.
- Verify cargo compilation with `cargo check` in `src-tauri`.

### Manual Verification
1. **Virtual Providers Test**:
   - Select `"None"` &rarr; Verify provider shelves hide, only Continue Watching and Bookmarks show.
   - Select `"Random"` &rarr; Verify shelves from multiple active providers load and shuffle.
   - Select a specific provider (e.g. `DhakaFlix` or `DiscoveryFTP`) &rarr; Verify its specific shelves load.
2. **Hero Billboard Test**:
   - Verify backdrop rendering, dynamic rating color (green, yellow, red), metadata chips, and play/details buttons.
3. **Continue Watching Test**:
   - Start an episode, advance playback, return to Home.
   - Verify item appears with progress bar.
   - Click "Remove" icon on card &rarr; verify item disappears from Continue Watching without clearing other items.
4. **Bookmarks Filtering Test**:
   - Toggle chips (`Watching`, `Completed`, `Plan to Watch`) &rarr; verify shelf updates accordingly.
5. **Random Media Picker**:
   - Click shuffle/dice button &rarr; verify random title is chosen and loaded.
