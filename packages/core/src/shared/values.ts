export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return undefined;
}

export function numberValue(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

export function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

export function stringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.every((item) => typeof item === "string")) return value;
  return undefined;
}
