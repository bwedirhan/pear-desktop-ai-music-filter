// Copyright (c) 2026 bwedirhan. MIT License.
/**
 * Dotted-path access, shared by app options (`options.proxy`) and plugin
 * config keys (`scrobblers.lastfm.apiKey`).
 */

export const getByPath = (obj: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );

/** Writes `value` at a dotted path, creating the intermediate objects. */
export const setByPath = <T extends object>(
  root: T,
  path: string,
  value: unknown,
): T => {
  const keys = path.split('.');
  let node = root as Record<string, unknown>;

  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }

  node[keys[keys.length - 1]] = value;
  return root;
};

/** Build a nested partial object from a dotted key + value. */
export const nestPartial = (path: string, value: unknown): object =>
  setByPath({}, path, value);
