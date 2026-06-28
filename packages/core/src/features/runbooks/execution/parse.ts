import {
  executionDetailSchema,
  type RunbookExecutionRecord,
} from "../runbooks.schemas";
import { isRecord, stringValue } from "../../../shared/values";

type TriggerContext = Record<string, unknown> & {
  entrypoint: string;
};

type StreamDeltaKind = "text" | "command_output";

interface StreamDelta {
  timestamp: string;
  text: string;
  kind?: StreamDeltaKind;
}

function normalizeStringRecord(
  value: unknown,
): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;

  const entries: Array<[string, string]> = [];
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) continue;
    const normalizedValue = stringValue(rawValue);
    if (normalizedValue === undefined) continue;
    entries.push([normalizedKey, normalizedValue]);
  }

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function normalizeTriggerContext(value: unknown): TriggerContext | undefined {
  if (!isRecord(value)) return undefined;

  const entrypoint = stringValue(value.entrypoint);
  if (entrypoint === undefined) {
    return undefined;
  }

  const context: TriggerContext = { entrypoint };
  assignStringField(context, "needId", value.needId);
  assignStringField(context, "needLabel", value.needLabel);
  assignStringField(context, "sourceId", value.sourceId);
  assignStringField(context, "sourceName", value.sourceName);
  assignStringField(context, "sourceType", value.sourceType);
  assignStringField(context, "incidentThreadId", value.incidentThreadId);
  return context;
}

function assignStringField(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  const normalized = stringValue(value);
  if (normalized === undefined) return;
  target[key] = normalized;
}

function normalizeSteps(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];

  const steps: unknown[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;

    steps.push({
      ...entry,
      streamDeltas: normalizeStreamDeltas(entry.streamDeltas),
    });
  }

  return steps;
}

function normalizeStreamDeltas(value: unknown): StreamDelta[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const deltas: StreamDelta[] = [];
  for (const delta of value) {
    const normalized = normalizeStreamDelta(delta);
    if (normalized !== undefined) deltas.push(normalized);
  }

  return deltas;
}

function normalizeStreamDelta(value: unknown): StreamDelta | undefined {
  if (!isRecord(value)) return undefined;

  const timestamp = stringValue(value.timestamp);
  const text = stringValue(value.text);
  if (timestamp === undefined || text === undefined) return undefined;

  return {
    timestamp,
    text,
    kind: normalizeStreamDeltaKind(value.kind),
  };
}

function normalizeStreamDeltaKind(value: unknown): StreamDeltaKind | undefined {
  if (value === "text" || value === "command_output") return value;
  return undefined;
}

function normalizedIncidentThreadId(
  parsed: Record<string, unknown>,
): string | undefined {
  return stringValue(parsed.incidentThreadId);
}

export function parseExecutionSnapshot(
  value: string | null | undefined,
): RunbookExecutionRecord | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    const rawParsed: unknown = JSON.parse(value);
    if (!isRecord(rawParsed)) {
      return null;
    }

    const normalized = {
      ...rawParsed,
      incidentThreadId: normalizedIncidentThreadId(rawParsed),
      source: rawParsed.source ?? "manual",
      parameterValues: normalizeStringRecord(rawParsed.parameterValues),
      triggerContext: normalizeTriggerContext(rawParsed.triggerContext),
      steps: normalizeSteps(rawParsed.steps),
    };

    const result = executionDetailSchema.safeParse(normalized);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}
