import { createRenderer } from '@/utils';

import { registerBuiltinCommands } from './builtins';
import {
  getCommand,
  getCommands,
  isCommandLine,
  matchCommands,
  tokenize,
  type CommandContext,
  type CommandRow,
} from './commands';

const TAG = '[search-commands]';

const log = (...args: unknown[]) => console.log(TAG, ...args);

/** The parts of YTM's `ytmusic-search-box` this plugin drives. */
type SearchBox = HTMLElement & {
  opened: boolean;
  hasQuery: boolean;
  isSuggestedQuery: boolean;
  originalQuery: string;
  suggestionData: unknown[];
  searchBoxInput: HTMLInputElement;
};

type Watched = {
  el: SearchBox;
  input: HTMLInputElement;
  observer: MutationObserver;
};

let box: SearchBox | undefined;
let rows: CommandRow[] = [];
let selected = -1;
let watched: Watched | undefined;

/**
 * The search box an event came from.
 *
 * Everything here hangs off DOM events captured at the document rather than
 * YTM's own handlers: those are installed as own properties of the element by
 * YTM's lazy registration, and patching them did not stick. A capture-phase
 * listener is guaranteed by the DOM spec to run before anything the page
 * registered, whatever YTM does internally.
 */
const boxFrom = (event: Event): SearchBox | undefined => {
  const target = event.target;
  if (!(target instanceof Element)) return undefined;

  return target.closest<SearchBox>('ytmusic-search-box') ?? undefined;
};

/** Every native suggestion row currently rendered, in `rows` order. */
const suggestionElements = (el: SearchBox): HTMLElement[] =>
  Array.from(el.querySelectorAll<HTMLElement>('ytmusic-search-suggestion'));

/** Releases the native list back to YTM, but only if we were the ones using it. */
const release = () => {
  if (rows.length === 0) return;

  rows = [];
  selected = -1;
  if (box) box.suggestionData = [];
};

/**
 * Hands our rows to YTM's own autocomplete. `searchSuggestionRenderer` is the
 * plainest suggestion renderer — the same component and stylesheet YTM uses
 * for its own query suggestions, so it follows the theme for free.
 */
const render = () => {
  const el = box;
  if (!el) return;

  const { value } = el.searchBoxInput;

  if (!isCommandLine(value)) {
    release();
    return;
  }

  rows = matchCommands(value);
  selected = -1;
  el.suggestionData =
    rows.length === 0
      ? []
      : [
          {
            searchSuggestionsSectionRenderer: {
              contents: rows.map((row) => ({
                searchSuggestionRenderer: {
                  suggestion: { runs: [{ text: row.text }] },
                  icon: { iconType: 'SEARCH' },
                },
              })),
            },
          },
        ];

  log(
    'input:',
    value,
    '→ command line,',
    rows.length,
    'rows (native autocomplete)',
  );

  decorate();
};

/**
 * `ytmusic-search-suggestion` has no slot for a description, so hang one off
 * the row itself. Idempotent: the observer that calls this also sees our own
 * insertion.
 */
const decorate = () => {
  const el = box;
  if (!el || rows.length === 0) return;

  suggestionElements(el).forEach((element, index) => {
    const row = rows[index];
    if (!row || element.querySelector('.pcmd-desc')) return;

    const description = document.createElement('span');
    description.className = 'pcmd-desc';
    description.textContent = row.description;
    element.append(description);
  });
};

const highlight = (index: number) => {
  const el = box;
  if (!el) return;

  const elements = suggestionElements(el);

  if (selected >= 0)
    elements[selected]?.classList.remove('selected-suggestion');
  selected = index;

  const element = selected >= 0 ? elements[selected] : undefined;
  if (element) {
    // YTM's own highlight class, so it picks up the theme.
    element.classList.add('selected-suggestion');
    element.scrollIntoView({ block: 'nearest' });
  }
};

const moveSelection = (step: number) => {
  if (rows.length === 0) return;

  const next = selected + step;
  highlight(next < 0 ? rows.length - 1 : next >= rows.length ? 0 : next);
};

const unwatch = () => {
  watched?.input.removeEventListener('blur', onBlur);
  watched?.observer.disconnect();
  watched = undefined;
};

function onBlur() {
  release();
}

/**
 * Wires up the live element once we have seen it, and keeps descriptions on
 * the rows YTM renders from the data we hand it.
 */
const watchElement = (el: SearchBox) => {
  if (watched?.el === el) return;
  unwatch();

  const input = el.searchBoxInput;
  input.addEventListener('blur', onBlur);

  const observer = new MutationObserver(() => {
    if (box === el) decorate();
  });
  observer.observe(el, { childList: true, subtree: true });

  watched = { el, input, observer };
};

