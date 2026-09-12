# CloudStream Desktop (Rust Edition) — Master Knowledge Architecture & System Specification

> **Source Analysis**: Extracted from [`cloudstream`](file:///d:/Poject/CloudStream/cloudstream) via [`graphify-out`](file:///d:/Poject/CloudStream/cloudstream/graphify-out) (6,412 nodes, 15,458 edges, 284 functional communities).  
> **Target Vision**: A high-performance, Stremio-smooth, 60–120 FPS native desktop streaming app powered by **Rust** (Tokio, reqwest, libmpv) and **Tauri v2** with zero feature loss from the Android application.

---

## 1. System Topology & Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               TAURI V2 DESKTOP APPLICATION                              │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     FRONTEND: Stremio-Grade Cinema UI                             │  │
│  │  - Tech: Svelte / React + Tailwind CSS + Lucide Icons                             │  │
│  │  - Virtualized 60/120 FPS Poster Grids & Shelves (zero DOM thrashing)             │  │
│  │  - Hero Backdrop Carousels, Season/Episode Pickers, Realtime Subtitle Preview    │  │
│  │  - Global Keyboard & Gamepad/Remote Navigation (`Space`, `J/L`, `F11`, `Arrows`)  │  │
│  └──────────────────────────────────────────▲────────────────────────────────────────┘  │
│                                             │ IPC Commands & Event Stream (Zero-Copy)   │
│  ┌──────────────────────────────────────────▼────────────────────────────────────────┐  │
│  │                      BACKEND: Rust High-Concurrency Engine                         │  │
│  │                                                                                   │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────┐ │  │
│  │  │     Provider Engine     │  │   Extractor Pipeline    │  │  M3U8 Stream Proxy │ │  │
│  │  │  - MainApi Trait        │  │  - 70+ Decryptors       │  │  - Header Rewriter │ │  │
│  │  │  - Concurrent Fan-out   │  │  - QuickJS / AES-CBC    │  │  - Port 127.0.0.1  │ │  │
│  │  │  - Repo & Manifest Mgr  │  │  - JsUnpacker / Pack    │  │  - CORS & 403 Fix  │ │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  └────────────────────┘ │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────┐ │  │
│  │  │   Video Playback Core   │  │   Sync & Metadata Hub   │  │ Download & Storage │ │  │
│  │  │  - Native `libmpv` FFI  │  │  - AniList / MAL / Trakt│  │  - Multi-HLS Queue │ │  │
│  │  │  - Hardware D3D11VA     │  │  - AniSkip / IntroDB    │  │  - SQLite Database │ │  │
│  │  │  - ASS Subtitle Render  │  │  - Subtitle Multi-Fetch │  │  - Watch History   │ │  │
│  │  └─────────────────────────┘  └─────────────────────────┘  └────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Media Data Models (`MainAPI` Parity)

Mapped directly from `cloudstream/library/src/commonMain/kotlin/com/lagradost/cloudstream3/MainAPI.kt`:

### 2.1 Media Classification (`TvType`)
Every media item belongs to a strictly typed classification:
* `Movie`: Single-part film with runtime, director, cast.
* `TvSeries`: Multi-season, multi-episode episodic content.
* `Anime`: Episodic Japanese animation with Subbed/Dubbed status.
* `AnimeMovie`: Single-part anime feature.
* `AsianDrama`: K-Drama/C-Drama format with episode indexers.
* `Cartoon`: Western animated series.
* `Documentary`: Factual content.
* `LiveStream`: Continuous live IPTV/M3U8 feed with timeline.
* `Torrent`: P2P-sourced media stream.
* `NSFW`: Adult content (safeguarded by app-level toggle).

### 2.2 Search & Home Responses
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub name: String,
    pub url: String,
    pub api_name: String,
    pub tv_type: TvType,
    pub poster_url: Option<String>,
    pub year: Option<i32>,
    pub score: Option<f64>,
    pub dub_status: Option<DubStatus>, // Subbed, Dubbed, Both
    pub latest_episode: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomePageList {
    pub name: String,
    pub list: Vec<SearchResponse>,
    pub is_horizontal: bool,
}
```

### 2.3 Detailed Media Metadata (`LoadResponse`)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub name: Option<String>,
    pub season: Option<i32>,
    pub episode: i32,
    pub data: String, // Url or JSON payload passed to load_links()
    pub poster_url: Option<String>,
    pub rating: Option<f64>,
    pub description: Option<String>,
    pub release_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadResponse {
    pub name: String,
    pub url: String,
    pub api_name: String,
    pub tv_type: TvType,
    pub poster_url: Option<String>,
    pub background_poster_url: Option<String>,
    pub plot: Option<String>,
    pub year: Option<i32>,
    pub duration_minutes: Option<i32>,
    pub tags: Vec<String>,
    pub cast: Vec<Actor>,
    pub episodes: Vec<Episode>,
    pub recommendations: Vec<SearchResponse>,
    pub trailers: Vec<TrailerData>,
    pub sync_ids: HashMap<String, String>, // imdb, tmdb, mal, anilist
}
```

### 2.4 Extractor Links & Subtitles
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractorLink {
    pub source: String,           // e.g. "Server 1", "MegaCloud"
    pub name: String,             // Display label
    pub url: String,              // Playable URL (.m3u8, .mp4)
    pub referer: String,          // Required Referer header
    pub quality: QualityProfile,   // 360p, 480p, 720p, 1080p, 4K
    pub is_m3u8: bool,
    pub is_dash: bool,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleData {
    pub url: String,
    pub language: String,         // e.g. "English", "Bengali"
    pub ietf_tag: String,         // e.g. "en-US", "bn-BD"
    pub origin: SubtitleOrigin,   // Embedded, ExternalUrl, DownloadedFile
    pub format: SubtitleFormat,   // Vtt, Srt, Ass
}
```

---

## 3. Provider & Repository Architecture

### 3.1 The `MainApi` Trait
Every provider implements this asynchronous contract in Rust:
```rust
#[async_trait]
pub trait MainApi: Send + Sync {
    fn name(&self) -> &str;
    fn main_url(&self) -> &str;
    fn supported_types(&self) -> &[TvType];
    fn lang(&self) -> &str; // Language code (e.g. "en", "bn", "hi")

    async fn get_main_page(&self) -> Result<Vec<HomePageList>>;
    async fn search(&self, query: &str) -> Result<Vec<SearchResponse>>;
    async fn load(&self, url: &str) -> Result<LoadResponse>;
    async fn load_links(
        &self, 
        data: &str, 
        link_tx: mpsc::Sender<ExtractorLink>, 
        sub_tx: mpsc::Sender<SubtitleData>
    ) -> Result<()>;
}
```

### 3.2 Dynamic Repository & Plugin Manager
* **Repository Schema**: Reads `repo.json` / `plugins.json` containing manifests (URL, version, author, description, icon).
* **Multi-Provider Search Pipeline**:
  - Searches 10–30 providers concurrently using `tokio::spawn`.
  - Emits real-time streams to the UI so users see instant results without waiting for the slowest provider.
  - Implements fuzzy deduplication via Levenshtein distance (`Levenshtein.kt` in CloudStream).
* **Scripted & WASM Extensions**:
  - Community extensions run in an embedded sandboxed JS runtime (**QuickJS**) or compiled **WASM** modules.
  - Providers written in TypeScript expose `search()`, `load()`, and `loadLinks()`, mimicking CloudStream APIs.

---

## 4. Extractor Pipeline & Anti-Obfuscation

Extracted from 70+ classes in `cloudstream/library/.../extractors/`:

| Extractor | Encryption / Technique | Solution in Rust |
| :--- | :--- | :--- |
| **Rabbitstream / MegaCloud** | AES-CBC with dynamic key extraction from external scripts | Pure Rust `aes` + `cipher` crates with regex key scraper |
| **StreamTape / ShaveTape** | Hidden token injection in DOM comment / innerHTML string | High-speed regex parser + token concatenation |
| **Voe / VoeNetwork** | Base64 reversed string + rot13 cipher | Zero-allocation byte manipulations |
| **Doodstream (D0000d)** | Random MD5 hash token generated with token url redirect | Dynamic timestamp token builder |
| **LuluStream / VidHide** | Packer obfuscation (`eval(function(p,a,c,k,e,d)...)`) | Native `JsUnpacker` algorithm implemented in Rust |
| **FileMoon / MixDrop** | JS packer + unpacked packed script redirection | Native unpacker regex loop |
| **Gofile / PixelDrain** | Direct REST API with Bearer token authentication | Async `reqwest` JSON client |

### Core Decryption Utilities in Rust:
1. **`JsUnpacker`**: Pure Rust implementation of Dean Edwards' packer algorithm to de-obfuscate packed scripts in sub-millisecond time.
2. **`JsHunter`**: Automated string-slice unpacker for obfuscated video links.
3. **`CryptoHelper`**: AES-CBC, AES-GCM, PBKDF2, and MD5 hashing tools.

---

## 5. Network, Anti-Bot & Stream Proxy

### 5.1 Local M3U8 Stream Proxy (`127.0.0.1:PORT`)
Browsers and native players fail to play protected streams because video CDNs verify:
1. `Referer` header matching the embedder.
2. `User-Agent` matching desktop Chrome.
3. CORS headers.

**Rust Proxy Engine (using Axum / Hyper)**:
* Rewrites `.m3u8` playlist files on the fly.
* Replaces remote segment URLs with `http://127.0.0.1:PORT/proxy/segment?url=ENCODED_URL&headers=ENCODED_HEADERS`.
* When player fetches the segment, Rust forwards the request with full header injection.
* Strips all CORS restrictions, guaranteeing 100% playback success.

### 5.2 Anti-Bot & DNS Bypasses
* **DNS over HTTPS (DoH)**: Built-in DoH client (`Cloudflare`, `Google`, `AdGuard`, `Quad9`) to circumvent ISP domain blocking.
* **Cloudflare Turnstile / Challenge Solver**: Uses Tauri's background Webview window to solve challenges transparently and export clearance cookies (`cf_clearance`).
* **Insecure SSL Bypass**: Optional toggle for local BDIX FTP servers running expired or self-signed certificates (`SSLTrustManager.kt`).

---

## 6. Video Playback Core (Stremio Performance)

### 6.1 `libmpv` Hardware-Accelerated Pipeline
Instead of heavy Java/VLC wrappers, Rust binds directly to `libmpv`:
* **Zero CPU Decoding**: Hardware acceleration via **DirectX 11 (D3D11VA)** and **Nvidia NVDEC**.
* **Direct Surface Rendering**: Video frames render directly into the desktop window with zero frame copies.
* **Full Subtitle Styling**: Native rendering of SSA/ASS complex styled subtitles, karaoke effects, and custom fonts.
* **Precise Scrubbing**: Keyframe-accurate seeking with zero audio de-sync.

### 6.2 Playback Automation
* **Auto-Play Next Episode**: Automatically triggers extraction and playback of next episode when `(duration - position) < 2500ms`.
* **Auto-Failover**: If a stream link dies or returns an error, player automatically tries the next mirror in the sorted list.
* **Source Quality Priority**: User-configurable profiles (e.g. `Prefer 1080p > 4K > 720p > Auto`).

---

## 7. Video Skip & Intro Automation

Direct parity with CloudStream's `utils/videoskip/`:
1. **AniSkip Integration**: Automatic detection of Anime Openings (OP), Endings (ED), and Recaps via AniSkip API.
2. **TheIntroDB & IntroDbSkip**: Intro timestamps for mainstream TV shows.
3. **Player Overlay**: "Skip Intro" / "Skip Ending" button appears on-screen; auto-skip toggle allows zero-click skipping.
4. **Filler Episode Detector**: Highlights filler episodes in the UI using anime filler database mappings.

---

## 8. Subtitles & Multi-Language Engine

* **Multi-Source Fetcher**:
  - Automatic lookup from OpenSubtitles REST API v3, SubDL, and Subsource.
  - Extraction of embedded subtitle tracks from MKV/MP4 containers via `libmpv`.
* **Realtime Offset Sync**: Subtitle delay slider in 50ms increments (`SubtitleOffsetItemAdapter.kt`).
* **Custom Styling**: Font selection, size, text color, outline thickness, and background scrim opacity.

---

## 9. Tracking & Metadata Sync

* **Supported Services**:
  - **AniList**: OAuth2 sync, auto-updates watch status at 80% progress, score and notes.
  - **MyAnimeList (MAL)**: v2 REST API integration.
  - **Kitsu**: Anime and manga catalog sync.
  - **Trakt.tv**: Scrobbler for Western movies and TV shows.
  - **TMDB & SIMKL**: Metadata enrichment (cast portraits, trailers, high-res posters).

---

## 10. Download Engine & Offline Queue

* **HLS `.m3u8` Segmented Downloader**:
  - Multi-threaded concurrent segment fetching with rate limiting.
  - Multiplexes downloaded segments into a clean `.mp4` file.
* **Direct Stream Downloader**: Chunked downloading for direct `.mp4` links with pause/resume support.
* **Queue Management**: Pause all, resume all, background task persistence, and failure auto-retry.

---

## 11. Casting (FCast & Chromecast)

* **FCast Protocol (`actions/temp/fcast/`)**:
  - Open-source casting protocol over TCP/WebSocket.
  - Streams directly to FCast receivers on FireTV, Android TV, and Linux media centers with play/pause/seek sync.
* **Google Cast (Chromecast)**: Discovers local Chromecasts via mDNS and launches stream sessions.

---

## 12. Local Storage & Database Schema (SQLite)

Local database powered by `rusqlite` / `sqlx`:
* `watch_history (id, media_id, provider_id, episode_num, season_num, position_ms, duration_ms, updated_at)`
* `watchlist (media_id, provider_id, title, poster_url, status, score, added_at)`
* `repositories (url, name, icon, auto_update, last_synced)`
* `installed_plugins (id, repo_url, name, version, is_enabled, settings_json)`
* `app_settings (key, value_json)`
* `user_profiles (id, name, avatar_url, is_kids)`

---

## 13. UI/UX Specification (Stremio-Grade Modern Cinema)

* **Navigation**: Modern 64px compact sidebar (Home, Discover, Search, Library, Downloads, Extensions, Settings).
* **Catalog Grid**: Virtualized CSS Grid with hardware-accelerated transforms for zero-jank 120Hz scrolling.
* **Hero Banner**: Auto-rotating feature banners with background trailer video or high-res backdrop gradient.
* **Detail Modal**: Season/Episode horizontal bar, episode thumbnail cards with watch progress indicators, cast carousel.
* **Player Overlay**:
  - Auto-hiding HUD with backdrop vignette.
  - Floating source switcher (showing bitrate, server, and resolution).
  - Subtitle track picker with live preview.
  - Keybinds: `Space` (pause), `J`/`L` (seek 10s), `Up`/`Down` (volume), `F` (fullscreen), `M` (mute), `C` (subtitles toggle).

---

## 14. Execution Roadmap

| Phase | Milestone | Deliverable |
| :---: | :--- | :--- |
| **Phase 1** | **Rust Project Scaffolding** | Tauri v2 + Rust workspace setup, Tokio async engine, SQLite schema |
| **Phase 2** | **Core Engine & M3U8 Proxy** | `MainApi` trait, `ExtractorApi` trait, local M3U8 stream rewriter proxy |
| **Phase 3** | **Video Player Core** | `libmpv` integration, hardware decoding, subtitle renderer, keyboard shortcuts |
| **Phase 4** | **Initial Core Providers** | Scrapers for NetMirror, VegaMovies, Aniwatch, and BDIX FTPs |
| **Phase 5** | **Stremio-Grade UI** | Virtualized catalog shelves, search engine, media detail view, player HUD |
| **Phase 6** | **Sync & Advanced Features** | AniSkip, AniList/Trakt sync, HLS download engine, FCast protocol |
