// Ported from CloudStream Kotlin architecture (com.lagradost.cloudstream3.utils.SubtitleHelper)
import { MpvTrack, SubtitleData } from '../types';

export interface LanguageMetadata {
  languageName: string;
  nativeName: string;
  IETF_tag: string;
  ISO_639_1: string;
  ISO_639_2_B: string;
  ISO_639_3: string;
  openSubtitles: string;
  flag?: string;
}

export const LANGUAGES: LanguageMetadata[] = [
  { languageName: 'English', nativeName: 'English', IETF_tag: 'en', ISO_639_1: 'en', ISO_639_2_B: 'eng', ISO_639_3: 'eng', openSubtitles: 'en', flag: '🇬🇧' },
  { languageName: 'Japanese', nativeName: '日本語', IETF_tag: 'ja', ISO_639_1: 'ja', ISO_639_2_B: 'jpn', ISO_639_3: 'jpn', openSubtitles: 'ja', flag: '🇯🇵' },
  { languageName: 'Spanish', nativeName: 'Español', IETF_tag: 'es', ISO_639_1: 'es', ISO_639_2_B: 'spa', ISO_639_3: 'spa', openSubtitles: 'es', flag: '🇪🇸' },
  { languageName: 'Spanish (Latin America)', nativeName: 'Español (Latinoamérica)', IETF_tag: 'es-419', ISO_639_1: 'es', ISO_639_2_B: 'spa', ISO_639_3: 'spa', openSubtitles: 'es', flag: '🇲🇽' },
  { languageName: 'French', nativeName: 'Français', IETF_tag: 'fr', ISO_639_1: 'fr', ISO_639_2_B: 'fre', ISO_639_3: 'fra', openSubtitles: 'fr', flag: '🇫🇷' },
  { languageName: 'German', nativeName: 'Deutsch', IETF_tag: 'de', ISO_639_1: 'de', ISO_639_2_B: 'ger', ISO_639_3: 'deu', openSubtitles: 'de', flag: '🇩🇪' },
  { languageName: 'Italian', nativeName: 'Italiano', IETF_tag: 'it', ISO_639_1: 'it', ISO_639_2_B: 'ita', ISO_639_3: 'ita', openSubtitles: 'it', flag: '🇮🇹' },
  { languageName: 'Portuguese', nativeName: 'Português', IETF_tag: 'pt', ISO_639_1: 'pt', ISO_639_2_B: 'por', ISO_639_3: 'por', openSubtitles: 'pt', flag: '🇵🇹' },
  { languageName: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', IETF_tag: 'pt-br', ISO_639_1: 'pt', ISO_639_2_B: 'por', ISO_639_3: 'por', openSubtitles: 'pb', flag: '🇧🇷' },
  { languageName: 'Russian', nativeName: 'Русский', IETF_tag: 'ru', ISO_639_1: 'ru', ISO_639_2_B: 'rus', ISO_639_3: 'rus', openSubtitles: 'ru', flag: '🇷🇺' },
  { languageName: 'Chinese (Simplified)', nativeName: '简体中文', IETF_tag: 'zh-hans', ISO_639_1: 'zh', ISO_639_2_B: 'chi', ISO_639_3: 'zho', openSubtitles: 'zh-cn', flag: '🇨🇳' },
  { languageName: 'Chinese (Traditional)', nativeName: '繁體中文', IETF_tag: 'zh-hant', ISO_639_1: 'zh', ISO_639_2_B: 'chi', ISO_639_3: 'zho', openSubtitles: 'zh-tw', flag: '🇹🇼' },
  { languageName: 'Korean', nativeName: '한국어', IETF_tag: 'ko', ISO_639_1: 'ko', ISO_639_2_B: 'kor', ISO_639_3: 'kor', openSubtitles: 'ko', flag: '🇰🇷' },
  { languageName: 'Arabic', nativeName: 'العربية', IETF_tag: 'ar', ISO_639_1: 'ar', ISO_639_2_B: 'ara', ISO_639_3: 'ara', openSubtitles: 'ar', flag: '🇸🇦' },
  { languageName: 'Hindi', nativeName: 'हिन्दी', IETF_tag: 'hi', ISO_639_1: 'hi', ISO_639_2_B: 'hin', ISO_639_3: 'hin', openSubtitles: 'hi', flag: '🇮🇳' },
  { languageName: 'Bengali', nativeName: 'বাংলা', IETF_tag: 'bn', ISO_639_1: 'bn', ISO_639_2_B: 'ben', ISO_639_3: 'ben', openSubtitles: 'bn', flag: '🇧🇩' },
  { languageName: 'Indonesian', nativeName: 'Bahasa Indonesia', IETF_tag: 'id', ISO_639_1: 'id', ISO_639_2_B: 'ind', ISO_639_3: 'ind', openSubtitles: 'id', flag: '🇮🇩' },
  { languageName: 'Turkish', nativeName: 'Türkçe', IETF_tag: 'tr', ISO_639_1: 'tr', ISO_639_2_B: 'tur', ISO_639_3: 'tur', openSubtitles: 'tr', flag: '🇹🇷' },
  { languageName: 'Vietnamese', nativeName: 'Tiếng Việt', IETF_tag: 'vi', ISO_639_1: 'vi', ISO_639_2_B: 'vie', ISO_639_3: 'vie', openSubtitles: 'vi', flag: '🇻🇳' },
  { languageName: 'Thai', nativeName: 'ไทย', IETF_tag: 'th', ISO_639_1: 'th', ISO_639_2_B: 'tha', ISO_639_3: 'tha', openSubtitles: 'th', flag: '🇹🇭' },
  { languageName: 'Polish', nativeName: 'Polski', IETF_tag: 'pl', ISO_639_1: 'pl', ISO_639_2_B: 'pol', ISO_639_3: 'pol', openSubtitles: 'pl', flag: '🇵🇱' },
  { languageName: 'Filipino', nativeName: 'Filipino / Tagalog', IETF_tag: 'fil', ISO_639_1: 'tl', ISO_639_2_B: 'tgl', ISO_639_3: 'fil', openSubtitles: 'tl', flag: '🇵🇭' },
  { languageName: 'Dutch', nativeName: 'Nederlands', IETF_tag: 'nl', ISO_639_1: 'nl', ISO_639_2_B: 'dut', ISO_639_3: 'nld', openSubtitles: 'nl', flag: '🇳🇱' },
  { languageName: 'Swedish', nativeName: 'Svenska', IETF_tag: 'sv', ISO_639_1: 'sv', ISO_639_2_B: 'swe', ISO_639_3: 'swe', openSubtitles: 'sv', flag: '🇸🇪' },
  { languageName: 'Greek', nativeName: 'Ελληνικά', IETF_tag: 'el', ISO_639_1: 'el', ISO_639_2_B: 'gre', ISO_639_3: 'ell', openSubtitles: 'el', flag: '🇬🇷' },
  { languageName: 'Hebrew', nativeName: 'עברית', IETF_tag: 'he', ISO_639_1: 'he', ISO_639_2_B: 'heb', ISO_639_3: 'heb', openSubtitles: 'he', flag: '🇮🇱' },
  { languageName: 'Czech', nativeName: 'Čeština', IETF_tag: 'cs', ISO_639_1: 'cs', ISO_639_2_B: 'cze', ISO_639_3: 'ces', openSubtitles: 'cs', flag: '🇨🇿' },
  { languageName: 'Hungarian', nativeName: 'Magyar', IETF_tag: 'hu', ISO_639_1: 'hu', ISO_639_2_B: 'hun', ISO_639_3: 'hun', openSubtitles: 'hu', flag: '🇭🇺' },
  { languageName: 'Romanian', nativeName: 'Română', IETF_tag: 'ro', ISO_639_1: 'ro', ISO_639_2_B: 'rum', ISO_639_3: 'ron', openSubtitles: 'ro', flag: '🇷🇴' },
  { languageName: 'Ukrainian', nativeName: 'Українська', IETF_tag: 'uk', ISO_639_1: 'uk', ISO_639_2_B: 'ukr', ISO_639_3: 'ukr', openSubtitles: 'uk', flag: '🇺🇦' },
  { languageName: 'Persian', nativeName: 'فارسی', IETF_tag: 'fa', ISO_639_1: 'fa', ISO_639_2_B: 'per', ISO_639_3: 'fas', openSubtitles: 'fa', flag: '🇮🇷' },
  { languageName: 'Malay', nativeName: 'Bahasa Melayu', IETF_tag: 'ms', ISO_639_1: 'ms', ISO_639_2_B: 'may', ISO_639_3: 'msa', openSubtitles: 'ms', flag: '🇲🇾' },
  { languageName: 'Tamil', nativeName: 'தமிழ்', IETF_tag: 'ta', ISO_639_1: 'ta', ISO_639_2_B: 'tam', ISO_639_3: 'tam', openSubtitles: 'ta', flag: '🇮🇳' },
  { languageName: 'Telugu', nativeName: 'తెలుగు', IETF_tag: 'te', ISO_639_1: 'te', ISO_639_2_B: 'tel', ISO_639_3: 'tel', openSubtitles: 'te', flag: '🇮🇳' },
  { languageName: 'Urdu', nativeName: 'اردو', IETF_tag: 'ur', ISO_639_1: 'ur', ISO_639_2_B: 'urd', ISO_639_3: 'urd', openSubtitles: 'ur', flag: '🇵🇰' },
  { languageName: 'Norwegian', nativeName: 'Norsk', IETF_tag: 'no', ISO_639_1: 'no', ISO_639_2_B: 'nor', ISO_639_3: 'nor', openSubtitles: 'no', flag: '🇳🇴' },
  { languageName: 'Danish', nativeName: 'Dansk', IETF_tag: 'da', ISO_639_1: 'da', ISO_639_2_B: 'dan', ISO_639_3: 'dan', openSubtitles: 'da', flag: '🇩🇰' },
  { languageName: 'Finnish', nativeName: 'Suomi', IETF_tag: 'fi', ISO_639_1: 'fi', ISO_639_2_B: 'fin', ISO_639_3: 'fin', openSubtitles: 'fi', flag: '🇫🇮' },
];

// Pre-built lookup maps for fast resolution
const mapIETF = new Map<string, LanguageMetadata>();
const mapISO1 = new Map<string, LanguageMetadata>();
const mapISO2 = new Map<string, LanguageMetadata>();
const mapISO3 = new Map<string, LanguageMetadata>();
const mapEnglish = new Map<string, LanguageMetadata>();
const mapNative = new Map<string, LanguageMetadata>();

for (const lang of LANGUAGES) {
  mapIETF.set(lang.IETF_tag.toLowerCase(), lang);
  if (lang.ISO_639_1) mapISO1.set(lang.ISO_639_1.toLowerCase(), lang);
  if (lang.ISO_639_2_B) mapISO2.set(lang.ISO_639_2_B.toLowerCase(), lang);
  if (lang.ISO_639_3) mapISO3.set(lang.ISO_639_3.toLowerCase(), lang);
  mapEnglish.set(lang.languageName.toLowerCase(), lang);
  mapNative.set(lang.nativeName.toLowerCase(), lang);
}

/**
 * Clean garbage tokens (such as `(Dub)`, `[CC]`, `[eng]`, numbers, punctuation) from language/title strings
 */
export function cleanLanguageString(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/\([^)]*(?:dub|sub|original|audio|code|cc|forced|full)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(?:dub|sub|original|audio|code|cc|forced|full)[^\]]*\]/gi, '')
    .replace(/[0-9]/g, '')
    .replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\s-]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Resolves a language code/tag/name to its canonical LanguageMetadata
 */
