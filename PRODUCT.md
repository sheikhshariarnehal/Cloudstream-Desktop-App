# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desktop media streamers, movie, anime, and series enthusiasts, and CloudStream users who want a lightweight, snappy, native desktop streaming experience without Android emulation or heavy JVM overhead.

## Product Purpose

Deliver a high-performance, Stremio-grade native desktop streaming application powered by Rust (Tauri v2) and React 19 / TypeScript. It enables users to browse, search, stream, and manage media from CloudStream repositories, `.cs3` plugins, and built-in scrapers with sub-200ms cold launches, embedded SQLite persistence, and local M3U8 CDN bypass proxying.

## Positioning

The only native desktop streaming client with direct CloudStream repository and `.cs3` plugin compatibility, sub-80MB memory footprint, built-in M3U8 anti-403 header injection proxy, and automated AniSkip intro/outro skipping.

## Operating Context

Desktop entertainment workflows across Windows, macOS, and Linux. Keyboard-driven navigation (`Alt+1..5`, `Space`, `J/K/L`, `F11`), full-screen cinema viewing, multi-source aggregated searching, repository plugin management, and playback resume tracking.

## Capabilities and Constraints

- **Capabilities**:
  - Tauri v2 + Rust backend (Axum local proxy, Reqwest, Tokio, SQLite embedded).
  - CloudStream repo & `.cs3` plugin installer and manifest engine.
  - Multi-source parallel search with extension icon attribution and real-time status.
  - Native providers (NetMirror, Aniwatch, BDIX gigabit FTPs).
  - Local M3U8 chunk proxy (`127.0.0.1`) injecting referer/user-agent headers to bypass 403 Forbidden CDN blocks.
  - Video player with HLS streaming, AniSkip intro/outro integration, multi-language subtitles, and watch history/progress tracking.
- **Constraints**:
  - Webview-based UI rendered in Tauri v2 (Chromium / WebView2).
  - Must remain sub-80MB RAM and maintain smooth 60fps animations and transitions.

## Brand Commitments

- Name: CloudStream Desktop (Rust Edition)
- Aesthetic: Dark cinema-grade glassmorphism, glowing cyan/purple/emerald accents, ultra-smooth micro-interactions, high information density, and Stremio/CloudStream UI familiarity.

## Evidence on Hand

- Rust backend in `src-tauri/src/` (`lib.rs`, `database.rs`, `plugins.rs`, `proxy.rs`, `extractors/`).
- Frontend React UI in `src/` (`App.tsx`, `App.css`, `components/`, `types/`).
- Architecture guides: `cloudstream_rust_desktop_architecture.md`, `search_page_architecture_and_implementation_guide.md`.

## Product Principles

1. **Instantaneous & Lightweight**: Sub-200ms startup, instant UI feedback, and zero bloat or JVM overhead.
2. **Ecosystem Parity**: Native compatibility with CloudStream Android plugins, repositories, and media models.
3. **Immersive Cinema Experience**: Dark glassmorphic visual hierarchy that elevates poster art and media content without visual clutter.
4. **Resilient Streaming**: Transparent local proxying to ensure stream links work seamlessly without CDN blockades.
5. **Keyboard-First Fluidity**: Full desktop keyboard navigation and shortcuts for player and browsing controls.

## Accessibility & Inclusion

- High contrast dark mode UI with readable typography hierarchy.
- Comprehensive keyboard navigation and screen-safe media controls.
