import { expect, test } from '@playwright/test';

import {
  isCommandLine,
  matchCommands,
  tokenize,
  type Command,
} from '../src/plugins/search-commands/commands';
import { parseVideoId } from '../src/plugins/search-commands/video-id';

const command = (
  name: string,
  args?: Command['args'],
  description = `${name} description`,
): Command => ({
  name,
  args,
  description: () => description,
  run: () => {},
});

const commands: Command[] = [
  command('settings'),
  command('play', [{ name: 'url' }], 'Play a video'),
  command('playlist', [{ name: 'id' }, { name: 'index', optional: true }]),
  command('search', [{ name: 'query' }]),
];

const texts = (value: string) => matchCommands(value, commands).map((r) => r.text);

test('a bare slash lists every command', () => {
  expect(texts('/')).toEqual([
    '/play <url>',
    '/playlist <id> [index]',
    '/search <query>',
    '/settings',
  ]);
});

test('a partial name filters by prefix', () => {
  expect(texts('/pl')).toEqual(['/play <url>', '/playlist <id> [index]']);
});

test('an exact name sorts ahead of the commands it prefixes', () => {
  expect(texts('/play')).toEqual(['/play <url>', '/playlist <id> [index]']);
});

test('a fully typed name previews its arguments as placeholders', () => {
  const [row] = matchCommands('/play', commands);
  expect(row.text).toBe('/play <url>');
  expect(row.args).toEqual(['<url>']);
  expect(row.description).toBe('Play a video');
});

test('typed arguments replace their placeholders, left to right', () => {
  expect(texts('/play sOmEiD')).toEqual(['/play sOmEiD']);
  expect(texts('/playlist PL123')).toEqual(['/playlist PL123 [index]']);
  expect(texts('/playlist PL123 4')).toEqual(['/playlist PL123 4']);
});

test('a trailing space keeps the placeholder visible while typing', () => {
  expect(texts('/play ')).toEqual(['/play <url>']);
});

test('arguments past the declared ones are ignored', () => {
  expect(texts('/play a b c')).toEqual(['/play a']);
});

test('an unknown name with arguments matches nothing', () => {
  expect(texts('/nope x')).toEqual([]);
  expect(texts('/nope')).toEqual([]);
});

test('optional arguments render as [name]', () => {
  const [row] = matchCommands('/playlist', commands);
  expect(row.text).toBe('/playlist <id> [index]');
});

test('only a leading slash is a command line', () => {
  expect(isCommandLine('/play')).toBe(true);
  expect(isCommandLine('play')).toBe(false);
  expect(isCommandLine('')).toBe(false);
});

test('tokenize drops the slash', () => {
  expect(tokenize('/play a b')).toEqual(['play', 'a', 'b']);
  expect(tokenize('/')).toEqual(['']);
});

test('parseVideoId accepts ids, short links and watch urls', () => {
  expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  expect(parseVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe(
    'dQw4w9WgXcQ',
  );
});

test('parseVideoId rejects anything without a video id', () => {
  for (const input of [
    '',
    'not a url',
    'https://music.youtube.com/',
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/',
    'dQw4w9WgXc', // 10 characters
  ]) {
    expect(parseVideoId(input)).toBeUndefined();
  }
});