export function getLanguageMetadata(input?: string | null, halfMatch: boolean = true): LanguageMetadata | null {
  if (!input || input.trim().length < 2) return null;
  const raw = input.trim().toLowerCase();
  const cleaned = cleanLanguageString(input);

  // Exact matching against lookup indices
  const exact =
    mapIETF.get(raw) ||
    mapISO1.get(raw) ||
    mapISO2.get(raw) ||
    mapISO3.get(raw) ||
    mapEnglish.get(raw) ||
    mapNative.get(raw) ||
    mapIETF.get(cleaned) ||
    mapISO1.get(cleaned) ||
    mapISO2.get(cleaned) ||
    mapISO3.get(cleaned) ||
    mapEnglish.get(cleaned) ||
    mapNative.get(cleaned);

  if (exact) return exact;

  if (halfMatch) {
    // Check substring matches
    for (const lang of LANGUAGES) {
      const eng = lang.languageName.toLowerCase();
      const nat = lang.nativeName.toLowerCase();
      const ietf = lang.IETF_tag.toLowerCase();
      const iso2 = lang.ISO_639_2_B.toLowerCase();
      const iso3 = lang.ISO_639_3.toLowerCase();

      if (
        raw.includes(eng) ||
        raw.includes(nat) ||
        cleaned.includes(eng) ||
        (raw.length <= 4 && (raw === ietf || raw === iso2 || raw === iso3))
      ) {
        return lang;
      }
    }
  }

  return null;
}

