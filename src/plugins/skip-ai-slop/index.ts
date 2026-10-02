/**
 * skip-ai-slop — Pear Desktop plugin (v4 draft)
 *
 * Copy to: src/plugins/skip-ai-slop/index.ts in a pear-desktop checkout, then
 * register it the same way the other plugins are registered (see how
 * src/plugins/skip-silences or sponsorblock are listed).
 *
 * Plugin shape (createPlugin, config, renderer.start/stop/onPlayerApiReady)
 * follows the "Creating a plugin" section of the pear-desktop README.
 *
 * STILL UNVERIFIED (test in the running app):
 *  - that api.getPlayerResponse() and api.nextVideo() exist on the player API object
 *  - that context.getConfig() and onConfigChange exist with these signatures
 *  - that fetch() to raw.githubusercontent.com is allowed by the page CSP
 *    (if not, move the download to the plugin's backend and pass it over IPC)
 *  - that getPlayerResponse() already returns the NEW track when 'loadedmetadata'
 *    fires (if not, 'durationchange' below acts as a second chance)
 *
 * To avoid depending on app-internal event names, track changes are detected with
 * standard <video> element events instead of app-specific custom events.
 */
import { createPlugin } from '@/utils';

const BLACKLIST_URL =
  'https://raw.githubusercontent.com/bwedirhan/pear-desktop-ai-slop-filter/main/blacklist.json';
const CACHE_KEY = 'skip-ai-slop:blacklist';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // re-check hourly; refreshList() exits early while cache is fresh
const SUPPORTED_SCHEMA = 2;
const MAX_SKIPS = 5; // safety: stop skipping if this many skips happen...
const SKIP_WINDOW_MS = 10_000; // ...within this window (e.g. whole queue is blacklisted)

type Entry = { name?: string; title?: string; reason?: string; added_at?: string };
type Blacklist = {
  version: number;
  updated_at: string;
  channels: Record<string, Entry>;
  tracks: Record<string, Entry>;
};
type Config = {
  enabled: boolean;
  userAllow: string[]; // channelIds / videoIds that are never skipped
  userBlock: string[]; // channelIds / videoIds that are always skipped
};

const defaultConfig: Config = { enabled: false, userAllow: [], userBlock: [] };

let list: Blacklist | null = null;
let config: Config = defaultConfig;
let api: any = null;
let active = false;
let video: HTMLVideoElement | null = null;
let lastCheckedId: string | null = null;
let recentSkips: number[] = [];
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const isValid = (d: any): d is Blacklist =>
  !!d &&
  d.version === SUPPORTED_SCHEMA &&
  typeof d.channels === 'object' &&
  d.channels !== null &&
  typeof d.tracks === 'object' &&
  d.tracks !== null;

const has = (o: Record<string, Entry>, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

const refreshList = async () => {
  let fresh = false;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { data?: unknown; ts?: number };
      if (isValid(parsed.data)) {
        list = parsed.data;
        fresh = !!parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS;
      }
    }
  } catch {
    // ignore corrupt cache
  }
  if (fresh) return; // valid cache that is still fresh

  try {
    const res = await fetch(BLACKLIST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!isValid(data)) {
      console.warn('[skip-ai-slop] invalid or unsupported blacklist, keeping old list');
      return;
    }
    list = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (err) {
    console.warn('[skip-ai-slop] refresh failed; using cached list if any', err);
  }
};

const reasonToSkip = (videoId?: string, channelId?: string): string | null => {
  const ids = [videoId, channelId].filter(Boolean) as string[];
  if (ids.some((id) => config.userAllow.includes(id))) return null; // allow always wins
  if (ids.some((id) => config.userBlock.includes(id))) return 'user-block';
  if (!list) return null;
  if (channelId && has(list.channels, channelId)) return 'channel';
  if (videoId && has(list.tracks, videoId)) return 'track';
  return null;
};

const canSkipNow = () => {
  const now = Date.now();
  recentSkips = recentSkips.filter((t) => now - t < SKIP_WINDOW_MS);
  return recentSkips.length < MAX_SKIPS;
};

const check = () => {
  if (!active || !api) return;
  const details = api.getPlayerResponse?.()?.videoDetails;
  const videoId: string | undefined = details?.videoId;
  const channelId: string | undefined = details?.channelId;
  if (!videoId || videoId === lastCheckedId) return;
  lastCheckedId = videoId;

  const reason = reasonToSkip(videoId, channelId);
  if (!reason) return;
  if (!canSkipNow()) {
    console.warn('[skip-ai-slop] skip limit reached, not skipping', videoId);
    return;
  }
  recentSkips.push(Date.now());
  console.info(`[skip-ai-slop] skipping ${videoId} (${reason})`);
  api.nextVideo();
};

const attach = () => {
  if (!api || video) return;
  video = document.querySelector('video');
  // 'loadedmetadata' fires for every new track on the same <video> element.
  // 'durationchange' is a second chance in case player info updates slightly later;
  // the lastCheckedId guard in check() prevents double handling.
  video?.addEventListener('loadedmetadata', check);
  video?.addEventListener('durationchange', check);
  check();
};

const detach = () => {
  video?.removeEventListener('loadedmetadata', check);
  video?.removeEventListener('durationchange', check);
  video = null;
  lastCheckedId = null;
};

export default createPlugin({
  name: () => 'Skip AI Slop',
  restartNeeded: false,
  config: defaultConfig,

  renderer: {
    async start(context) {
      const cfg = await context.getConfig();
      config = { ...defaultConfig, ...cfg };
      active = true;
      await refreshList();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(refreshList, REFRESH_INTERVAL_MS);
      attach(); // no-op until onPlayerApiReady has provided the api
    },

    onPlayerApiReady(playerApi: any) {
      api = playerApi;
      if (active) attach();
    },

    onConfigChange(newConfig: Config) {
      config = { ...defaultConfig, ...newConfig };
    },

    stop() {
      active = false;
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
      recentSkips = [];
      detach();
    },
  },
});
