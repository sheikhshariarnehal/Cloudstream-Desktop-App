export type TvType =
  | 'Movie'
  | 'TvSeries'
  | 'Anime'
  | 'AnimeMovie'
  | 'AsianDrama'
  | 'Cartoon'
  | 'Documentary'
  | 'LiveStream'
  | 'Torrent'
  | 'NSFW'
  | 'OVA'
  | 'Other';

export type DubStatus = 'Subbed' | 'Dubbed' | 'Both';

export interface SearchResponse {
  name: string;
  url: string;
  api_name: string;
  tv_type: TvType;
  poster_url?: string;
  year?: number;
  score?: number;
  dub_status?: DubStatus;
  latest_episode?: number;
  quality?: string;
  season?: number;
  episode?: number;
}

export interface SearchHistoryItem {
  id?: number;
  search_text: string;
  searched_at: number;
  types: TvType[];
  key: string;
}

export interface ProviderSearchResult {
  provider: string;
  items: SearchResponse[];
  current_page: number;
  has_next: boolean;
}

export interface SearchMultiResult {
  grouped: ProviderSearchResult[];
  bundled: SearchResponse[];
}

export interface SearchChunkEvent {
  query: string;
  provider: string;
  items: SearchResponse[];
  completed_count: number;
  total_count: number;
  is_done: boolean;
}

export type SearchDisplayMode = 'grouped' | 'grid';

export type WatchStatusFilter =
  | 'all'
  | 'watching'
  | 'plan_to_watch'
  | 'completed'
  | 'on_hold'
  | 'dropped';

export interface HomePageList {
  name: string;
  list: SearchResponse[];
  is_horizontal: boolean;
}

export interface ExpandableShelf {
  list: HomePageList;
  current_page: number;
  has_next: boolean;
}

export interface Actor {
  name: string;
  role?: string;
  image?: string;
}

export interface SeasonData {
  season: number;
  name?: string;
  display_season?: number;
}

export interface NextAiring {
  episode: number;
  unix_time: number;
  season?: number;
}

export interface Episode {
  name?: string;
  season?: number;
  episode: number;
  data: string;
  poster_url?: string;
  rating?: number;
  description?: string;
  release_date?: string;
  dub_status?: DubStatus;
}

export interface LoadResponse {
  name: string;
  url: string;
  api_name: string;
  tv_type: TvType;
  poster_url?: string;
  background_poster_url?: string;
  plot?: string;
  year?: number;
  duration_minutes?: number;
  tags: string[];
  cast: Actor[];
  episodes: Episode[];
  recommendations: SearchResponse[];
  trailers: string[];
  sync_ids: Record<string, string>;
  score?: number;
  content_rating?: string;
  coming_soon?: boolean;
  season_names?: SeasonData[];
  next_airing?: NextAiring;
  show_status?: 'Ongoing' | 'Completed' | string;
  synonyms?: string[];
  eng_name?: string;
  jap_name?: string;
}

export type QualityProfile =
  | 'Unknown'
  | 'Quality360p'
  | 'Quality480p'
  | 'Quality720p'
  | 'Quality1080p'
  | 'Quality4K'
  | 'Auto';

export interface ExtractorLink {
  source: string;
  name: string;
  url: string;
  referer: string;
  quality: QualityProfile;
  is_m3u8: boolean;
  is_dash: boolean;
  headers: Record<string, string>;
}

export interface SubtitleData {
  url: string;
  language: string;
  ietf_tag?: string;
  origin?: 'Embedded' | 'ExternalUrl' | 'DownloadedFile' | string;
  format?: 'Vtt' | 'Srt' | 'Ass' | 'Unknown' | string;
  languageCode?: string;
  originalName?: string;
  name?: string;
}

export interface RepositoryEntry {
  name: string;
  url: string;
  icon_url?: string;
  manifest_version?: number;
  plugin_count: number;
  added_at: number;
}

export interface PluginManifest {
  id: string;
  name: string;
  internal_name?: string;
  plugin_url: string;
  version: number;
  api_version: number;
  tv_types: string[];
  icon_url?: string;
  authors: string[];
  description?: string;
  repository_url?: string;
  language?: string;
  file_size?: number;
  file_hash?: string;
  status?: 'installed' | 'available' | 'update_available' | 'down' | string;
}

export interface RepositoryManifest {
  name: string;
  url: string;
  manifest_version?: number;
  plugins: PluginManifest[];
}

export interface WatchHistoryItem {
  id?: number;
  media_id: string;
  provider_id: string;
  title: string;
  poster_url?: string;
  tv_type?: TvType;
  episode_num?: number;
  season_num?: number;
  episode_name?: string;
  position_ms: number;
  duration_ms: number;
  last_watched_at: number;
  is_completed: boolean;
}

export interface WatchlistItem {
  id?: number;
  media_id: string;
  provider_id: string;
  title: string;
  poster_url?: string;
  tv_type: string;
  status: 'watching' | 'completed' | 'plan_to_watch' | 'dropped' | 'on_hold';
  score?: number;
  added_at: number;
}

export interface SkipInterval {
  start: number;
  end: number;
  skip_type: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  is_builtin: boolean;
  version?: string;
  supported_types: string[];
  icon_url?: string;
  description?: string;
  language?: string;
  has_main_page?: boolean;
}

export interface MpvTrack {
  id: number;
  type: 'video' | 'audio' | 'sub';
  src_id?: number;
  'src-id'?: number;
  title?: string;
  lang?: string;
  codec?: string;
  selected: boolean;
  default?: boolean;
  audio_channels?: number;
  'audio-channels'?: number;
}

/**
 * ISO language code to Flag emoji mapping (CloudStream getFlagFromIso parity)
 */
export const getFlagFromIso = (lang?: string): string => {
  if (!lang) return '🌐';
  const clean = lang.trim().toLowerCase();
  switch (clean) {
    case 'en': return '🇺🇸';
    case 'bn': return '🇧🇩';
    case 'hi': return '🇮🇳';
    case 'ja': return '🇯🇵';
    case 'ko': return '🇰🇷';
    case 'zh': return '🇨🇳';
    case 'es': return '🇪🇸';
    case 'fr': return '🇫🇷';
    case 'de': return '🇩🇪';
    case 'it': return '🇮🇹';
    case 'pt': return '🇧🇷';
    case 'ru': return '🇷🇺';
    case 'ar': return '🇸🇦';
    case 'id': return '🇮🇩';
    case 'vi': return '🇻🇳';
    case 'tr': return '🇹🇷';
    case 'th': return '🇹🇭';
    case 'all':
    case 'multi':
      return '🌐';
    default: {
      if (clean.length === 2) {
        const codePoints = clean
          .toUpperCase()
          .split('')
          .map((c) => 127397 + c.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
      }
      return '🌐';
    }
  }
};

