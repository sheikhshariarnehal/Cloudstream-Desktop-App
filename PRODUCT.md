# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Self-contained modern HTML5/CSS3/JavaScript in `installer/` (zero build dependencies, ultra-fast loading, directly deployable to GitHub Pages, Cloudflare Pages, or Vercel).

## Users

Media streamers, movie, anime, and series enthusiasts, and CloudStream community members seeking a high-performance, ad-free streaming experience across both Desktop (Windows, macOS, Linux) and Mobile (Android Phone, Android TV, FireStick) without JVM emulation or heavy Electron bloat.

## Product Purpose

Deliver a unified, high-converting download and showcase landing page for the CloudStream ecosystem. The landing page introduces the new Rust-powered Desktop client (sub-200ms cold launches, ~60MB RAM, built-in M3U8 anti-403 proxy, SQLite persistence) alongside the CloudStream Mobile & Android TV applications, providing direct download binaries, scan-to-install mobile QR codes, repository setup guides, and ecosystem feature comparisons.

## Positioning

The unified open-source streaming ecosystem: Stremio-grade native Rust desktop performance on PC/Mac/Linux harmonized with full CloudStream Android/TV app parity, sharing the exact same `.cs3` multi-provider plugin architecture and zero subscription fee.

## Operating Context

Web landing portal accessed by desktop and mobile visitors coming from GitHub, Discord, Reddit, and community forums. Features automatic client OS detection, prominent 1-click download actions, scan-to-download QR codes for instant mobile/TV sideloading, side-by-side interactive device previews, and copyable repository configurations.

## Capabilities and Constraints

- **Capabilities**:
  - Client platform auto-detection (Windows, Android, macOS, Linux) to prioritize the correct download CTA.
  - Desktop installer download targets: Windows Setup (`.exe` x64), portable builds, macOS (`.dmg`), and Linux (`.AppImage`).
  - Mobile download targets: Android Phone APK (Stable & Pre-release) and Android TV / FireStick APK.
  - Interactive QR code generator / modal for instant mobile phone scanning from a desktop screen.
  - Side-by-side cinema device mockup showcasing the Desktop app and Mobile/TV app UI in action.
  - Technical feature matrix highlighting Rust performance, ~60MB RAM footprint, M3U8 CDN bypass proxy, AniSkip intro skipping, multi-source search, and BDIX gigabit support.
  - Step-by-step repository setup wizard (`repo.json`) with one-click copyable repository URLs.
  - Full-screen offline media & playback hub (CloudStream Android `DownloadChildFragment` & `DownloadedPlayerActivity` parity): dedicated full-screen view replacing cramped dialogs, ambient hero banner, Play Next Episode autoplay sequencing, watch history tracking with Watched checkmark toggles, multi-select batch deletion, live segment transfer speed/ETA metrics, pause/resume/retry controls, and native Explorer file reveal.
- **Constraints**:
  - Self-contained vanilla web stack within `installer/index.html` (single file or cleanly co-located assets) with no mandatory build or bundler steps.
  - Fully responsive across mobile (320px+), tablet, and desktop (1440px+).
  - Ad-free, tracker-free, privacy-respecting client-side execution.

## Brand Commitments

- **Name**: CloudStream Ecosystem (CloudStream Desktop Rust Edition & CloudStream Mobile)
- **Palette**: Obsidian Void (`#0c0b12`), Night Violet (`#19173a`), Electric Purple (`#7c3aed`), Neon Cyan (`#06b6d4`), Emerald Accent (`#10b981`), and Pure White (`#ffffff`).
- **Aesthetic**: Cinema-grade dark glassmorphism, glowing accents, clean typography (Outfit / Inter / JetBrains Mono), flat-rest lift-active elevation, and subtle 60fps micro-animations.

## Evidence on Hand

- Rust backend and desktop application code in `src-tauri/` and `src/`.
- Android mobile repository in `d:\Poject\CloudStream\cloudstream`.
- Incumbent installer landing prototype in `installer/index.html`.
- Impeccable design specifications in `DESIGN.md` and `.impeccable/design.json`.

