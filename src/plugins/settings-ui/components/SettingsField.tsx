import {
  createEffect,
  createResource,
  createSignal,
  Match,
  Show,
  Switch as SwitchFlow,
  type Component,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { t } from '@/i18n';

import {
  CheckGroup,
  Dropdown,
  NumberStepper,
  RadioGroup,
  Slider,
  Switch,
  TextInput,
} from './Controls';
import { Icon } from './Icon';

import { bridge, pickDirectory, pickFile } from '../state';

import type {
  ActionField,
  CustomField,
  CustomFieldContext,
  FieldAccessors,
  MultiSelectField,
  NumberField,
  SelectField,
  SettingField,
  SettingOptions,
  SliderField,
  TextField,
} from '@/types/settings';

export interface SettingsFieldProps {
  field: SettingField;
  value: unknown;
  onChange: (value: unknown) => void;
  onSliderChange?: (value: unknown) => void;
  accessors?: FieldAccessors;
  /** Resolve a `"<pluginId>.<name>"` custom component. */
  resolveComponent?: (
    id: string,
  ) => Component<{ ctx: CustomFieldContext }> | undefined;
}

// Resolve static or async option providers once per field.
const useResolvedOptions = (getOptions: () => SettingOptions) => {
  const [options, { refetch }] = createResource(
    getOptions,
    async (opts) => (typeof opts === 'function' ? await opts() : opts),
    { initialValue: [] },
  );
  return { options, refetch };
};

const SPIN_MIN_MS = 500;
const RefreshButton = (p: { onRefresh: () => unknown }) => {
  const [spinning, setSpinning] = createSignal(false);
  const run = async () => {
    if (spinning()) return;
    setSpinning(true);
    try {
      await Promise.all([
        Promise.resolve(p.onRefresh()),
        new Promise((resolve) => setTimeout(resolve, SPIN_MIN_MS)),
      ]);
    } finally {
      setSpinning(false);
    }
  };
  return (
    <button
      aria-label={t('settings-ui.refresh-options')}
      class="sui-refreshbtn"
      classList={{ 'sui-refreshbtn--spin': spinning() }}
      onClick={run}
      title={t('settings-ui.refresh-options')}
      type="button"
    >
      <Icon name="refresh" size={18} />
    </button>
  );
};

const SelectControl = (p: {
  field: SelectField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { options, refetch } = useResolvedOptions(() => p.field.options);
  const value = () => (p.value as string | number | undefined) ?? '';
  // Bundled lists (languages) are resolved lazily but cant go stale, so they
  // get no refresh button and no re-read.
  const isRefreshable = () =>
    typeof p.field.options === 'function' && p.field.refreshable !== false;

  // A stored value missing from a dynamic list means the list is stale (a
  // theme was imported, a device plugged in): re-read it once per value.
  let refreshedFor: unknown;
  createEffect(() => {
    const current = value();
    if (
      !isRefreshable() ||
      current === '' ||
      current === refreshedFor ||
      options().length === 0 ||
      options().some((option) => String(option.value) === String(current))
    ) {
      return;
    }

    refreshedFor = current;
    refetch();
  });

  // Same as the menu's Language > Sync entries: the value comes back from the
  // backend (which reports unsupported languages itself), then goes through the
  // normal change path so the restart banner and the store stay in step.
  const syncFromYouTube = async () => {
    const language = await bridge.languageFromYouTube();
    if (language) p.onChange(language);
  };

  return (
    <div class="sui-field__control">
      <div class="sui-control-row">
        <Show
          fallback={
            <RadioGroup
              onChange={(v) => p.onChange(v)}
              options={options()}
              value={value()}
            />
          }
          when={p.field.variant === 'dropdown'}
        >
          <Dropdown
            onChange={(v) => p.onChange(v)}
            options={options()}
            value={value()}
          />
        </Show>
        <Show when={isRefreshable()}>
          <RefreshButton onRefresh={() => refetch()} />
        </Show>
      </div>
      <Show when={p.field.languageSync}>
        <div class="sui-control-actions">
          <span>
            {t('main.menu.options.submenu.language.submenu.sync.label')}
          </span>
          <button class="sui-fieldbtn" onClick={syncFromYouTube} type="button">
            {t(
              'main.menu.options.submenu.language.submenu.sync.submenu.from-youtube',
            )}
          </button>
          <button
            class="sui-fieldbtn"
            onClick={() => bridge.languageToYouTube()}
            type="button"
          >
            {t(
              'main.menu.options.submenu.language.submenu.sync.submenu.to-youtube',
            )}
          </button>
        </div>
      </Show>
    </div>
  );
};

const SliderControl = (p: {
  field: SliderField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const scale = () => p.field.scale ?? 1;
  const shown = () => Number(p.value ?? p.field.min) / scale();
  return (
    <div class="sui-field__control">
      <Slider
        display={`${shown()}${p.field.unit ? ' ' + p.field.unit : ''}`}
        max={p.field.max}
        min={p.field.min}
        onInput={(v) => p.onChange(v * scale())}
        step={p.field.step}
        value={shown()}
      />
    </div>
  );
};

const NumberControl = (p: {
  field: NumberField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => (
  <div class="sui-field__control">
    <NumberStepper
      max={p.field.max}
      min={p.field.min}
      onChange={(v) => p.onChange(v)}
      step={p.field.step}
      unit={p.field.unit}
      value={Number(p.value ?? p.field.min ?? 0)}
    />
  </div>
);

const TextControl = (p: {
  field: TextField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => (
  <div class="sui-field__control">
    <TextInput
      onChange={(v) => p.onChange(v)}
      placeholder={p.field.placeholder?.()}
      value={(p.value as string | undefined) ?? ''}
    />
  </div>
);

const MultiSelectControl = (p: {
  field: MultiSelectField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { options, refetch } = useResolvedOptions(() => p.field.options);
  return (
    <div class="sui-field__control">
      <div class="sui-control-row">
        <CheckGroup
          onChange={(v) => p.onChange(v)}
          options={options()}
          values={
            Array.isArray(p.value) ? (p.value as (string | number)[]) : []
          }
        />
        <Show when={typeof p.field.options === 'function'}>
          <RefreshButton onRefresh={() => refetch()} />
        </Show>
      </div>
    </div>
  );
};

const ActionControl = (p: {
  field: ActionField;
  accessors?: FieldAccessors;
}) => {
  const helpers = () =>
    p.accessors ? { ...p.accessors, pickDirectory, pickFile } : undefined;
  return (
    <div class="sui-field__control">
      <button
        class="sui-fieldbtn"
        disabled={!helpers()}
        onClick={() => {
          const bound = helpers();
          if (bound) p.field.onClick(bound);
        }}
        type="button"
      >
        {p.field.buttonLabel()}
      </button>
    </div>
  );
};

const CustomControl = (p: {
  field: CustomField;
  accessors?: FieldAccessors;
  resolveComponent?: SettingsFieldProps['resolveComponent'];
}) => {
  const component = () => p.resolveComponent?.(p.field.component);
  return (
    <div class="sui-field__control">
      <Show
        fallback={
          <div class="sui-field__desc">
            missing component: {p.field.component}
          </div>
        }
        when={p.accessors ? component() : undefined}
      >
        {(comp) => <Dynamic component={comp()} ctx={p.accessors!} />}
      </Show>
    </div>
  );
};

export const SettingsField = (props: SettingsFieldProps) => {
  const field = () => props.field;

  return (
    <div class="sui-field">
      <div class="sui-field__row">
        <div class="sui-field__text">
          <div class="sui-field__label-line">
            <span class="sui-field__label">{field().label()}</span>
            <Show when={field().restartNeeded}>
              <span class="sui-pill" title={t('settings-ui.restart-pill-hint')}>
                {t('settings-ui.restart-pill')}
              </span>
            </Show>
          </div>
          <Show when={field().description}>
            <div class="sui-field__desc">{field().description!()}</div>
          </Show>
        </div>

        <Show when={field().type === 'switch'}>
          <Switch
            checked={Boolean(props.value)}
            label={field().label()}
            onChange={(v) => props.onChange(v)}
          />
        </Show>
      </div>

      <SwitchFlow>
        <Match when={field().type === 'select'}>
          <SelectControl
            field={field() as SelectField}
            onChange={props.onChange}
            value={props.value}
          />
        </Match>

        <Match when={field().type === 'slider'}>
          <SliderControl
            field={field() as SliderField}
            onChange={props.onSliderChange ?? props.onChange}
            value={props.value}
          />
        </Match>

        <Match when={field().type === 'number'}>
          <NumberControl
            field={field() as NumberField}
            onChange={props.onChange}
            value={props.value}
          />
        </Match>

        <Match when={field().type === 'text'}>
          <TextControl
            field={field() as TextField}
            onChange={props.onChange}
            value={props.value}
          />
        </Match>

        <Match when={field().type === 'multiselect'}>
          <MultiSelectControl
            field={field() as MultiSelectField}
            onChange={props.onChange}
            value={props.value}
          />
        </Match>

        <Match when={field().type === 'action'}>
          <ActionControl
            accessors={props.accessors}
            field={field() as ActionField}
          />
        </Match>

        <Match when={field().type === 'custom'}>
          <CustomControl
            accessors={props.accessors}
            field={field() as CustomField}
            resolveComponent={props.resolveComponent}
          />
        </Match>
      </SwitchFlow>
    </div>
  );
};
