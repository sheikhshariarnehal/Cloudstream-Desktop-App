# CloudStream Desktop (Rust Edition)

> **High-Performance Stremio-Smooth Native Desktop Streaming Application for CloudStream**  
> Built with **Rust (Tokio, Reqwest, Axum)**, **Tauri v2**, and a **Stremio-Grade React/TypeScript Cinema UI**.

---

## 🌟 Highlights & Parity with CloudStream Android

- ⚡ **Sub-200ms Cold Launch**: Native Rust backend with embedded SQLite persistence.
- 🎯 **Low Memory Footprint**: Runs at ~50–80 MB RAM (no JVM overhead).
- 🔌 **CloudStream Repository & Plugin Installation**:
  - Add any CloudStream repository URL (e.g. `repo.json`).
  - 1-click install and execute `.cs3` plugins directly from GitHub.
- 🚀 **Built-in Native Providers**:
  - **NetMirror**: Multi-mirror streaming for Hollywood and global films.
  - **Aniwatch**: Anime catalog with subbed/dubbed episodes.
  - **BDIX Gigabit FTPs**: High-speed gigabit streams from CircleFTP, SamOnline, and DiscoveryFTP.
- 🛡️ **Local High-Performance M3U8 Stream Proxy**:
  - Automatically runs on `127.0.0.1`.
  - Injects `Referer`, `User-Agent`, and `Origin` headers into all `.m3u8` playlists and `.ts` video chunks to completely bypass 403 Forbidden CDN blocks.
- ⏩ **AniSkip & Video Intro/Outro Automation**:
  - Automatically queries AniSkip intervals and displays a 1-click "Skip Opening" / "Skip Ending" button.
- 💬 **Multi-Language Subtitles**:
  - Automatic subtitle search across OpenSubtitles and Subsource.
- 🔖 **Watch Progress & Resume**:
  - Embedded SQLite database records playback progress and populates the "Continue Watching" shelf.

---

## ⌨️ Global Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| **`Space`** / **`K`** | Play / Pause |
| **`Left`** / **`J`** | Rewind 10 seconds |
| **`Right`** / **`L`** | Fast-forward 10 seconds |
| **`Up`** / **`Down`** | Volume $\pm 10\%$ |
| **`M`** | Mute / Unmute audio |
| **`F`** / **`F11`** | Toggle Fullscreen Mode |
| **`Escape`** | Exit player / Close modal |
| **`Alt + 1..5`** | Navigate tabs (Home, Search, Library, Plugins, Settings) |

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+ and npm
- Rust toolchain (`cargo`, `rustc`)

### Start Development Server
```bash
cd CloudStream-Desktop

# Set Cargo on PATH (if not globally present)
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH

# Run Tauri development app
npm run tauri dev
```

### Build Production Bundle (.exe / .msi)
```bash
npm run tauri build
```
