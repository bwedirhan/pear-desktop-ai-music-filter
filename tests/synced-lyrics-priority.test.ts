import { expect, test } from '@playwright/test';

import {
  pickWithStar,
  type ProviderName,
  providerNames,
  resolvePriority,
  type ProviderState,
} from '../src/plugins/synced-lyrics/providers';

import type {
  LineLyrics,
  LyricResult,
} from '../src/plugins/synced-lyrics/types';

const line = (text: string): LineLyrics => ({
  time: '0:00',
  timeInMs: 0,
  duration: 5000,
  status: 'current',
  text,
});

const result = (data: Partial<LyricResult>): LyricResult => ({
  title: 'Song',
  artists: ['Artist'],
  ...data,
});

/** Every provider, holding what `data` gives it (missing = nothing fetched). */
const states = (
  data: Partial<Record<ProviderName, LyricResult>>,
): Record<ProviderName, ProviderState> =>
  Object.fromEntries(
    providerNames.map((provider) => [
      provider,
      { state: 'done', data: data[provider] ?? null, error: null },
    ]),
  ) as Record<ProviderName, ProviderState>;

const pick = (options: {
  lyrics: Record<ProviderName, ProviderState>;
  priority?: readonly ProviderName[];
  preferSynced?: boolean;
  starred?: ProviderName | null;
  usePriorityList?: boolean;
  wantsOfficialTranslation?: boolean;
}) =>
  pickWithStar({
    priority: options.priority ?? [...providerNames],
    lyrics: options.lyrics,
    preferSynced: options.preferSynced ?? true,
    starred: options.starred ?? null,
    usePriorityList: options.usePriorityList ?? true,
    wantsOfficialTranslation: options.wantsOfficialTranslation ?? false,
  });

const plain = result({ lyrics: 'plain words' });
const synced = result({ lines: [line('synced line')] });

test('follows the declared order without a stored one', () => {
  expect(resolvePriority(undefined)).toEqual([...providerNames]);
});

test('names the stored providers first and appends the rest', () => {
  expect(resolvePriority(['NetEase', 'LRCLib'])).toEqual([
    'NetEase',
    'LRCLib',
    ...providerNames.filter(
      (provider) => provider !== 'NetEase' && provider !== 'LRCLib',
    ),
  ]);
});

test('drops unknown and duplicate entries instead of throwing', () => {
  const junk = ['Nope', 'NetEase', 'NetEase'] as unknown as ProviderName[];

  expect(resolvePriority(junk)[0]).toBe('NetEase');
  expect(resolvePriority(junk)).toHaveLength(providerNames.length);
  expect(resolvePriority('LRCLib' as unknown as ProviderName[])).toEqual([
    ...providerNames,
  ]);
});

test('walks the order, synced first and plain as the fallback', () => {
  const lyrics = states({ LRCLib: plain, NetEase: synced });

  // LRCLib is declared before NetEase.
  expect(pick({ lyrics, preferSynced: false })).toBe('LRCLib');
  expect(pick({ lyrics, preferSynced: true })).toBe('NetEase');
  expect(pick({ lyrics: states({ LRCLib: plain }), preferSynced: true })).toBe(
    'LRCLib',
  );
});

test('a starred provider wins while it has lyrics, and falls back when it does not', () => {
  const lyrics = states({ LRCLib: plain, NetEase: synced });

  expect(pick({ lyrics, starred: 'LRCLib' })).toBe('LRCLib');
  expect(pick({ lyrics, starred: 'YTMusic' })).toBe('NetEase');
});

test('with the list off, the better result wins over the configured order', () => {
  const lyrics = states({ YTMusic: synced, NetEase: plain });
  const priority = resolvePriority(['NetEase']);

  expect(pick({ lyrics, priority, preferSynced: false })).toBe('NetEase');
  expect(
    pick({ lyrics, priority, preferSynced: false, usePriorityList: false }),
  ).toBe('YTMusic');
});

test('with the list off, a wanted official translation is ranked first', () => {
  const lyrics = states({
    LRCLib: synced,
    NetEase: {
      ...synced,
      translation: { lines: [line('translated line')] },
    },
  });
  const priority = resolvePriority(['LRCLib']);

  const off = { lyrics, priority, usePriorityList: false } as const;

  expect(pick(off)).toBe('LRCLib');
  expect(pick({ ...off, wantsOfficialTranslation: true })).toBe('NetEase');
});
