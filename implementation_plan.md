# CloudStream Desktop (Rust + Stremio Architecture) — Full Implementation Plan

Build a next-generation desktop streaming application combining the **Stremio-like smoothness, instant startup (<200ms), and GPU-accelerated video decoding** of Rust with **100% CloudStream feature parity** and **native CloudStream repository/plugin installation (`repo.json` & `.cs3` files)**.

---

## User Review Required

> [!IMPORTANT]
> **How CloudStream Plugin Installation Works in this Architecture:**  
> CloudStream plugins on GitHub are written in Kotlin and distributed as `.cs3` files (containing Dalvik/JVM bytecode). To achieve both **Stremio-level speed (Rust + libmpv)** and **100% compatibility with any CloudStream GitHub repository**, the app uses a dual-engine architecture:
> 1. **Rust Core (Tauri v2 + Tokio + libmpv)**: Handles the UI, GPU video playback, 120Hz scrolling, local M3U8 stream proxy, SQLite watch history, and download engine.
> 2. **Embedded Headless Plugin Runner**: A minimal, stripped-down headless Kotlin runtime (bundled via `jlink` so the user does NOT need Java installed). It executes `.cs3` plugins from any CloudStream repository (e.g. `repo.json`) and communicates with Rust via zero-latency local IPC (stdin/stdout or named pipes).
> 
> This delivers the best of both worlds: **pure Stremio smoothness on the desktop** while retaining **full access to the existing 100+ CloudStream community plugins**.

> [!TIP]
> **Video Playback Engine:**  
> We use native `libmpv` bindings (via C-FFI) with DirectX 11 / D3D11VA hardware acceleration. This matches Stremio's playback engine, enabling 4K 60fps HDR playback at <1% CPU usage with full styled ASS/SSA subtitle rendering.

---

## Proposed Project Structure

All code for the new desktop app will be placed in a dedicated root directory: `CloudStream-Desktop/` to keep the workspace clean and isolated.

```text
CloudStream-Desktop/
├── src-tauri/                         # Rust Core (Tauri v2 Backend)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs                    # Entry point, windowing & lifecycle
│       ├── engine/
│       │   ├── mod.rs
│       │   ├── models.rs              # MainAPI data contracts (TvType, LoadResponse, etc.)
│       │   └── manager.rs             # Multi-provider concurrent search & query coordinator
│       ├── plugins/
│       │   ├── mod.rs
│       │   ├── repository.rs          # repo.json parser, updater & manifest store
│       │   ├── installer.rs           # .cs3 downloader, unpacker & validator
│       │   └── runner_bridge.rs       # IPC bridge to the headless Kotlin plugin runner
│       ├── proxy/
│       │   ├── mod.rs
│       │   ├── server.rs              # Local Axum/Hyper proxy on 127.0.0.1
│       │   └── m3u8_rewriter.rs       # Playlist parser, segment rewriter & header injector
│       ├── player/
│       │   ├── mod.rs
│       │   ├── mpv_core.rs            # Native libmpv FFI bindings & D3D11VA GPU context
│       │   ├── auto_failover.rs       # Mirror fallback on broken links
│       │   └── track_manager.rs       # Audio & ASS/SSA subtitle switcher
│       ├── videoskip/
│       │   ├── mod.rs
│       │   ├── aniskip.rs             # AniSkip API client (auto-skip OP/ED/recaps)
│       │   └── theintrodb.rs          # TheIntroDB client for TV shows
│       ├── subtitles/
│       │   ├── mod.rs
│       │   ├── opensubtitles.rs       # OpenSubtitles REST v3 & SubDL client
│       │   └── offset.rs              # Real-time ±50ms delay adjustment
│       ├── sync/
│       │   ├── mod.rs
│       │   ├── anilist.rs             # AniList OAuth2 scrobbler
│       │   ├── mal.rs                 # MyAnimeList REST v2
│       │   └── trakt.rs               # Trakt.tv scrobbler
│       ├── downloads/
│       │   ├── mod.rs
│       │   ├── queue.rs               # Multi-connection HLS & MP4 downloader
│       │   └── muxer.rs               # Segment muxer into .mp4/.mkv
│       ├── cast/
│       │   ├── mod.rs
│       │   ├── fcast.rs               # FCast protocol implementation (TCP/WebSocket)
│       │   └── chromecast.rs          # Google Cast mDNS discovery
│       └── storage/
│           ├── mod.rs
│           └── database.rs            # SQLite connection pool (history, watchlist, profiles)
│
├── plugin-runner/                     # Headless Plugin Runner (Kotlin/JVM)
│   ├── build.gradle.kts
│   └── src/main/kotlin/
│       └── RunnerMain.kt              # Headless CLI that loads .cs3 files and answers IPC JSON
│
└── src/                               # Stremio-Grade Frontend (React + Vite + Tailwind CSS)
    ├── index.html
    ├── package.json
    ├── src/
    │   ├── components/
    │   │   ├── NavigationSidebar.tsx  # 64px compact Win11/Stremio sidebar
    │   │   ├── HeroBanner.tsx         # Backdrop trailer/poster carousel
    │   │   ├── MediaShelf.tsx         # Virtualized 60/120 FPS horizontal carousel
    │   │   ├── MediaCard.tsx          # Card with dub/sub indicators, score & progress
    │   │   ├── DetailModal.tsx        # Season/Episode drawer, cast, trailers & recommendations
    │   │   └── PlayerOverlay.tsx      # Auto-hiding HUD, scrub preview, skip intro pill
    │   ├── screens/
    │   │   ├── HomeScreen.tsx         # Featured, Continue Watching, Shelves
    │   │   ├── DiscoverScreen.tsx     # Filter by TvType, Genre, Year, Provider
    │   │   ├── SearchScreen.tsx       # Real-time multi-provider search with debounce
    │   │   ├── LibraryScreen.tsx      # Bookmarks, Plan to Watch, History, Custom Lists
    │   │   ├── PluginsScreen.tsx      # Repository manager & 1-click .cs3 plugin installer
    │   │   ├── DownloadsScreen.tsx    # Active downloads queue & offline library
    │   │   └── SettingsScreen.tsx     # Player settings, DoH, Sync accounts, Profiles
    │   └── stores/                    # Zustand/Signals state management
    └── styles/
        └── index.css                  # Cinema dark theme (`#0B0F19`, `#121829`), fluid transitions
