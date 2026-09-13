// CloudStream Desktop Settings Types (1:1 Parity with CloudStream Android DataStore & SharedPreferences)

export interface SubtitleStyle {
  foregroundColor: string;       // HEX or RGBA (Default: #ffffff)
  backgroundColor: string;       // Background box color (Default: rgba(0,0,0,0.75))
  windowColor: string;           // Window container color
  edgeType: 'none' | 'outline' | 'drop_shadow' | 'raised' | 'depressed';
  edgeColor: string;             // Outline/shadow color (Default: #000000)
  edgeSize: number;              // Outline width (Default: 2)
  fontFamily: string;            // e.g. "Inter", "Outfit", "Arial", "Courier New"
  fontSize: number;              // in px (Default: 24)
  elevation: number;             // Bottom margin elevation in px (Default: 24)
  backgroundRadius: number;      // Corner radius in px (Default: 6)
  bold: boolean;
  italic: boolean;
  upperCase: boolean;
  removeCaptions: boolean;       // Hearing-impaired regex filter: (-\s?|)[\[({][\S\s]*?[])}]\s*
  removeBloat: boolean;          // Ads/promo filter
  alignment: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center';
  autoSelectLanguage: string;    // IETF language tag (Default: "en")
  autoDownloadLanguages: string[]; // List of language tags
  encoding: string;              // Text encoding (Default: "UTF-8")
}

export interface CustomSiteOverride {
  id: string;
  parentClassName: string;
  name: string;
  url: string;
  lang: string;
}

export interface QualityProfile {
  id: string;
  name: string;
  preferredQuality: '4K' | '1080p' | '720p' | '480p' | 'Auto';
  preferredSources: string[];
}

export interface SyncAccount {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string;
  token?: string;
  refreshToken?: string;
  isAuthenticated: boolean;
  lastSyncedAt?: number;
}

export interface AppSettings {
  // General Tab
  language: string;
  downloadPath: string;
  parallelDownloads: number;      // 1..10
  concurrentConnections: number;  // 1..10
  dohProvider: 'system' | 'google' | 'cloudflare' | 'adguard' | 'quad9' | 'cleanbrowsing';
  useJsdelivrProxy: boolean;
  useBdxProxy: boolean;
  customSites: CustomSiteOverride[];
  beneneCount: number;
  quitOnClose: boolean;
  escapeExitFullscreen: boolean;
  blurUnwatchedThumbnails: boolean;
  enableGamepadSupport: boolean;

  // Player Tab
  defaultPlayer: 'builtin' | 'mpv' | 'vlc';
  autoplayNext: boolean;
  enableAnimeSkip: boolean;
  seekTimeSeconds: number;        // 5..60s
  titleLimitChars: number;        // 0=None, 16..128, -1=Hide
  showPlayerInfoChips: {
    source: boolean;
    resolution: boolean;
    codecs: boolean;
  };
  hardwareAcceleration: 'auto' | 'hardware' | 'software';
  renderProfile: 'auto' | 'fast' | 'high_quality';
  gpuVideoProcessing: boolean;
  bufferDiskMb: number;           // 0=Auto, 10..500
  bufferRamMb: number;            // 0=Auto, 10..500
  bufferDurationMinutes: number;  // 0=Auto, 1..30
  extraBrightness: boolean;

  // Subtitles Tab
  subtitles: SubtitleStyle;

  // Appearance / UI Tab
  theme: 'amoled' | 'dark' | 'dracula' | 'lavender' | 'silent_blue' | 'light';
  primaryAccent: string;
  posterScale: number;            // 0..15
  bottomTitles: boolean;
  showCardBadges: {
    hd: boolean;
    dub: boolean;
    sub: boolean;
    rating: boolean;
    title: boolean;
    episodes: boolean;
  };
  advancedSearch: boolean;
  searchSuggestions: boolean;
  showTrailers: boolean;
  showKitsuPosters: boolean;
  showCast: boolean;
  showFillers: boolean;
  showPlayerMetadata: boolean;

  // Providers Tab
  providerLanguages: string[];    // Language tags e.g. ["en", "bn", "hi"]
  preferredMediaTypes: string[];  // "Movie", "TvSeries", "Anime", etc.
  dubStatusFilter: ('Subbed' | 'Dubbed' | 'None')[];
  enableNsfw: boolean;

