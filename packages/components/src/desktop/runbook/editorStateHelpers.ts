import { getActionMeta } from "./actionHelpers";
import type { RuntimeParameterDefinition } from "./types";
import type {
  RunbookActionParameter,
  RunbookActionRecord,
  RunbookRecord,
} from "../../services";

const DEFAULT_RUNBOOK_TITLES = new Set([
  "",
  "Untitled",
  "Untitled Runbook",
  "New Runbook",
]);
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
const MIN_DESCRIPTION_LENGTH = 20;
const MIN_TITLE_LENGTH = 5;

export function getRunbookMetadataIssues(runbook: RunbookRecord): {
  titleIssue: string | null;
  descriptionIssue: string | null;
} {
  const title = runbook.title.trim();
  const description = runbook.description.trim();

  let titleIssue: string | null = null;
  if (title.length === 0) {
    titleIssue = "Title is empty.";
  } else if (DEFAULT_RUNBOOK_TITLES.has(title)) {
    titleIssue =
      "Title is still the default. Give the runbook a descriptive name.";
  } else if (title.length < MIN_TITLE_LENGTH) {
    titleIssue = "Title is too short to identify the runbook clearly.";
  }

  let descriptionIssue: string | null = null;
  if (description.length === 0) {
    descriptionIssue = "Description is empty.";
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    descriptionIssue = `Description is too short (less than ${String(MIN_DESCRIPTION_LENGTH)} characters). The bot may not match it correctly.`;
  }

  return { titleIssue, descriptionIssue };
}

export function resolvedIdleTimeoutMinutes(runbook: RunbookRecord): number {
  if (typeof runbook.idleTimeout === "number") {
    return runbook.idleTimeout;
  }

  return DEFAULT_IDLE_TIMEOUT_MINUTES;
}

export function collectRuntimeParameters(
  runbook: RunbookRecord | null,
  translateActionType = (key: string) => key,
): RuntimeParameterDefinition[] {
  if (runbook === null) return [];

  const byKey = new Map<string, RuntimeParameterDefinition>();

  for (const action of runbook.actions) {
    for (const parameter of action.parameters ?? []) {
      mergeRuntimeParameter(byKey, action, parameter, translateActionType);
    }
  }

  return [...byKey.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function initialRuntimeParameterValues(
  parameters: RuntimeParameterDefinition[],
): Record<string, string> {
  return Object.fromEntries(
    parameters.flatMap((parameter) => {
      if (parameter.secure || typeof parameter.defaultValue !== "string") {
        return [];
      }
      return [[parameter.key, parameter.defaultValue] as const];
    }),
  );
}

export function compactRuntimeParameterValues(
  values: Record<string, string>,
): Record<string, string> | undefined {
  const entries = Object.entries(values).filter(
    ([, value]) => value.length > 0,
  );
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

export function isRuntimeParameterMissing(
  parameter: RuntimeParameterDefinition,
  runtimeParameterValues: Record<string, string>,
): boolean {
  if (!parameter.required) {
    return false;
  }

  if (
    parameter.defaultValue !== undefined &&
    parameter.defaultValue.length > 0
  ) {
    return false;
  }

  return (runtimeParameterValues[parameter.key] ?? "").trim().length === 0;
}

function getRuntimeParameterActionTitle(
  action: RunbookActionRecord,
  translateActionType: (key: string) => string,
): string {
  if (action.title.length > 0) {
    return action.title;
  }

  return translateActionType(getActionMeta(action.type).labelKey);
}

function mergeRuntimeParameter(
  byKey: Map<string, RuntimeParameterDefinition>,
  action: RunbookActionRecord,
  parameter: RunbookActionParameter,
  translateActionType: (key: string) => string,
): void {
  const key = parameter.key.trim();
  if (key.length === 0) return;

  const existing = byKey.get(key);
  const secure = getMergedRuntimeParameterSecure(existing, parameter);

  byKey.set(key, {
    id: getMergedRuntimeParameterId(existing, parameter),
    key,
    label: getMergedRuntimeParameterLabel(existing, parameter, key),
    description: getMergedRuntimeParameterDescription(existing, parameter),
    defaultValue: getMergedRuntimeParameterDefaultValue(
      existing,
      parameter,
      secure,
    ),
    required: getMergedRuntimeParameterRequired(existing, parameter),
    secure,
    actionTitles: getMergedRuntimeParameterActionTitles(
      existing,
      getRuntimeParameterActionTitle(action, translateActionType),
    ),
  });
}

function getMergedRuntimeParameterId(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
): string {
  return existing?.id ?? parameter.id;
}

function getMergedRuntimeParameterLabel(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
  key: string,
): string {
  return existing?.label ?? parameter.label ?? key;
}

function getMergedRuntimeParameterDescription(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
): string | undefined {
  return existing?.description ?? parameter.description;
}

function getMergedRuntimeParameterSecure(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
): boolean {
  return existing?.secure === true || parameter.secure === true;
}

function getMergedRuntimeParameterRequired(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
): boolean {
  return existing?.required === true || parameter.required !== false;
}

function getMergedRuntimeParameterDefaultValue(
  existing: RuntimeParameterDefinition | undefined,
  parameter: RunbookActionParameter,
  secure: boolean,
): string | undefined {
  if (secure) {
    return undefined;
  }

  return existing?.defaultValue ?? parameter.defaultValue;
}

function getMergedRuntimeParameterActionTitles(
  existing: RuntimeParameterDefinition | undefined,
  actionTitle: string,
): string[] {
  return [...(existing?.actionTitles ?? []), actionTitle];
}