```

---

## Step-by-Step Implementation Phases

### Phase 1: Foundation & Scaffolding
- [ ] Initialize the Tauri v2 + Rust project in `CloudStream-Desktop/`.
- [ ] Set up `Cargo.toml` with `tokio`, `serde`, `serde_json`, `reqwest`, `rusqlite`, `axum`, `libmpv-sys`.
- [ ] Set up the React + Vite + Tailwind frontend shell with dark cinema styling.
- [ ] Set up SQLite schema for `watch_history`, `watchlist`, `repositories`, `installed_plugins`, and `app_settings`.

### Phase 2: Plugin System (`repo.json` & `.cs3` Installation)
- [ ] Build the **Repository Manager** in Rust:
  - Add/remove/sync GitHub repository URLs (e.g. `nehal-CloudStream/repo.json`).
  - Parse manifest lists, version checks, and changelogs.
- [ ] Build the **Plugin Downloader**:
  - Downloads `.cs3` files from GitHub releases/raw links.
  - Verifies hashes and extracts `plugin.json` metadata.
- [ ] Build the **Headless Plugin Runner** (`plugin-runner/`):
  - Uses `cloudstream/library` to load `.cs3` bytecode into memory.
  - Implements lightweight JSON-RPC over standard input/output for `search()`, `load()`, and `loadLinks()`.
  - Rust IPC bridge to communicate with sub-millisecond overhead.

### Phase 3: Local M3U8 Stream Proxy & Extractor Engine
- [ ] Implement the local HTTP proxy using Axum on `127.0.0.1:auto`.
- [ ] Implement M3U8 playlist parsing and dynamic segment rewriting.
- [ ] Forward video segments with injected headers (`Referer`, `User-Agent`, `Origin`, `Cookie`).
- [ ] Implement DNS-over-HTTPS (DoH) resolver and optional SSL verification bypass for BDIX FTP servers.

### Phase 4: Hardware-Accelerated Video Playback (Stremio Experience)
- [ ] Integrate `libmpv` native bindings for zero-copy D3D11VA GPU decoding.
- [ ] Support full ASS/SSA styling, multi-audio selection, and embedded subtitle demuxing.
- [ ] Implement **Auto-Failover**: seamless switch to the next mirror if a stream fails or buffers excessively.
- [ ] Implement **Auto-Play Next Episode**: triggers automatic link extraction when $< 2.5\text{s}$ remains.

### Phase 5: Cinema Frontend (Stremio-Grade UI)
- [ ] Build the virtualized catalog grids and horizontal shelves for fluid 60–120 FPS scrolling.
- [ ] Build the multi-provider concurrent search interface with live results streaming.
- [ ] Build the Media Detail view: season tabs, episode grid with progress bars, cast photos, and recommendations.
- [ ] Build the custom Player HUD with timeline scrub preview, subtitle delay offset slider, and audio track switcher.
- [ ] Bind all global keyboard shortcuts (`Space`, `J/L`, `Arrows`, `F11`, `C`, `M`, `Escape`).

### Phase 6: CloudStream Ecosystem Integrations
- [ ] **AniSkip & TheIntroDB**: Auto-detect openings/endings and show "Skip Intro" button.
- [ ] **Sync Services**: AniList GraphQL, MyAnimeList v2, Kitsu, and Trakt.tv scrobbling.
- [ ] **Subtitles**: OpenSubtitles REST v3 and SubDL automatic search.
- [ ] **Download Engine**: Multi-connection chunked and segmented HLS downloader.
- [ ] **Casting**: FCast protocol over TCP/WebSocket.

---

## Verification Plan

### Automated Tests
1. **Repository & Manifest Parser**: Test parsing `repo.json` from sample CloudStream repos.
2. **Plugin Extraction**: Test extracting and validating `.cs3` ZIP packages.
3. **M3U8 Stream Proxy**: Test header rewriting and segment forwarding against protected HLS test streams.
4. **SQLite Storage**: Test write/read operations for watch progress, bookmarks, and settings.

### Manual Verification
1. **Plugin Installation**:
   - Add the user's repository (`nehal-CloudStream/repo.json`).
   - Install a provider (e.g. NetMirror, Aniwatch, or BDIX FTP).
   - Verify it appears in the installed plugins list with version and metadata.
2. **Catalog & Search**:
   - Search for a movie or TV show across installed providers.
   - Verify parallel search results arrive in under 400ms without UI stutter.
3. **Playback & Performance**:
   - Play a 1080p / 4K stream with `libmpv`.
   - Verify GPU decoding is active (CPU usage < 2%, RAM < 90 MB).
   - Verify HLS segments load with zero 403 Forbidden errors.
4. **Subtitle & AniSkip**:
   - Test subtitle track selection and $\pm 50\text{ms}$ delay offset adjustment.
   - Test anime playback with AniSkip intro detection and "Skip Intro" pill.
5. **Watch Progress**:
   - Close the app halfway through an episode and reopen.
   - Verify "Continue Watching" shelf accurately resumes playback to the exact second.