  // Accounts Tab
  activeSyncService?: 'mal' | 'anilist' | 'simkl' | 'kitsu';
  accounts: {
    mal?: SyncAccount;
    anilist?: SyncAccount;
    simkl?: SyncAccount;
    kitsu?: SyncAccount;
    openSubtitles?: { username: string; apiKey: string; isAuthenticated: boolean };
    subDl?: { apiKey: string; isAuthenticated: boolean };
    animeSkip?: { apiKey: string; isAuthenticated: boolean };
  };

  // Updates & Backup Tab
  autoCheckUpdates: boolean;
  notifyBetaReleases: boolean;
  autoUpdatePlugins: boolean;
  autoDownloadPluginsMode: 'disabled' | 'matching_language' | 'all' | 'nsfw';
  autoBackupIntervalHours: number; // 0=None, 6, 12, 24, 72, 168
  backupPath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  downloadPath: 'Downloads/CloudStream',
  parallelDownloads: 3,
  concurrentConnections: 3,
  dohProvider: 'cloudflare',
  useJsdelivrProxy: false,
  useBdxProxy: true,
  customSites: [],
  beneneCount: 0,
  quitOnClose: true,
  escapeExitFullscreen: true,
  blurUnwatchedThumbnails: false,
  enableGamepadSupport: false,

  defaultPlayer: 'builtin',
  autoplayNext: true,
  enableAnimeSkip: true,
  seekTimeSeconds: 10,
  titleLimitChars: 0,
  showPlayerInfoChips: {
    source: true,
    resolution: true,
    codecs: false,
  },
  hardwareAcceleration: 'auto',
  renderProfile: 'auto',
  gpuVideoProcessing: false,
  bufferDiskMb: 0,
  bufferRamMb: 0,
  bufferDurationMinutes: 0,
  extraBrightness: false,

  subtitles: {
    foregroundColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    windowColor: 'transparent',
    edgeType: 'outline',
    edgeColor: '#000000',
    edgeSize: 2,
    fontFamily: 'Inter',
    fontSize: 24,
    elevation: 24,
    backgroundRadius: 6,
    bold: false,
    italic: false,
    upperCase: false,
    removeCaptions: false,
    removeBloat: true,
    alignment: 'bottom-center',
    autoSelectLanguage: 'en',
    autoDownloadLanguages: ['en'],
    encoding: 'UTF-8',
  },

  theme: 'dark',
  primaryAccent: 'Purple',
  posterScale: 7,
  bottomTitles: true,
  showCardBadges: {
    hd: true,
    dub: true,
    sub: true,
    rating: true,
    title: true,
    episodes: true,
  },
  advancedSearch: true,
  searchSuggestions: true,
  showTrailers: true,
  showKitsuPosters: true,
  showCast: true,
  showFillers: false,
  showPlayerMetadata: true,

  providerLanguages: ['all'],
  preferredMediaTypes: ['Movie', 'TvSeries', 'Anime', 'Cartoon', 'AsianDrama'],
  dubStatusFilter: ['Subbed', 'Dubbed'],
  enableNsfw: false,

  accounts: {},

  autoCheckUpdates: true,
  notifyBetaReleases: false,
  autoUpdatePlugins: true,
  autoDownloadPluginsMode: 'matching_language',
  autoBackupIntervalHours: 24,
  backupPath: 'Backups/CloudStream',
};

export interface AccentColorDefinition {
  name: string;
  hex: string;
  glow: string;
}

export const ACCENT_PALETTES: AccentColorDefinition[] = [
  { name: 'Purple', hex: '#7c3aed', glow: 'rgba(124, 58, 237, 0.4)' },
  { name: 'Cool Blue', hex: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  { name: 'Cyan', hex: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },
  { name: 'Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  { name: 'Green Apple', hex: '#84cc16', glow: 'rgba(132, 204, 22, 0.4)' },
  { name: 'Dandelion Yellow', hex: '#eab308', glow: 'rgba(234, 179, 8, 0.4)' },
  { name: 'Orange', hex: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
  { name: 'Fire Red', hex: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
  { name: 'Rose', hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
  { name: 'Carnation Pink', hex: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
  { name: 'Lavender Dreams', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  { name: 'Maroon', hex: '#991b1b', glow: 'rgba(153, 27, 27, 0.4)' },
  { name: 'Navy Blue', hex: '#1e3a8a', glow: 'rgba(30, 58, 138, 0.4)' },
  { name: 'Silver Grey', hex: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)' },
];