## Product Principles

1. **Immediate Value & Frictionless Action**: Automatically detect the visitor's operating system, offering immediate 1-click downloads and mobile QR codes with zero ads, survey walls, or redirects.
2. **Unified Multi-Screen Ecosystem**: Position Desktop and Mobile as two halves of a cohesive streaming universe that share the same `.cs3` plugins, providers, and community.
3. **Transparent Performance Superiority**: Let the numbers speak - highlight sub-200ms cold startup, 60MB RAM footprint, and native Rust reliability over bloated alternatives.
4. **Frictionless Mobile & TV Sideloading**: Provide prominent QR codes and step-by-step setup guides to make Android and Android TV installation seamless.
5. **Privacy & Open Source Truth**: Emphasize free forever, zero telemetry, GPL/Apache open-source integrity, and direct GitHub releases.

## Accessibility & Inclusion

- High-contrast text exceeding WCAG 2.1 AA standards on dark canvas backgrounds.
- Full keyboard navigability (Tab, Enter, Space, Escape for modals).
- Screen-reader friendly semantic structure (h1-h3, ARIA labels, descriptive image alt tags).

---

## UI Components - Detail / Product Screen

The Detail Screen (`DetailModal.tsx`) is the primary full-screen media hub, mirroring CloudStream Android's `LoadFragment` + `DownloadChildFragment` combined experience. All components render inside the `stremio-detail-overlay` full-viewport container.

### Layout Modes

| Mode | Trigger | Layout |
|---|---|---|
| **Movie / AnimeMovie / LiveStream** | `tv_type` is `Movie`, `AnimeMovie`, `Torrent`, or `LiveStream` | Single-column cinematic hero: poster fills background, content stacks vertically |
| **Series / Anime / Cartoon / AsianDrama** | All other `tv_type` values | Two-column split: left info panel + right scrollable episode list |

---

### Hero Banner & Backdrop

- **Full-viewport background image** (`.stremio-backdrop-image`): uses `background_poster_url` with `poster_url` fallback; fixed-position `<img>` with `object-fit: cover`.
- **Vignette overlay** (`.stremio-backdrop-vignette`): dark radial gradient over the backdrop for text legibility.
- **Floating top bar** (`.stremio-top-bar`):
  - Back icon button (`ChevronLeft` 26px) - closes modal; also bound to Escape key.
  - Provider tag chip (`.stremio-provider-tag`) - displays the source `api_name`.

---

### Meta Row

Horizontal flex row of badge and value pills below the title:

| Token | CSS Class | Color / Note |
|---|---|---|
| Type badge | `.stremio-meta-badge.type-badge` | Colored by `tv_type` (e.g. `.anime`, `.movie`) |
| Status | `.stremio-meta-badge.status-badge` | `.ongoing` has a pulsing live-dot |
| IMDb score | `.stremio-meta-val.rating-val` + `.stremio-imdb-badge` | Yellow accent |
| Content rating | `.stremio-meta-badge` | Neutral dark pill |
| Episode/season summary | `.stremio-meta-val.series-stats-val` | Muted text |
| Episode runtime | `.stremio-meta-val.ep-duration-val` | `~45m/ep` format |
| **Download summary badge** | `.stremio-downloaded-summary-badge` | Emerald `#10b981` — `CloudStreamDeviceIcon` (14px) + N Episodes Downloaded + total size; shown when 1+ episodes are fully downloaded |

---

### Action Buttons Bar (`.stremio-actions-bar`)

Five action controls in a horizontal row below the meta row:

#### 1. Primary Play / Resume Button (`.stremio-action-play-btn`)

- **Icon**: `Play` (18px, filled white); switches to `CloudStreamDeviceIcon` (18px) when episode is offline-ready.
- **Label states**:
  - No history: `Play Movie` or `Play S1:E1`
  - In-progress: `Resume S1:E2 (12m left)` or `Resume Movie (34m left)`
  - Offline ready: appends `(Offline Ready)` or `Offline` suffix