/**
 * Returns IETF tag from any language string or name
 */
export function fromLanguageToTagIETF(input?: string | null, halfMatch: boolean = true): string | null {
  const meta = getLanguageMetadata(input, halfMatch);
  return meta ? meta.IETF_tag : null;
}

/**
 * Returns clean English display name from a language tag or name
 */
export function fromTagToEnglishLanguageName(input?: string | null): string {
  if (!input) return 'Unknown';
  const meta = getLanguageMetadata(input, true);
  return meta ? meta.languageName : input.toUpperCase();
}

/**
 * Returns formatted title with flag emoji if available
 */
export function getLanguageDisplay(input?: string | null): { name: string; flag: string; tag: string } {
  const meta = getLanguageMetadata(input, true);
  if (meta) {
    return {
      name: meta.languageName,
      flag: meta.flag || '🌐',
      tag: meta.IETF_tag,
    };
  }
  return {
    name: input || 'Unknown',
    flag: '🌐',
    tag: input?.toLowerCase() || '',
  };
}

/**
 * Check if a track matches the target language code according to CloudStream rules
 */
/**
 * Check if a track matches the target language code according to CloudStream rules
 */
export function matchesLanguageCode(trackLangOrTitle?: string | null, targetCode: string = 'en'): boolean {
  if (!trackLangOrTitle) return false;
  const targetMeta = getLanguageMetadata(targetCode, true);
  const targetTag = targetMeta ? targetMeta.IETF_tag : targetCode.toLowerCase();

  const trackMeta = getLanguageMetadata(trackLangOrTitle, true);
  if (trackMeta) {
    if (trackMeta.IETF_tag === targetTag) return true;
    if (trackMeta.ISO_639_1 === targetTag) return true;
    if (targetMeta && trackMeta.ISO_639_1 === targetMeta.ISO_639_1) return true;
  }

  const raw = trackLangOrTitle.toLowerCase();
  if (targetMeta) {
    if (
      raw.includes(targetMeta.languageName.toLowerCase()) ||
      raw.includes(targetMeta.IETF_tag) ||
      (targetMeta.ISO_639_2_B && raw.includes(targetMeta.ISO_639_2_B)) ||
      (targetMeta.ISO_639_3 && raw.includes(targetMeta.ISO_639_3))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Auto-select best Subtitle Track following CloudStream GeneratorPlayer architecture:
 * 1. Matches embedded subtitle tracks against preferred language.
 * 2. If not found, matches external subtitles.
 * 3. Priority to tracks with default/forced flags or English fallback if preferred is English.
 */
export function getAutoSelectSubtitle(
  subTracks: MpvTrack[],
  externalSubs: SubtitleData[] = [],
  preferredLang: string = 'en'
): { track?: MpvTrack; externalSub?: SubtitleData; resolvedName: string } | null {
  if (subTracks.length === 0 && externalSubs.length === 0) return null;

  // 1. Search in embedded tracks
  const matchedEmbedded = subTracks.find((t) => {
    return (
      matchesLanguageCode(t.lang, preferredLang) ||
      matchesLanguageCode(t.title, preferredLang)
    );
  });

  if (matchedEmbedded) {
    const display = getLanguageDisplay(matchedEmbedded.lang || matchedEmbedded.title);
    return {
      track: matchedEmbedded,
      resolvedName: display.name || 'Auto Matched',
    };
  }

  // 2. Search in external subtitle files
  const matchedExternal = externalSubs.find((s) => {
    return (
      matchesLanguageCode(s.languageCode, preferredLang) ||
      matchesLanguageCode(s.originalName, preferredLang) ||
      matchesLanguageCode(s.language, preferredLang)
    );
  });

  if (matchedExternal) {
    const display = getLanguageDisplay(matchedExternal.languageCode || matchedExternal.originalName || matchedExternal.language);
    return {
      externalSub: matchedExternal,
      resolvedName: display.name ? `${display.name} (Online)` : 'Online Subtitle',
    };
  }

  // 3. Check for default marked embedded track
  const defaultSub = subTracks.find((t) => t.default);
  if (defaultSub) {
    const display = getLanguageDisplay(defaultSub.lang || defaultSub.title);
    return {
      track: defaultSub,
      resolvedName: display.name || 'Default Track',
    };
  }

  // 4. Fallback to first available embedded subtitle
  if (subTracks.length > 0) {
    const first = subTracks[0];
    const display = getLanguageDisplay(first.lang || first.title);
    return {
      track: first,
      resolvedName: display.name || 'First Track',
    };
  }

  return null;
}

/**
 * Auto-select best Audio Track following CloudStream GeneratorPlayer architecture:
 * 1. Matches against preferred language (e.g. Japanese 'ja' for anime or English 'en' for movies).
 * 2. If not matched, picks default-flagged audio track or first audio track.
 */
export function getAutoSelectAudio(
  audioTracks: MpvTrack[],
  preferredLang: string = 'auto'
): { track: MpvTrack; resolvedName: string } | null {
  if (audioTracks.length === 0) return null;

  if (preferredLang && preferredLang !== 'auto') {
    const matched = audioTracks.find(
      (t) => matchesLanguageCode(t.lang, preferredLang) || matchesLanguageCode(t.title, preferredLang)
    );
    if (matched) {
      const display = getLanguageDisplay(matched.lang || matched.title);
      return {
        track: matched,
        resolvedName: display.name || 'Auto Matched',
      };
    }
  }

  // Default audio track or first track
  const defaultTrack = audioTracks.find((t) => t.default) || audioTracks[0];
  const display = getLanguageDisplay(defaultTrack.lang || defaultTrack.title);
  return {
    track: defaultTrack,
    resolvedName: defaultTrack.lang || defaultTrack.title ? (display.name || 'Default Audio') : 'Default Audio',
  };
}

/**
 * Clean spam websites, file extensions, and torrent release tags from track titles
 */
export function sanitizeTrackTitle(title?: string | null): string {
  if (!title) return '';
  return title
    // Remove web domains (e.g., ~ 4kHdHub.com, HDHub4u.Ms, yts.mx, rarbg.to)
    .replace(/(?:~|\-|\|)?\s*(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|ms|in|to|mx|tv|cc|vip|co|me|xyz|info|pro)\b/gi, '')
    // Remove brackets with spam
    .replace(/\[\s*(?:4kHdHub|HDHub4u|yts|rarbg|psa|pahe|galaxyrg|flux|qxr|utr|ettv|tgx)[^\]]*\]/gi, '')
    // Remove extra trailing dashes, tildes, pipes, or spaces
    .replace(/^[\s~|\-]+|[\s~|\-]+$/g, '')
    .trim();
}

/**
 * Format track label for UI display
 */
export function formatTrackLabel(track: MpvTrack): {
  title: string;
  subtitle: string;
  flag: string;
  langCode: string;
  langName: string;
  isDefault?: boolean;
  isForced?: boolean;
} {
  const display = getLanguageDisplay(track.lang || track.title);
  const langName = display.name && display.name !== 'Unknown' ? display.name : '';
  const langCode = (display.tag || track.lang || (track.type === 'audio' ? 'AUD' : 'SUB')).slice(0, 2).toUpperCase();

  const cleanedRawTitle = sanitizeTrackTitle(track.title);

  // Check for common descriptors in title or codec
  const lowerTitle = (track.title || '').toLowerCase();
  const isSDH = lowerTitle.includes('sdh') || lowerTitle.includes('cc');
  const isForced = lowerTitle.includes('forced') || (track as any).forced === true;
  const isCommentary = lowerTitle.includes('commentary') || lowerTitle.includes('director');
  const isDescription = lowerTitle.includes('description') || lowerTitle.includes('descriptive') || lowerTitle.includes('narrated');
  const isOriginal = lowerTitle.includes('org') || lowerTitle.includes('original') || lowerTitle.includes('main');

  // Determine main display title
  let mainTitle = '';
  if (langName) {
    mainTitle = langName;
    const modifiers: string[] = [];
    if (isOriginal && track.type === 'audio') modifiers.push('Original');
    if (isSDH) modifiers.push('SDH');
    if (isForced) modifiers.push('Forced');
    if (isCommentary) modifiers.push('Commentary');
    if (isDescription) modifiers.push('Audio Description');

    if (modifiers.length > 0) {
      mainTitle = `${langName} (${modifiers.join(', ')})`;
    }
  } else if (cleanedRawTitle) {
    mainTitle = cleanedRawTitle;
  } else {
    mainTitle = track.type === 'audio' ? `Audio Track #${track.id}` : `Subtitle Track #${track.id}`;
  }

  // Build secondary metadata line
  const metaParts: string[] = [];

  // Codec formatting
  if (track.codec) {
    const c = track.codec.toLowerCase();
    if (c.includes('eac3') || c.includes('eac-3') || c.includes('ec-3')) {
      metaParts.push('E-AC-3');
    } else if (c.includes('ac3') || c.includes('ac-3')) {
      metaParts.push('AC-3');
    } else if (c.includes('subrip') || c.includes('srt')) {
      metaParts.push('SRT');
    } else if (c.includes('hdmv_pgs') || c.includes('pgs')) {
      metaParts.push('PGS');
    } else if (c.includes('ass') || c.includes('ssa')) {
      metaParts.push('ASS');
    } else if (c.includes('vtt')) {
      metaParts.push('VTT');
    } else if (c.includes('aac')) {
      metaParts.push('AAC');
    } else if (c.includes('flac')) {
      metaParts.push('FLAC');
    } else if (c.includes('dts')) {
      metaParts.push('DTS');
    } else if (c.includes('opus')) {
      metaParts.push('Opus');
    } else if (c.includes('truehd')) {
      metaParts.push('TrueHD');
    } else {
      metaParts.push(track.codec.toUpperCase());
    }
  }

  // Audio channels formatting
  const ch = track.audio_channels || track['audio-channels'];
  if (ch) {
    if (ch === 6) metaParts.push('5.1 Surround');
    else if (ch === 8) metaParts.push('7.1 Surround');
    else if (ch === 2) metaParts.push('Stereo');
    else if (ch === 1) metaParts.push('Mono');
    else metaParts.push(`${ch} Channels`);
  }

  // Extract bitrate if present in raw title (e.g. 640kbps, 448kbps, 320kbps)
  const bitrateMatch = lowerTitle.match(/(\d{2,4}\s*kbps)/i);
  if (bitrateMatch) {
    metaParts.push(bitrateMatch[1]);
  }

  if (track.default) {
    metaParts.push('Default');
  }

  return {
    title: mainTitle,
    subtitle: metaParts.join(' • '),
    flag: display.flag,
    langCode: langCode.length === 2 ? langCode : (display.tag ? display.tag.slice(0, 2).toUpperCase() : (track.type === 'audio' ? 'AU' : 'CC')),
    langName: langName || 'Unknown',
    isDefault: !!track.default,
    isForced,
  };
}
