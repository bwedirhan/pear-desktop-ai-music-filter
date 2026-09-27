export type RestartRequirement =
  | { type: 'plugin'; id: string }
  | { type: 'setting'; label: string };

/** One identity per requirement, for de-duplicating a batch of them. */
export const restartRequirementKey = (
  requirement: RestartRequirement,
): string =>
  requirement.type === 'plugin'
    ? `plugin:${requirement.id}`
    : `setting:${requirement.label}`;
