import { expect, test } from '@playwright/test';

import { buildLabel, channel, commit, copyright } from '../src/app-info';

test('unbaked builds are dev builds', () => {
  expect(channel).toBe('dev');
  expect(commit).toBe('');
  expect(buildLabel()).toBe('dev');
});

test('beta and dev builds show their commit, stable does not', () => {
  expect(buildLabel('beta', '1a2b3c4')).toBe('beta 1a2b3c4');
  expect(buildLabel('dev', '1a2b3c4')).toBe('dev 1a2b3c4');
  expect(buildLabel('stable', '1a2b3c4')).toBe('stable');
});

test('a build with no known commit still names its channel', () => {
  expect(buildLabel('beta', '')).toBe('beta');
});

test('copyright credits upstream and the fork, one line each', () => {
  const lines = copyright.split('\n');
  expect(lines).toHaveLength(2);
  for (const line of lines) expect(line).toMatch(/^Copyright \(c\) \S+/);
  expect(lines[0]).toContain('th-ch');
  expect(lines[1]).toContain('Mikey');
  expect(copyright).not.toContain('http');
});
