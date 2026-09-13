# CloudStream Desktop Settings Architecture & Implementation Specification

> **Reference Source**: `d:\Poject\CloudStream\cloudstream\SETTINGS_CONTEXT.md`  
> **Target Desktop Application**: `d:\Poject\CloudStream\CloudStream-Desktop`  
> **Purpose**: Complete design system, component hierarchy, state models, and Tauri IPC integration specs for upgrading the Desktop Settings page to 100% CloudStream feature parity.

---

## 1. Architectural Overview & Component Structure

The Desktop Settings screen will replace the current placeholder with a modern, glassmorphic 2-column layout adhering to the Desktop design system:

```
src/
└── screens/
    └── settings/
        ├── SettingsScreen.tsx            # Root Master-Detail container
        ├── SettingsSidebar.tsx           # Category navigation & profile card
        ├── tabs/
        │   ├── GeneralTab.tsx            # Language, Downloads, DoH DNS, CDN Proxy, Custom Sites
        │   ├── PlayerTab.tsx             # Playback behaviors, Seek steps, Buffers, Hardware Accel
        │   ├── SubtitlesTab.tsx          # Caption style preview, fonts, colors, clean regex
        │   ├── AppearanceTab.tsx         # Themes (Dark, Amoled, Dracula), Accent palettes, Card scaling
        │   ├── ProvidersTab.tsx          # Provider languages, TvTypes, Dub/Sub filters, NSFW toggle
        │   ├── AccountsTab.tsx           # MAL, AniList, Simkl (QR/PIN), Kitsu, OpenSubtitles, SubDL
        │   ├── UpdatesBackupTab.tsx      # Auto-updates, Beta channels, JSON Backup export/import
        │   └── DiagnosticsTab.tsx        # Live stdout/stderr log stream & Provider Health Test runner
        └── components/
            ├── SettingCard.tsx           # Reusable setting container card
            ├── SettingRow.tsx            # Setting row with title, description, and control
            ├── SettingSwitch.tsx         # Sleek toggle switch
            ├── SettingSlider.tsx         # Slider with live value chip
            ├── SettingSelect.tsx         # Custom dropdown selector
            ├── SubtitlePreviewBox.tsx    # Live rendering sample subtitle on backdrop
            └── ColorPickerModal.tsx      # Custom HEX/ARGB color picker
```

---

## 2. Complete State Interface (`src/types/settings.ts`)

```typescript
export interface SubtitleStyle {
  foregroundColor: string;       // HEX or RGBA
  backgroundColor: string;       // Background box color
  windowColor: string;
  edgeType: 'none' | 'outline' | 'drop_shadow' | 'raised' | 'depressed';
  edgeColor: string;
  fontFamily: string;
  fontSize: number;              // in px (default: 24)
  backgroundRadius: number;      // in px (default: 6)
  bold: boolean;
  italic: boolean;
  upperCase: boolean;
  removeCaptions: boolean;       // Hearing-impaired regex filter
  removeBloat: boolean;          // Ads/promo filter
  autoSelectLanguage: string;    // e.g. "en"
  autoDownloadLanguages: string[];
  encoding: string;              // e.g. "UTF-8"
}

export interface CustomSiteOverride {
  parentClassName: string;
  name: string;
  url: string;
  lang: string;
}

export interface AppSettings {
  // General
  language: string;
  downloadPath: string;
  parallelDownloads: number;
  concurrentConnections: number;
  dohProvider: 'system' | 'google' | 'cloudflare' | 'adguard' | 'quad9';
  useJsdelivrProxy: boolean;
  useBdxProxy: boolean;
  customSites: CustomSiteOverride[];

  // Player & Playback
  defaultPlayer: 'builtin' | 'mpv' | 'vlc';
  autoplayNext: boolean;
  enableAnimeSkip: boolean;
  seekTimeSeconds: number;
  hardwareAcceleration: 'auto' | 'hardware' | 'software';
  bufferDiskMb: number;
  bufferRamMb: number;
  subtitles: SubtitleStyle;

  // Appearance & UI
  theme: 'amoled' | 'dark' | 'dracula' | 'lavender' | 'silent_blue' | 'system';
  primaryAccent: string;
  posterScale: number;
  showCardBadges: {
    hd: boolean;
    dub: boolean;
    sub: boolean;
    rating: boolean;
    title: boolean;
    episodes: boolean;
  };
  showTrailers: boolean;
  showCast: boolean;
  showFillers: boolean;

  // Providers & Catalogs
  providerLanguages: string[];
  preferredMediaTypes: string[];
  dubStatusFilter: ('Subbed' | 'Dubbed' | 'None')[];
  enableNsfw: boolean;

  // Accounts & Sync
  accounts: {
    mal?: { username: string; token: string; avatarUrl?: string };
    anilist?: { username: string; token: string; avatarUrl?: string };
    simkl?: { username: string; token: string; userCode?: string };
    kitsu?: { username: string; token: string };
    openSubtitles?: { username: string; apiKey: string };
    subDl?: { apiKey: string };
  };

  // Updates & Backup
  autoCheckUpdates: boolean;
  notifyBetaReleases: boolean;
  autoUpdatePlugins: boolean;
  autoBackupIntervalHours: number;
}
```

---

## 3. Desktop Tauri Rust Backend Interface

Add these handlers to `src-tauri/src/main.rs` to persist settings and provide native OS integration:

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub async fn get_desktop_settings() -> Result<AppSettings, String> {
    let config_path = get_config_dir().join("settings.json");
    if !config_path.exists() {
        return Ok(AppSettings::default());
    }
    let data = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_desktop_settings(settings: AppSettings) -> Result<(), String> {
    let config_dir = get_config_dir();
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(config_dir.join("settings.json"), data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_backup_json(target_path: String) -> Result<(), String> {
    let backup_data = build_portable_backup_json()?;
    fs::write(target_path, backup_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_backup_json(source_path: String) -> Result<AppSettings, String> {
    let data = fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    restore_backup_json(&data)
}
```

---

## 4. UI Design Implementation Guidelines

1. **Stremio-Inspired Glassmorphism**:
   - Surface background: `rgba(20, 22, 34, 0.75)` with `backdrop-filter: blur(16px)`.
   - Active tab highlight: `var(--stremio-purple)` with subtle ambient glow `0 0 16px rgba(123, 76, 255, 0.3)`.
   - Subtle border: `1px solid rgba(255, 255, 255, 0.08)`.
2. **Smooth Interactions & Micro-Animations**:
   - Hover transitions (`cubic-bezier(0.16, 1, 0.3, 1)`).
   - Setting switches animate smoothly with 200ms spring feel.
   - Live real-time subtitle preview updates as color, font size, or outline sliders change.
3. **Responsive Grid & Accessibility**:
   - Keyboard accessible (Tab / Arrow keys).
   - Instant search bar on top to filter setting keys across all tabs.
