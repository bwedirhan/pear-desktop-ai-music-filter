import { expect, test } from '@playwright/test';

import { classifyLink } from '../src/providers/external-links';

const APP_URL = 'https://music.youtube.com';

test('google and youtube links stay in the app', () => {
  for (const url of [
    'https://music.youtube.com/watch?v=abc123',
    'https://www.youtube.com/watch?v=abc123',
    'https://youtube.com/',
    'https://consent.youtube.com/save',
    'https://youtu.be/abc123',
    'https://accounts.google.com/ServiceLogin',
    'https://policies.google.com/privacy',
    'about:blank',
  ]) {
    expect(classifyLink(url, APP_URL), url).toBe('in-app');
  }
});

test('anything else goes to the user browser', () => {
  for (const url of [
    'https://example.com/article',
    'https://bandcamp.com/album/x',
    'https://notyoutube.com/watch?v=abc123',
    'https://evil-youtube.com/',
    'https://youtube.com.evil.com/',
    'http://localhost:3000/',
    'mailto:someone@example.com',
    'tel:+1234567890',
  ]) {
    expect(classifyLink(url, APP_URL), url).toBe('external');
  }
});

test('links that cannot leave the app are dropped instead of opened', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,<h1>hi</h1>',
    'file:///etc/passwd',
    'not a url',
  ]) {
    expect(classifyLink(url, APP_URL), url).toBe('blocked');
  }
});

test('a custom app url is treated as the app itself', () => {
  expect(
    classifyLink('https://ytm.example.com/browse', 'https://ytm.example.com'),
  ).toBe('in-app');
  expect(classifyLink('https://example.com/', '')).toBe('external');
});