/** Remembers the element the event came from, and wires it up once. */
const track = (el: SearchBox) => {
  box = el;
  watchElement(el);
};

/** The state YTM's own `onInput` would have set, minus its suggestion request. */
const markCommandLine = (el: SearchBox) => {
  const { value } = el.searchBoxInput;

  el.opened = true;
  el.isSuggestedQuery = false;
  el.hasQuery = value.trim().length > 0;
  el.originalQuery = value;
};

const context = (): CommandContext => ({
  insert: (text) => {
    const el = box;
    if (!el) return;

    const { searchBoxInput } = el;
    searchBoxInput.value = text;
    searchBoxInput.focus();
    searchBoxInput.setSelectionRange(text.length, text.length);

    markCommandLine(el);
    render();
  },
});

/** Picking a row: click, or Enter on a highlighted one. */
const accept = async (row: CommandRow) => {
  const ctx = context();

  log(
    'accept:',
    row.text,
    row.command.onSelect ? '(command onSelect)' : '(default insert)',
  );

  if (row.command.onSelect) await row.command.onSelect(row, ctx);
  else ctx.insert(row.text);
};

/**
 * Row clicks arrive as `ytmusic-suggestion-activated` on the row, which YTM's
 * search box handles by searching. Stop it here and write the command line
 * into the box instead.
 */
const onSuggestionActivated = (event: Event) => {
  const el = boxFrom(event);
  if (!el || !isCommandLine(el.searchBoxInput.value)) return;

  const { suggestion } = (event as CustomEvent<{ suggestion?: string }>).detail;
  const row = rows.find((candidate) => candidate.text === suggestion);
  if (!row) return;

  event.stopImmediatePropagation();
  log('click: accepting row', row.text);
  accept(row);
};

const onDocumentInput = (event: Event) => {
  const el = boxFrom(event);
  if (!el) return;

  track(el);

  if (!isCommandLine(el.searchBoxInput.value)) {
    // Not ours: YTM's own onInput runs untouched and its autocomplete behaves
    // normally. `render` only drops our rows if we had taken the list over.
    release();
    return;
  }

  // Swallowing here is what keeps YTM's handler — and its suggestion request —
  // from running at all.
  event.stopImmediatePropagation();
  markCommandLine(el);
  render();
};

const onDocumentKey = (event: KeyboardEvent) => {
  const el = boxFrom(event);
  if (!el || !isCommandLine(el.searchBoxInput.value)) return;

  if (event.key === 'Enter') {
    const { value } = el.searchBoxInput;
    const picked = rows[selected];
    const name = tokenize(value)[0] ?? '';
    const command = getCommand(name);

    // Not a command we know about: leave the event alone and let YTM search.
    if (!picked && !command) {
      log('enter: no command named', name, '→ YTM searches');
      return;
    }

    // YTM binds Enter on `keypress`, so both events have to be stopped.
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.type !== 'keydown') return;

    track(el);

    if (picked) {
      log('enter: accepting highlighted row', picked.text);
      accept(picked);
      return;
    }

    const args = tokenize(value)
      .slice(1)
      .filter((arg) => arg !== '');

    log('enter: running', `/${name}`, 'with args', args);
    command?.run(args, context());
    el.opened = false;
    return;
  }

  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  if (event.type !== 'keydown') return;

  event.preventDefault();
  event.stopImmediatePropagation();

  track(el);
  moveSelection(event.key === 'ArrowUp' ? -1 : 1);
};

const LISTENERS: Array<[string, EventListener]> = [
  ['input', onDocumentInput as EventListener],
  ['keydown', onDocumentKey as EventListener],
  ['keypress', onDocumentKey as EventListener],
  ['ytmusic-suggestion-activated', onSuggestionActivated],
];

export const renderer = createRenderer({
  unregisterCommands: null as (() => void) | null,

  start(ctx) {
    log('renderer start');

    this.unregisterCommands = registerBuiltinCommands(ctx);
    log(
      'registered commands:',
      getCommands().map((command) => `/${command.name}`),
    );

    for (const [type, listener] of LISTENERS) {
      document.addEventListener(type, listener, true);
    }

    log('listening for "/" in the search box');
  },

  stop() {
    log('renderer stop');

    for (const [type, listener] of LISTENERS) {
      document.removeEventListener(type, listener, true);
    }

    this.unregisterCommands?.();
    this.unregisterCommands = null;

    release();
    unwatch();
    box = undefined;
  },
});
