import { logFilterConfigSchema, type LogFilterConfig } from "./runbooks.schemas";

export interface LogFilterExecutionMetadata {
  matched: boolean;
  matchCount: number;
  groupNames: string[];
  error?: string;
}

export interface LogFilterExecutionResult {
  structuredOutput: Record<string, unknown>;
  metadata: LogFilterExecutionMetadata;
}

export interface RunbookLogFilterPreviewResult {
  error?: string;
  matched?: boolean;
  structuredOutput?: Record<string, unknown>;
  matchCount?: number;
  groupNames?: string[];
}

export class RunbookLogFilterError extends Error {
  readonly metadata: LogFilterExecutionMetadata;

  constructor(message: string, metadata: LogFilterExecutionMetadata) {
    super(message);
    this.name = "RunbookLogFilterError";
    this.metadata = metadata;
  }
}

const NAMED_GROUP_PATTERN = /\(\?<([$A-Z_a-z][$\w]*)>/g;
const DEFAULT_ALL_MATCH_LIMIT = 20;

export function extractRunbookLogFilterGroupNames(pattern: string): string[] {
  const names = new Set<string>();

  for (const match of pattern.matchAll(NAMED_GROUP_PATTERN)) {
    const name = match[1].trim();
    if (name.length > 0) {
      names.add(name);
    }
  }

  return [...names];
}

export function applyRunbookLogFilter(
  output: string,
  config: LogFilterConfig,
): LogFilterExecutionResult {
  const groupNames = extractRunbookLogFilterGroupNames(config.pattern);
  const parsed = logFilterConfigSchema.safeParse(config);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid log filter configuration";
    throw new RunbookLogFilterError(message, {
      matched: false,
      matchCount: 0,
      groupNames,
      error: message,
    });
  }

  const normalized = parsed.data;
  const flags = buildRegexFlags(normalized);
  const regex = new RegExp(normalized.pattern, regexFlags(normalized, flags));
  const resolvedGroupNames = extractRunbookLogFilterGroupNames(normalized.pattern);

  if (normalized.match === "all") {
    return collectAllMatches(
      output,
      regex,
      resolvedGroupNames,
      normalized.maxMatches ?? DEFAULT_ALL_MATCH_LIMIT,
    );
  }

  return collectFirstMatch(output, regex, resolvedGroupNames);
}

export function validateRunbookLogFilterConfig(config: unknown): string[] {
  if (config == null) {
    return [];
  }

  const parsed = logFilterConfigSchema.safeParse(config);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => issue.message);
}

export function previewRunbookLogFilter(
  output: string,
  config: unknown,
): RunbookLogFilterPreviewResult {
  if (config == null || output.length === 0) {
    return {};
  }

  const parsed = logFilterConfigSchema.safeParse(config);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Invalid log filter configuration",
    };
  }

  try {
    const result = applyRunbookLogFilter(output, parsed.data);
    return {
      matched: result.metadata.matched,
      structuredOutput: result.structuredOutput,
      matchCount: result.metadata.matchCount,
      groupNames: result.metadata.groupNames,
    };
  } catch (error) {
    let message = "Failed to preview log filter";
    if (error instanceof Error) {
      message = error.message;
    }

    return {
      error: message,
    };
  }
}

function buildRegexFlags(config: LogFilterConfig): string {
  const rawFlags = config.flags ?? "";
  const flags = new Set(rawFlags.split("").filter((flag) => flag.length > 0));
  if (config.multiline === true) {
    flags.add("m");
  }
  return [...flags].join("");
}

function regexFlags(config: LogFilterConfig, flags: string): string {
  if (config.match === "all") return `${flags}g`;
  return flags;
}

function collectFirstMatch(
  output: string,
  regex: RegExp,
  groupNames: string[],
): LogFilterExecutionResult {
  const match = regex.exec(output);
  if (match === null || match.groups === undefined) {
    return {
      structuredOutput: {},
      metadata: {
        matched: false,
        matchCount: 0,
        groupNames,
      },
    };
  }

  const structuredOutput = toStructuredOutput(match.groups);
  return {
    structuredOutput,
    metadata: {
      matched: hasStructuredOutput(structuredOutput),
      matchCount: matchCountForStructuredOutput(structuredOutput),
      groupNames,
    },
  };
}

function hasStructuredOutput(structuredOutput: Record<string, unknown>): boolean {
  return Object.keys(structuredOutput).length > 0;
}

function matchCountForStructuredOutput(
  structuredOutput: Record<string, unknown>,
): number {
  if (hasStructuredOutput(structuredOutput)) return 1;
  return 0;
}

function collectAllMatches(
  output: string,
  regex: RegExp,
  groupNames: string[],
  maxMatches: number,
): LogFilterExecutionResult {
  const groupedValues = new Map<string, string[]>();
  let matchCount = 0;

  for (const groupName of groupNames) {
    groupedValues.set(groupName, []);
  }

  while (matchCount < maxMatches) {
    const match = regex.exec(output);
    if (match === null) {
      break;
    }

    if (collectMatchValues(match.groups, groupNames, groupedValues)) {
      matchCount += 1;
    }

    advanceEmptyMatch(regex, match);
  }

  const structuredOutput = structuredOutputFromGroupedValues(groupedValues);

  return {
    structuredOutput,
    metadata: {
      matched: matchCount > 0,
      matchCount,
      groupNames,
    },
  };
}

function collectMatchValues(
  groups: Record<string, string> | undefined,
  groupNames: string[],
  groupedValues: Map<string, string[]>,
): boolean {
  if (groups === undefined) return false;

  let capturedAnyValue = false;
  for (const groupName of groupNames) {
    const value = groups[groupName];
    if (typeof value !== "string") continue;
    groupedValues.get(groupName)?.push(value);
    capturedAnyValue = true;
  }

  return capturedAnyValue;
}

function advanceEmptyMatch(regex: RegExp, match: RegExpExecArray): void {
  if (match[0] === "") {
    regex.lastIndex += 1;
  }
}

function structuredOutputFromGroupedValues(
  groupedValues: Map<string, string[]>,
): Record<string, unknown> {
  const entries: Array<[string, string[]]> = [];
  for (const [key, values] of groupedValues) {
    if (values.length > 0) entries.push([key, values]);
  }

  return Object.fromEntries(entries);
}

function toStructuredOutput(
  groups: Record<string, string | undefined>,
): Record<string, unknown> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(groups)) {
    if (typeof value === "string") entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}
