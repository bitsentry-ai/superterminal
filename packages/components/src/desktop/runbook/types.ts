import type { RunbookActionParameter } from "../../services";

export type RuntimeParameterDefinition = RunbookActionParameter & {
  actionTitles: string[];
  secure: boolean;
  required: boolean;
};

export type TranslationFn = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export type IdleTimeoutPreset = {
  value: number;
  label: string;
};

export type RunbookMetadataIssues = {
  titleIssue: string | null;
  descriptionIssue: string | null;
};
