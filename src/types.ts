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

export interface Actor {
  name: string;
  role?: string;
  image?: string;
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

export interface PluginManifest {
  id: string;
  name: string;
  plugin_url: string;
  version: number;
  api_version: number;
  tv_types: string[];
  icon_url?: string;
  authors: string[];
  description?: string;
  repository_url?: string;
  status?: 'installed' | 'available' | 'update_available';
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