- **Sub-element**: thin `.stremio-play-progress-bar` div at the button bottom edge showing resume percentage.
- **Disabled**: shows `Extracting...` while stream links are being fetched.

#### 2. Download Button (`.stremio-action-download-btn`)

| State | Icon | Label |
|---|---|---|
| Default (no downloads) | `Download` icon 17px | Download |
| Extracting | spinner | Extracting... |
| Queued | spinner | Queued! |
| Completed (`.completed` active) | `CloudStreamDeviceIcon` 17px, emerald `#10b981` | N Downloaded |

#### 3. Trailer Button (`.stremio-action-trailer-btn`)

- Icon: `Video` (17px).
- If `details.trailers` has entries: opens inline `<iframe>` overlay using `youtube-nocookie.com` embed with autoplay.
- If no trailers: opens YouTube search for `{title} official trailer` in a new tab.

#### 4. Watchlist / Library Button (`.stremio-action-circle-btn`)

- Icon: `Bookmark` (18px) — filled when a library entry exists, outline when not.
- Opens `.stremio-watchlist-popup` dropdown with five status options:

| Status | Dot Color |
|---|---|
| Watching | Blue `#60a5fa` |
| Plan to Watch | Amber `#fbbf24` |
| Completed | Emerald `#34d399` |
| On Hold | Violet `#a78bfa` |
| Dropped | Red `#f87171` |

- Selected option shows a `Check` checkmark (14px).
- "Remove from Library" (`X` icon, red) appears only when a status is active.

#### 5. Share Button (`.stremio-action-share-btn`)

- Icon: `Share2` (18px).
- Copies `item.url` to the system clipboard.

---

### Episode Card - Bottom Card Anatomy (Series / Anime Mode)

Each episode renders as a horizontal three-column card (`.stremio-episode-item`) in the right panel scrollable list. Clicking the card triggers playback.

```
+-------------------------------------------------------------------------+
| [Thumbnail 16:9  ] | Episode title                  | [Action Icon]    |
| [+ center overlay] | Synopsis / release date        | (24-26px icon)   |
+-------------------------------------------------------------------------+
```

#### Column 1 - Thumbnail (`.stremio-ep-thumb-wrapper`)

- 16:9 `<img>` (`.stremio-ep-thumb`): `ep.poster_url` falling back to `details.poster_url`.
- **Center overlay** (`.stremio-ep-thumb-overlay`): renders `WatchPlayProgress` (36px) or `.stremio-mini-spinner` during extraction.

##### WatchPlayProgress Component (36px, centered on thumbnail)

Shared circular SVG ring + inner icon indicating watch state, imported from `DownloadsScreen.tsx`:

| State | Inner Icon | Ring |
|---|---|---|
| Not watched (0%) | Play triangle, white | Hidden / faint |
| Partially watched (1-94%) | Play triangle, white | Cyan `#06b6d4` arc proportional to `percent` |
| Watched / Completed (95%+) | Checkmark, white | Full emerald `#10b981` ring |

- Clicking the ring/checkmark toggles watched state, persisting via `save_watch_progress` to SQLite.
- **This is the only watch-progress indicator per card** — no redundant bottom progress bar.

#### Column 2 - Episode Metadata (`.stremio-ep-meta`)

- **Title** (`.stremio-ep-title`): `{episodeNum}. {ep.name}` — truncated with ellipsis on overflow.
- **Sub-line**: synopsis (`.stremio-ep-desc`) or release date (`.stremio-ep-date`), whichever is available.

#### Column 3 - Download / Device Status Icon (`.stremio-ep-actions`)

The right-side action slot shows exactly **one** icon state. Icons are large (24-26px) for clear visibility:

| State | Component | Icon | Size | Color | On Click |
|---|---|---|---|---|---|
| **Not downloaded** | `.stremio-ep-download-btn` | `Download` (Lucide) | 24px | Muted white | Extract links & start download |
| **Extracting** | `.stremio-ep-download-btn` disabled | `.stremio-mini-spinner` | 16px | animated | Non-interactive |
| **Queued** | `.stremio-ep-download-btn` disabled | `Check` (Lucide) | 18px | Emerald `#10b981` | Non-interactive |
| **Downloading** | `.stremio-ep-download-clock` | `DownloadPieClock` | 26px | Cyan arc on dark circle | Non-interactive |
| **Paused** | `.stremio-ep-download-clock` | `DownloadPieClock` | 26px | Muted grey arc | Non-interactive |
| **Downloaded (offline ready)** | `.stremio-ep-download-btn.downloaded` | `CloudStreamDeviceIcon` | 26px | White on emerald bg | Play local file instantly |

---

### Shared Icon Components

#### `CloudStreamDeviceIcon`

Custom SVG defined in `DownloadsScreen.tsx` representing a stylized screen/device. Used as the offline-ready indicator throughout the app.

- **Props**: `size` (number, default 24), `color` (string, default white).
- **Sizes used**: 26px in episode cards, 17px in action bar download button, 14px in meta row badge, 18px in primary play button.

#### `DownloadPieClock`

SVG pie-clock animation defined in `DownloadsScreen.tsx`. Dark circular background with a colored arc representing download progress.

- **Props**: `pct` (0-100), `status` (`downloading` or `paused`), `size` (number).
- **Arc color**: Cyan `#06b6d4` when downloading; muted grey when paused.
- Rendered at **26px** in episode cards.

#### `WatchPlayProgress`

Shared circular progress ring defined in `DownloadsScreen.tsx`.

- **Props**: `percent` (0-100), `isWatched` (boolean), `onToggleWatched` (click handler), `size` (number).
- Renders SVG ring + inner play triangle or checkmark based on state.
- Clicking the checkmark area calls `handleToggleWatched` which persists to SQLite.

---

### Season & Episode Navigation (Series Mode Right Panel)

- **Season nav bar** (`.stremio-episodes-panel-header`): `ChevronLeft` Prev / season dropdown / `ChevronRight` Next.
- **Season dropdown** (`.season-select-dropdown`): lists all seasons; `Check` marks the active season; uses `season_names` for custom labels.
- **Anime Sub/Dub switcher** (`.stremio-anime-dub-bar`): pill buttons for Sub / Dub with episode count; shown only when both dub statuses exist.
- **Episode search** (`.stremio-videos-search-box`): filters by episode number or title; `X` clear button replaces the `Search` icon when query is non-empty.

---

### Trailer Overlay Modal

- Full-viewport semi-transparent backdrop (`.trailer-modal-overlay`); click outside to dismiss.
- Inner card (`.trailer-modal-content`) with `X` close button.
- YouTube links rendered as `<iframe>` using `youtube-nocookie.com` embed + autoplay.
- Direct video URLs rendered as `<video>` with native controls + autoplay.

---

### Offline Playback Logic

When an episode `DownloadItem.status === 'completed'` and `file_path` is set, the play action bypasses network extraction entirely. A synthetic `ExtractorLink` is constructed with `source: 'Offline'` pointing to the local file path. Files ending in `.m3u8` or `.ts` are automatically flagged `is_m3u8: true`.

Watch resume position is preserved across offline and online playback via the SQLite `watch_history` table, queried by `media_id` OR title (case-insensitive match).

---

### Background & Canvas Aesthetic Rules

- **Global Gradient Flow**: All views—including the Home Screen, Discover Hub, Plugins Screen, Main Downloads Grid, and Full-Screen Series Child View (`.downloads-child-screen`)—share the unified Stremio 41-degree fixed canvas gradient (`linear-gradient(41deg, #0C0B12 0%, #19173A 100%)`).
- **Seamless Page Containers**: Page root containers (`.downloads-page-container`, `.main-content`) maintain transparent backgrounds so the global gradient flows naturally without isolated colored patches or mismatched radial overlays.
- **Translucent Floating Elements**: Navigation bars and headers utilize transparent or ultra-subtle glassmorphism (`backdrop-filter: blur(16px)` with transparent or `rgba(255, 255, 255, 0.04)` fill) to keep the depth and canvas continuity intact.

