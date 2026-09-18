/**
 * OpenPulse Telemetry Integration for CloudStream Desktop
 * Connects directly to the OpenPulse high-velocity ingestion pipeline.
 */

const OPENPULSE_ENDPOINT = 'https://openpulse-ten.vercel.app/api/ingest';
const OPENPULSE_API_KEY = 'op_live_931be7475138b7a5888fd00589f5567c';
const STORAGE_KEY_DISTINCT_ID = 'openpulse_distinct_id';

/**
 * Retrieves or generates a persistent anonymous installation ID.
 */
export function getDistinctId(): string {
  if (typeof window === 'undefined') return 'server_desktop';
  try {
    let id = localStorage.getItem(STORAGE_KEY_DISTINCT_ID);
    if (!id) {
      id = 'cs_desk_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(STORAGE_KEY_DISTINCT_ID, id);
    }
    return id;
  } catch {
    return 'cs_desk_fallback';
  }
}

/**
 * Resolves regional location based on client timezone.
 */
function resolveCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Dhaka') || tz.includes('Asia/Dhaka')) return 'Bangladesh';
    if (tz.includes('Calcutta') || tz.includes('Kolkata')) return 'India';
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('America')) return 'United States';
    if (tz.includes('London') || tz.includes('Europe/London')) return 'United Kingdom';
    if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Rome')) return 'Germany';
    if (tz.includes('Tokyo') || tz.includes('Asia/Tokyo')) return 'Japan';
    if (tz.includes('Singapore')) return 'Singapore';
    return 'Bangladesh';
  } catch {
    return 'Bangladesh';
  }
}

/**
 * Emits a telemetry event asynchronously without blocking UI or media playback.
 */
export async function track(event: string, properties: Record<string, any> = {}): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const distinctId = getDistinctId();
    const os = navigator.userAgent.includes('Windows')
      ? 'Windows'
      : navigator.userAgent.includes('Mac')
      ? 'macOS'
      : 'Linux';

    const path = properties.path || properties.screen || (event === '$screen_view' ? '/home' : `/${event.replace('$', '')}`);

    await fetch(OPENPULSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenPulse-Key': OPENPULSE_API_KEY,
      },
      body: JSON.stringify({
        event,
        distinctId,
        properties: {
          app: 'CloudStream-Desktop',
          platform: 'desktop_tauri',
          os,
          browser: 'CloudStream Desktop',
          country: resolveCountry(),
          path,
          timestamp: new Date().toISOString(),
          ...properties,
        },
      }),
    });
  } catch {
    // Fail silently in development/offline so user experience is never degraded
  }
}

/**
 * Track navigation between views (Home, Search, Library, Settings, Player, Plugins, Downloads).
 */
export function trackScreen(screen: string, extra: Record<string, any> = {}) {
  const normalizedPath = screen.startsWith('/') ? screen : `/${screen}`;
  return track('$screen_view', {
    screen: normalizedPath,
    path: normalizedPath,
    ...extra,
  });
}

/**
 * Track media playback operations (play, pause, ended, error).
 */
export function trackPlayback(
  action: 'play' | 'pause' | 'buffer' | 'ended' | 'error',
  details: {
    title?: string;
    provider?: string;
    season?: number;
    episode?: number;
    positionSec?: number;
    durationSec?: number;
    quality?: string;
    offline?: boolean;
    tv_type?: string;
    error?: string;
    [key: string]: any;
  } = {}
) {
  return track(`video_${action}`, {
    ...details,
    path: '/player',
  });
}

/**
 * Track content search and discovery queries.
 */
export function trackSearch(query: string, resultsCount: number, provider?: string) {
  return track('search_query', {
    query,
    results_count: resultsCount,
    provider: provider || 'all',
    path: '/search',
  });
}

/**
 * Track provider plugin installation, update, or selection.
 */
export function trackProvider(
  action: 'installed' | 'selected' | 'uninstalled' | 'error',
  providerName: string,
  meta: Record<string, any> = {}
) {
  return track(`provider_${action}`, {
    provider: providerName,
    path: '/plugins',
    ...meta,
  });
}

/**
 * Initializes automatic application lifecycle events and global error logging.
 */
export function initTelemetry(): void {
  if (typeof window === 'undefined') return;

  // 1. Send Application Launch Telemetry
  track('app_open', {
    version: '0.1.0',
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    device_pixel_ratio: window.devicePixelRatio || 1,
    path: '/app',
  });

  // 2. Track initial screen view
  trackScreen('/home', { initial: true });

  // 3. Global Uncaught JavaScript Exception Listener
  window.addEventListener('error', (event) => {
    track('error_thrown', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack?.substring(0, 500),
      path: window.location?.pathname || '/app',
    });
  });

  // 4. Global Unhandled Promise Rejection Listener
  window.addEventListener('unhandledrejection', (event) => {
    track('error_thrown', {
      type: 'unhandledrejection',
      reason: String(event.reason),
      path: window.location?.pathname || '/app',
    });
  });

  // 5. Automatic periodic active session heartbeat (every 25 seconds)
  setInterval(() => {
    track('$heartbeat', {
      path: window.location?.pathname || '/app',
    });
  }, 25000);
}

