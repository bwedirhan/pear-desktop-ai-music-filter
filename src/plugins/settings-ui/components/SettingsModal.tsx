import {
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { allPlugins, rendererPlugins } from 'virtual:plugins';

import { t } from '@/i18n';
import { toSettingsGroups, type SettingsGroup } from '@/types/settings';

import { AboutSection } from './AboutSection';
import { Icon } from './Icon';
import { PluginCard } from './PluginCard';
import { SettingsField } from './SettingsField';

import { filterGroupsByPlatform } from '../platform';
import { buildAppSections } from '../schema/app-settings';
import {
  bridge,
  flushPendingPluginSliderWrites,
  getAppValue,
  getByPath,
  getPluginConfig,
  setAppValue,
  setPluginValue,
  setPluginSliderValue,
  store,
} from '../state';

import type { RestartRequirement } from '@/types/restart';

interface PluginMeta {
  id: string;
  name: string;
  description?: string;
  restartNeeded: boolean;
  config: Record<string, unknown>;
  groups: SettingsGroup[];
}

const matches = (query: string, ...parts: (string | undefined)[]) =>
  parts.filter(Boolean).some((p) => p.toLowerCase().includes(query));

const restartRequirementKey = (requirement: RestartRequirement) =>
  requirement.type === 'plugin'
    ? `plugin:${requirement.id}`
    : `setting:${requirement.label}`;

export const SettingsModal = (props: {
  onClose: () => void;
  /** Set while the exit animation plays; the renderer unmounts afterwards. */
  closing?: boolean;
  standalone?: boolean;
}) => {
  const [active, setActive] = createSignal<string>('general');
  const [query, setQuery] = createSignal('');
  const [expanded, setExpanded] = createSignal<ReadonlySet<string>>(new Set());
  const [restartFlagged, setRestartFlagged] = createSignal(false);
  const [restartRequirements, setRestartRequirements] = createSignal<
    RestartRequirement[]
  >([]);
  let isClosing = false;
  let searchInputRef: HTMLInputElement | undefined;
  let previousFocus: HTMLElement | null = null;

  const [appSections] = createResource(() =>
    buildAppSections().map((section) => ({
      ...section,
      groups: filterGroupsByPlatform(section.groups),
    })),
  );
  const [appMeta] = createResource(() => bridge.appMeta());
  const [rendererDefs] = createResource(() => rendererPlugins());

  const [plugins] = createResource<PluginMeta[]>(async () => {
    const stubs = await allPlugins();
    return Object.entries(stubs)
      .filter(([id]) => id !== 'settings-ui')
      .map(([id, def]) => ({
        id,
        name: def.name?.() ?? id,
        description: def.description?.(),
        restartNeeded: Boolean(def.restartNeeded),
        config: (def.config ?? { enabled: false }) as Record<string, unknown>,
        groups: def.settings
          ? filterGroupsByPlatform(toSettingsGroups(def.settings))
          : [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** Resolve a `"<pluginId>.<name>"` custom field component. */
  const resolveComponent = (id: string) => {
    const dot = id.indexOf('.');
    if (dot < 0) return undefined;

    const renderer = rendererDefs()?.[id.slice(0, dot)]?.renderer;
    if (!renderer || typeof renderer === 'function') return undefined;

    return renderer.components?.[id.slice(dot + 1)];
  };

  onMount(() => {
    bridge.restartSessionOpen();

    // Move focus into the dialog, restoring it to the trigger on close.
    previousFocus = document.activeElement as HTMLElement | null;
    searchInputRef?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => {
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus?.();
    });
  });

  const enabledPlugins = createMemo(() => {
    const snap = store();
    if (!snap) return [] as PluginMeta[];

    return (plugins() ?? []).filter(
      (p) =>
        (snap.plugins as Record<string, { enabled?: boolean }>)[p.id]
          ?.enabled ?? (p.config.enabled as boolean),
    );
  });

  const flagIfRestart = (
    requirement: RestartRequirement,
    needsRestart?: boolean,
  ) => {
    if (!needsRestart) return;

    setRestartFlagged(true);
    setRestartRequirements((current) =>
      current.some(
        (item) =>
          restartRequirementKey(item) === restartRequirementKey(requirement),
      )
        ? current
        : [...current, requirement],
    );
  };

  const close = async () => {
    if (isClosing) return;
    isClosing = true;

    const requirements = restartRequirements();
    // Flush debounced slider writes before the window closes so recent
    // changes aren't lost.
    await flushPendingPluginSliderWrites();
    props.onClose();
    bridge.restartSessionClose(requirements);
  };

  const closeNow = async () => {
    await flushPendingPluginSliderWrites();
    bridge.restart();
  };

  // ---- app-option value plumbing ----
  const appVal = (key: string) => {
    const snap = store();
    return snap ? getAppValue(snap, key) : undefined;
  };
  const appSet = (
    key: string,
    value: unknown,
    label: string,
    needsRestart?: boolean,
  ) => {
    setAppValue(key, value);
    flagIfRestart({ type: 'setting', label }, needsRestart);
  };

  // ---- plugin value plumbing ----
  const pluginVal = (meta: PluginMeta, key: string) => {
    const snap = store();
    if (!snap) return undefined;
    return getByPath(getPluginConfig(snap, meta.id, meta.config), key);
  };
  const pluginEnabled = (meta: PluginMeta) => {
    const snap = store();
    const stored = snap
      ? (snap.plugins as Record<string, { enabled?: boolean }>)[meta.id]
      : undefined;
    return stored?.enabled ?? (meta.config.enabled as boolean);
  };
  const togglePlugin = (meta: PluginMeta, value: boolean) => {
    bridge.pluginToggle(meta.id, value);
    flagIfRestart({ type: 'plugin', id: meta.id }, meta.restartNeeded);
  };

  const sections = () => appSections() ?? [];
  const currentSection = () => sections().find((s) => s.id === active());

  const isSearching = () => query().trim().length > 0;

  const headerTitle = () => {
    if (isSearching()) return t('settings-ui.search-results');
    return currentSection()?.label() ?? '';
  };

  // ---- search result computation ----
  const searchAppGroups = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [] as { title: string; group: SettingsGroup }[];

    const out: { title: string; group: SettingsGroup }[] = [];
    for (const section of sections()) {
      for (const group of section.groups) {
        const fields = group.fields.filter((f) =>
          matches(q, f.label(), f.description?.()),
        );
        if (fields.length)
          out.push({
            title: `${section.label()} · ${group.title?.() ?? ''}`,
            group: { fields },
          });
      }
    }
    return out;
  });

  const searchPlugins = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return [] as { meta: PluginMeta; groups: SettingsGroup[] }[];

    const out: { meta: PluginMeta; groups: SettingsGroup[] }[] = [];
    for (const meta of plugins() ?? []) {
      if (matches(q, meta.name, meta.description)) {
        out.push({ meta, groups: meta.groups });
        continue;
      }

      const groups = meta.groups
        .map((g) => ({
          ...g,
          fields: g.fields.filter((f) =>
            matches(q, f.label(), f.description?.()),
          ),
        }))
        .filter((g) => g.fields.length);
      if (groups.length) out.push({ meta, groups });
    }
    return out;
  });

  const searchEmpty = () =>
    isSearching() &&
    searchAppGroups().length === 0 &&
    searchPlugins().length === 0;

  const AppGroupView = (p: { title?: string; group: SettingsGroup }) => (
    <div class="sui-group">
      <Show when={p.title}>
        <div class="sui-group__title">{p.title}</div>
      </Show>
      <div class="sui-group__card">
        <For each={p.group.fields.filter((field) => field.visible?.() ?? true)}>
          {(field) => (
            <SettingsField
              accessors={{
                getValue: appVal,
                setValue: (key, v) => {
                  setAppValue(key, v);
                },
                setSliderValue: (key, v) => {
                  setAppValue(key, v);
                },
              }}
              field={field}
              onChange={(v) =>
                appSet(field.key, v, field.label(), field.restartNeeded)
              }
              resolveComponent={resolveComponent}
              value={appVal(field.key)}
            />
          )}
        </For>
      </div>
    </div>
  );

  /**
   * Only the changed field decides this. A plugin's own `restartNeeded` is
   * about enabling or disabling it (see togglePlugin), not about its settings:
   * crossfade needs a restart to turn on, but not to change a fade duration.
   */
  const fieldNeedsRestart = (
    p: { groups: SettingsGroup[] },
    key: string,
  ): boolean =>
    p.groups.some((group) =>
      group.fields.some((field) => field.key === key && field.restartNeeded),
    );

  const PluginCardView = (p: { meta: PluginMeta; groups: SettingsGroup[] }) => (
    <PluginCard
      description={p.meta.description}
      enabled={pluginEnabled(p.meta)}
      expanded={expanded().has(p.meta.id)}
      getValue={(key) => pluginVal(p.meta, key)}
      groups={p.groups}
      hasSettings={p.groups.length > 0}
      name={p.meta.name}
      onExpand={() =>
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(p.meta.id)) next.delete(p.meta.id);
          else next.add(p.meta.id);
          return next;
        })
      }
      onToggle={(v) => togglePlugin(p.meta, v)}
      resolveComponent={resolveComponent}
      restartNeeded={p.meta.restartNeeded}
      setSliderValue={(key, v) => {
        setPluginSliderValue(p.meta.id, key, v);
        flagIfRestart(
          { type: 'plugin', id: p.meta.id },
          fieldNeedsRestart(p, key),
        );
      }}
      setValue={(key, v) => {
        setPluginValue(p.meta.id, key, v);
        flagIfRestart(
          { type: 'plugin', id: p.meta.id },
          fieldNeedsRestart(p, key),
        );
      }}
    />
  );

  return (
    <div
      class="sui-root"
      classList={{
        'sui-root--standalone': props.standalone,
        'sui-root--closing': props.closing,
      }}
    >
      <Show when={!props.standalone}>
        <div class="sui-scrim" onClick={close} />
      </Show>

      <div aria-modal="true" class="sui-modal" role="dialog">
        {/* sidebar */}
        <aside class="sui-sidebar">
          <div class="sui-sidebar__head">
            <div class="sui-sidebar__title">{t('settings-ui.title')}</div>
          </div>

          <div class="sui-search">
            <Icon name="search" size={20} />
            <input
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder={t('settings-ui.search-placeholder')}
              ref={(el) => (searchInputRef = el)}
              type="text"
              value={query()}
            />
          </div>

          <nav class="sui-nav">
            <For each={sections()}>
              {(section) => (
                <button
                  class="sui-nav__item"
                  classList={{
                    'sui-nav__item--active':
                      !isSearching() && active() === section.id,
                  }}
                  onClick={() => {
                    setActive(section.id);
                    setQuery('');
                    // Switching sections starts them all collapsed again.
                    setExpanded(new Set<string>());
                  }}
                  type="button"
                >
                  <Icon name={section.icon} size={20} />
                  <span>{section.label()}</span>
                  <Show when={section.id === 'plugins'}>
                    <span class="sui-nav__count">
                      {enabledPlugins().length}/{(plugins() ?? []).length}
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </nav>

          <div class="sui-sidebar__foot">
            <span>v{appMeta()?.version ?? ''}</span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                bridge.configEdit();
              }}
            >
              {t('settings-ui.edit-config')}
            </a>
          </div>
        </aside>

        {/* main */}
        <section class="sui-main">
          <header class="sui-header">
            <div class="sui-header__text">
              <div class="sui-header__title">{headerTitle()}</div>
              {/* Only the live search line; sections dont get a subtitle. */}
              <Show when={isSearching()}>
                <div class="sui-header__sub">
                  {t('settings-ui.search-matching', {
                    query: query().trim(),
                  })}
                </div>
              </Show>
            </div>
            <button
              aria-label={t('settings-ui.close')}
              class="sui-iconbtn"
              onClick={close}
              type="button"
            >
              <Icon name="close" size={22} />
            </button>
          </header>

          <div class="sui-body">
            {/* Always mounted so it can animate out; `inert` keeps the hidden
                buttons out of the tab order. */}
            <div
              class="sui-restart"
              classList={{ 'sui-restart--open': restartFlagged() }}
              inert={!restartFlagged()}
            >
              <Icon name="schedule" size={20} />
              <span class="sui-restart__text">
                {t('settings-ui.restart-banner')}
              </span>
              <button
                class="sui-restart__later"
                onClick={() => setRestartFlagged(false)}
                type="button"
              >
                {t('settings-ui.later')}
              </button>
              <button class="sui-restart__now" onClick={closeNow} type="button">
                {t('settings-ui.restart-now')}
              </button>
            </div>

            <Show fallback={<div class="sui-empty">…</div>} when={store()}>
              {/* search mode */}
              <Show when={isSearching()}>
                <Show when={searchEmpty()}>
                  <div class="sui-empty">
                    {t('settings-ui.no-match', { query: query().trim() })}
                  </div>
                </Show>
                <For each={searchAppGroups()}>
                  {(block) => (
                    <AppGroupView group={block.group} title={block.title} />
                  )}
                </For>
                <For each={searchPlugins()}>
                  {(block) => (
                    <PluginCardView groups={block.groups} meta={block.meta} />
                  )}
                </For>
              </Show>

              {/* section mode */}
              <Show when={!isSearching()}>
                <For each={currentSection()?.groups ?? []}>
                  {(group) => (
                    <AppGroupView group={group} title={group.title?.()} />
                  )}
                </For>

                <Show when={active() === 'plugins'}>
                  <For each={plugins()}>
                    {(meta) => (
                      <PluginCardView groups={meta.groups} meta={meta} />
                    )}
                  </For>
                </Show>

                <Show when={active() === 'about'}>
                  <AboutSection
                    enabledPlugins={enabledPlugins().map((p) => p.name)}
                    meta={appMeta()}
                  />
                </Show>
              </Show>
            </Show>
          </div>
        </section>
      </div>
    </div>
  );
};
