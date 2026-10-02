/**
 * skip-ai-slop — Pear Desktop plugin (v3 draft)
 *
 * Copy to: src/plugins/skip-ai-slop/index.ts in a pear-desktop checkout, then
 * register it the same way the other plugins are registered (see how
 * src/plugins/skip-silences or sponsorblock are listed).
 *
 * Plugin shape (createPlugin, config, renderer.start/stop/onPlayerApiReady)
 * follows the "Creating a plugin" section of the pear-desktop README.
 *
 * STILL UNVERIFIED (could not read the real plugins' source):
 *  - that api.getPlayerResponse() and api.nextVideo() exist on the player API object
 * To avoid depending on app-internal event names, track changes are detected with
 * standard <video> element events instead of app-specific custom events.
 */
import { createPlugin } from '@/utils';
import type { RendererContext } from '@/types/plugins';

const BLACKLIST_URL =
  'https://raw.githubusercontent.com/bwedirhan/pear-desktop-ai-slop-filter/main/blacklist.json';
const CACHE_KEY = 'skip-ai-slop:blacklist';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_SCHEMA = 1;
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

const refreshList = async () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { data?: Blacklist; ts?: number };
      if (parsed.data?.version === SUPPORTED_SCHEMA) list = parsed.data;
      if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) return; // cache still fresh
    }
  } catch {
    // ignore corrupt cache
  }
  try {
    const res = await fetch(BLACKLIST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Blacklist;
    if (data.version !== SUPPORTED_SCHEMA) {
      console.warn('[skip-ai-slop] unsupported schema version', data.version);
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
  if (ids.some((id) => config.userAllow.includes(id))) return null;
  if (ids.some((id) => config.userBlock.includes(id))) return 'user-block';
  if (!list) return null;
  if (channelId && list.channels[channelId]) return 'channel';
  if (videoId && list.tracks[videoId]) return 'track';
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
  video?.addEventListener('loadedmetadata', check);
  check();
};

const detach = () => {
  video?.removeEventListener('loadedmetadata', check);
  video = null;
  lastCheckedId = null;
};

export default createPlugin({
  name: () => 'Skip AI Slop',
  restartNeeded: false,
  config: defaultConfig,

  renderer: {
    async start(context: RendererContext<Config>) {
      const cfg = await context.getConfig();
      config = { ...defaultConfig, ...cfg };
      active = true;
      await refreshList();
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
      detach();
    },
  },
});
