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
- **Constraints**:
  - Self-contained vanilla web stack within `installer/index.html` (single file or cleanly co-located assets) with no mandatory build or bundler steps.
  - Fully responsive across mobile (320px+), tablet, and desktop (1440px+).
  - Ad-free, tracker-free, privacy-respecting client-side execution.

## Brand Commitments

- **Name**: CloudStream Ecosystem (CloudStream Desktop · Rust Edition & CloudStream Mobile)
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
3. **Transparent Performance Superiority**: Let the numbers speak—highlight sub-200ms cold startup, 60MB RAM footprint, and native Rust reliability over bloated alternatives.
4. **Frictionless Mobile & TV Sideloading**: Provide prominent QR codes and step-by-step setup guides to make Android and Android TV installation seamless.
5. **Privacy & Open Source Truth**: Emphasize free forever, zero telemetry, GPL/Apache open-source integrity, and direct GitHub releases.

## Accessibility & Inclusion

- High-contrast text exceeding WCAG 2.1 AA standards on dark canvas backgrounds.
- Full keyboard navigability (`Tab`, `Enter`, `Space`, `Escape` for modals).
- Screen-reader friendly semantic structure (`h1`-`h3`, ARIA labels, descriptive image alt tags).
