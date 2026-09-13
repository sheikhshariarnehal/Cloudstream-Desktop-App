---
name: CloudStream Desktop
description: Cinema-grade native desktop streaming application and modular extension hub for CloudStream ecosystem
colors:
  primary: "#7c3aed"
  primary-light: "#9d72ff"
  primary-hover: "#6d28d9"
  bg-dark: "#0c0b12"
  bg-secondary: "#19173a"
  bg-surface: "#141228"
  bg-card: "rgba(255, 255, 255, 0.035)"
  bg-card-hover: "rgba(255, 255, 255, 0.07)"
  bg-pill-active: "#201b3b"
  accent-cyan: "#06b6d4"
  accent-emerald: "#10b981"
  accent-amber: "#f59e0b"
  accent-rose: "#f43f5e"
  text-main: "#ffffff"
  text-muted: "#8e89b4"
  text-subtle: "#7d789e"
  text-dim: "#555175"
  border-subtle: "rgba(255, 255, 255, 0.04)"
typography:
  display:
    fontFamily: "Outfit, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  headline:
    fontFamily: "Outfit, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.2px"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.3px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.full}"
    padding: "8px 18px"
    fontWeight: 700
  button-pill:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.text-subtle}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  button-pill-active:
    backgroundColor: "{colors.bg-pill-active}"
    textColor: "{colors.text-main}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
    fontWeight: 700
  card-extension:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.text-main}"
    border: "none"
    rounded: "{rounded.lg}"
    padding: "16px 18px"
---

# Design System: CloudStream Desktop

## Overview

**Creative North Star: "The Stremio-Smooth Cinema Engine"**

CloudStream Desktop delivers a dark, immersive, high-performance streaming environment engineered specifically for desktop screens. The interface recedes smoothly into deep void backgrounds (`#0C0B12` to `#19173A`), allowing cinematic poster artwork, high-resolution media banners, and video playback to take primary focus.

The visual architecture is anchored in minimal Stremio-grade elegance: translucent glassmorphic surfaces, borderless subtle controls, crisp typography, and refined micro-interactions. Chrome elements avoid thick borders, neon visual noise, and bulky containers in favor of effortless scanning and fluid keyboard navigation.

**Key Characteristics:**
- Deep 41° gradient background from obsidian `#0C0B12` to night violet `#19173A`.
- Minimal borderless navigation arrows, action links, and segmented view toggles.
- Two-column split layout for settings and extensions with a persistent sticky navigation sidebar.
- Glassmorphic category pills with balanced padding and subtle dark violet active states (`#201b3b`).
- Horizontally centered dark poster badges and semantic metadata tags.
- Sub-80MB memory performance with 60fps smooth animations and transitions.

---

## Colors

The palette uses deep dark tones with purposeful purple accents and semantic status highlights.

### Primary & Accents
- **Stremio Electric Purple** (`#7c3aed`): Primary brand accent for active states, playback buttons, and selected controls.
- **Electric Violet Light** (`#9d72ff`): Secondary accent for focus rings and subtle hover highlights.
- **Deep Violet Hover** (`#6d28d9`): Interaction state for primary buttons.
- **Active Pill Violet** (`#201b3b`): Stremio signature background for active navigation pills.

### Status & Indicators
- **Sky Cyan** (`#06b6d4`): Media status indicators and player progress accents.
- **Emerald Green** (`#10b981` / `#34d399`): Installed extension indicators, operational status dots, and DUB audio status pills.
- **Amber Gold** (`#f59e0b` / `#fbbf24`): Rating stars, file size highlights, and sideload accents.
- **Crimson Rose** (`#f43f5e` / `#fb7185`): Destructive actions, uninstall buttons, and down provider indicators.

### Neutral
- **Obsidian Black** (`#0c0b12`): Deepest viewport background canvas.
- **Midnight Indigo** (`#19173a`): Ambient gradient background highlight.
- **Surface Violet** (`#141228` / `#16132f`): Card backdrops and floating modal containers.
- **Text Main** (`#ffffff`): Primary headings, active navigation text, and poster titles.
- **Text Muted** (`#8e89b4`): Secondary metadata, category labels, and subtitles.
- **Text Subtle** (`#7d789e`): Inactive navigation items, descriptions, and section hints.
- **Text Dim** (`#555175`): Inactive icons, timestamps, and subtle counts.

---

## Architectural Rules

### 1. The Borderless Card Rule (No-Rim Rule)
- Extension cards, repository cards, and preset containers must **never** use visible border outlines, harsh white rims, or separator lines.
- Card surfaces rest on a clean, dark translucent layer: `rgba(255, 255, 255, 0.035)` on idle and smoothly lift to `rgba(255, 255, 255, 0.07)` on hover.
- Internal dividers inside cards (e.g. between content and action buttons) are omitted in favor of clean whitespace (`padding-top: 10px`).

