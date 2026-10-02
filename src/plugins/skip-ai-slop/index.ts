/**
 * skip-ai-slop — Pear Desktop plugin (draft)
 *
 * Place at: src/plugins/skip-ai-slop/index.ts inside a pear-desktop checkout
 * (plugins are built into the app; they are not loose files dropped into a folder).
 *
 * VERIFY BEFORE USE (written without running against the app):
 *  1. the 'videodatachange' document event and its event.detail.name === 'dataloaded'
 *  2. api.getPlayerResponse()?.videoDetails (videoId / channelId)
 *  3. api.nextVideo()
 *  4. the config shape / context.getConfig signature in your pear-desktop version
 * Compare with src/plugins/sponsorblock and skip-silences, which use the same hooks.
 */
import { createPlugin } from '@/utils';

const OWNER = 'YOUR_GITHUB_USER'; // TODO: set after creating the repo
const REPO = 'pear-desktop-ai-slop-filter';
const BLACKLIST_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/blacklist.json`;
const CACHE_KEY = 'skip-ai-slop:blacklist';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_SCHEMA = 1;

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
let lastSkippedId: string | null = null;


const refreshList = async () => {
  let cached: { data: Blacklist; fresh: boolean } | null = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      cached = { data, fresh: Date.now() - ts < CACHE_TTL_MS };
    }
  } catch {
    cached = null;
  }
  if (cached) list = cached.data;
  if (cached?.fresh) return;

  try {
    const res = await fetch(BLACKLIST_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Blacklist;
    if (data.version !== SUPPORTED_SCHEMA) {
      console.warn('[skip-ai-slop] unsupported blacklist schema', data.version);
      return;
    }
    list = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (err) {
    console.warn('[skip-ai-slop] refresh failed, using cache if any', err);
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

export default createPlugin({
  name: 'Skip AI Slop',
  restartNeeded: false,
  config: defaultConfig,

  renderer: {
    async start({ getConfig }: { getConfig: () => Promise<Config> }) {
      config = { ...defaultConfig, ...(await getConfig()) };
      await refreshList();
    },

    onConfigChange(newConfig: Config) {
      config = { ...defaultConfig, ...newConfig };
    },

    onPlayerApiReady(api: any) {
      const check = () => {
        if (!config.enabled) return;
        const details = api.getPlayerResponse?.()?.videoDetails;
        const videoId: string | undefined = details?.videoId;
        const channelId: string | undefined = details?.channelId;
        if (!videoId || videoId === lastSkippedId) return;

        const reason = reasonToSkip(videoId, channelId);
        if (reason) {
          lastSkippedId = videoId;
          console.info(`[skip-ai-slop] skipping ${videoId} (${reason})`);
          api.nextVideo();
        }
      };

      document.addEventListener('videodatachange', (e: Event) => {
        if ((e as CustomEvent).detail?.name === 'dataloaded') check();
      });
    },

    stop() {
      // listeners are page-scoped; nothing persistent to tear down in this draft
    },
  },
});
