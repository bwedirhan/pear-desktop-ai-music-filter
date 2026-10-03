export type KeywordEntry = { text: string; enabled: boolean };
export type ChannelEntry = { id: string; name: string };

export type SkipAiSlopConfig = {
  enabled: boolean;
  userAllow: ChannelEntry[]; // channels that are never filtered (always wins)
  userBlock: ChannelEntry[]; // channels that are always filtered
  keywords: KeywordEntry[]; // filter when title or channel name contains one
  reportFeedback: boolean; // send YouTube "not interested" for flagged recommendation cards
  hideInPages: boolean; // hide flagged results on every page (search, home, lists)
};

export const defaultConfig: SkipAiSlopConfig = {
  enabled: false,
  userAllow: [],
  userBlock: [],
  keywords: [],
  reportFeedback: false,
  hideInPages: true,
};

/** Tolerates missing / old-format values (plain strings) in a stored config. */
export const normalizeKeywords = (raw: unknown): KeywordEntry[] => {
  if (!Array.isArray(raw)) return [];
  const out: KeywordEntry[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ text: item.trim(), enabled: true });
    } else if (item && typeof item.text === 'string' && item.text.trim()) {
      out.push({ text: item.text.trim(), enabled: item.enabled !== false });
    }
  }
  return out;
};

/**
 * Turns a keyword into a matcher that finds it as a WHOLE word (or phrase),
 * case-insensitively: "ai" matches "AI Cover" but not "Mai" or "Tchaikovsky".
 * Shared by index.ts and early.ts so both judge keywords the same way.
 * The regex has no `g` flag, so `.test()` keeps no state between calls.
 */
export const compileKeyword = (text: string): RegExp | null => {
  const t = text.trim();
  if (!t) return null;
  const body = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const edge = '[\\p{L}\\p{N}]';
  return new RegExp(`(?<!${edge})${body}(?!${edge})`, 'iu');
};

/** Enabled keywords of a stored config, compiled. */
export const compileKeywords = (raw: unknown): RegExp[] =>
  normalizeKeywords(raw)
    .filter((k) => k.enabled)
    .map((k) => compileKeyword(k.text))
    .filter((r): r is RegExp => !!r);

/** Accepts old plain-ID strings as well as { id, name } entries. */
export const normalizeChannels = (raw: unknown): ChannelEntry[] => {
  if (!Array.isArray(raw)) return [];
  const out: ChannelEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = typeof item === 'string' ? item : item?.id;
    if (typeof id !== 'string' || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: typeof item?.name === 'string' && item.name ? item.name : id,
    });
  }
  return out;
};

// ---- recently filtered channels (shown in settings so false positives can be
// allowed with one click). Kept in localStorage: it changes on every scan and
// does not belong in the plugin config.
export type RecentEntry = { id: string; name: string; reason: string };
const RECENT_KEY = 'skip-ai-slop:recent';
const RECENT_MAX = 60;
let recentCache: RecentEntry[] | null = null;

export const readRecentFiltered = (): RecentEntry[] => {
  if (recentCache) return recentCache;
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    recentCache = Array.isArray(raw) ? raw : [];
  } catch {
    recentCache = [];
  }
  return recentCache!;
};

export const recordFiltered = (entry: RecentEntry) => {
  const list = readRecentFiltered();
  if (list.some((e) => e.id === entry.id)) return; // only writes when something is new
  recentCache = [entry, ...list].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentCache));
  } catch {
    /* ignore */
  }
};

export const forgetFiltered = (id: string) => {
  recentCache = readRecentFiltered().filter((e) => e.id !== id);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentCache));
  } catch {
    /* ignore */
  }
};