### 2. The Sticky Sidebar Navigation Rule
- Split-layout pages (such as the Extensions / Addons Manager) employ a fixed-width left navigation sidebar (`230px`).
- The sidebar is pinned firmly using `position: sticky; top: 0; height: calc(100vh - var(--header-h, 56px)); align-self: flex-start; overflow-y: auto;`.
- As the user scrolls through long lists of extensions or repositories on the right content panel, the left navigation sidebar remains fixed in place.
- If the sidebar contains more feeds/items than fit vertically, it scrolls independently with `scrollbar-width: none`.

### 3. The Modal Overlay Protocol
- Modals, dialogs, and detail sheets must be rendered with `position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 9999 !important;`.
- Backdrop uses deep dark translucent shading with heavy blur (`background: rgba(5, 5, 15, 0.8); backdrop-filter: blur(16px);`).
- Modal content containers are centered flex children with `max-width: 560px`–`600px`, `background: #16132f`, `border: none`, `border-radius: 20px`, and diffuse shadows (`box-shadow: 0 24px 70px rgba(0, 0, 0, 0.85)`).

---

## Typography

**Display Font:** Outfit (Google Fonts) with system sans-serif fallback  
**Body Font:** Inter with `-apple-system, BlinkMacSystemFont, sans-serif` fallback  

### Hierarchy
- **Display** (800 weight, 24px–26px, line-height 1.2): Main screen titles (`Discover Extensions`, `Repository Sources`).
- **Headline** (600–700 weight, 20px–21px, line-height 1.25): Shelf titles and modal headings.
- **Title** (600–700 weight, 13.5px–14px, line-height 1.35): Extension card titles and poster titles.
- **Body** (400–500 weight, 12.5px–13px, line-height 1.5): Descriptive text, provider notes, and search feedback.
- **Label / Tag** (600–700 weight, 10px–11px, letter-spacing 0.3px): Language badges, category tags, and status pills.

---

## Layout & Spatial System

- **Sidebar (Global):** Compact 64px left application bar with diamond logo and navigation icons.
- **Header (Global):** 56px sticky top bar with centralized search capsule, random title generator, catalog refresh, and active extension picker.
- **Sub-Sidebar (Extensions / Settings):** 230px sticky vertical navigation column with category items (`Discover`, `Installed`, `Repositories`, `Community`, `Sideload .CS3`), dynamic repository feeds list, and engine metadata.
- **Main Viewport:** Flexible scrollable area (`flex: 1`, `padding: 24px 36px 60px`) hosting responsive grids and carousels.

---

## Components Specification

### 1. Navigation Pills (Sidebar & Category Bars)
- **Geometry:** Fully rounded `border-radius: 9999px`, `border: none`, `padding: 8px 16px` (sidebar) or `5px 14px` (category chips).
- **Inactive:** `background: transparent` or `rgba(255, 255, 255, 0.04)`, `color: #7d789e`, `font-weight: 500`.
- **Hover:** `background: rgba(255, 255, 255, 0.035)`, `color: #ffffff`.
- **Active:** `background: #201b3b`, `color: #ffffff`, `font-weight: 700`.

### 2. Extension Cards
- **Dimensions & Structure:** Compact card (`min-height: 150px`, `border-radius: 14px`, `border: none`).
- **Header:** 34×34px provider icon, title, version string, and operational/installed pill.
- **Metadata Tags:** Language badge (`🇧🇩 Bengali`), file size pill (`18.6 KB`), TV Type chips (`Movie`, `TvSeries`).
- **Description:** 2-line clamped preview text.
- **Footer:** Community upvote count button and action buttons (`Install` / `Browse on Home` / `Uninstall`).

### 3. Search Capsule
- **Style:** 42px height, fully rounded pill (`border-radius: 9999px`), `background: rgba(255, 255, 255, 0.05)`, `border: none`, `padding: 0 18px`.
- **Behavior:** Minimalist placeholder (`#8e8aa4`), clear button on text presence, seamless typing experience.

---

## Do's and Don'ts

### Do:
- **Do** keep cards and container panels completely borderless (`border: none`).
- **Do** maintain sticky positioning for sub-navigation sidebars so they remain in view during scrolling.
- **Do** use `position: fixed` with heavy backdrop blur for all modal overlays.
- **Do** use `#201b3b` for active navigation pills to maintain the Stremio aesthetic.
- **Do** ensure responsive auto-fill grids with balanced gap spacing (`gap: 16px`).

### Don't:
- **Don't** add 1px border outlines or glowing rims around extension cards.
- **Don't** let the left sidebar scroll off-screen when the user navigates long feeds.
- **Don't** render modal dialogs as static flex children inside page layout containers.
- **Don't** use loud or distracting colors for secondary text—keep metadata muted (`#7d789e`).
