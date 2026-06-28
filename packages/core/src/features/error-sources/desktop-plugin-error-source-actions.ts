import type { ErrorSourceType } from "./desktop-error-sources.types";
import type { DesktopPluginDescriptor, DesktopPluginRuntimeService } from "../plugins";

export type ErrorSourceProviderActionKey =
  | "buildAuthorizeUrl"
  | "exchangeCodeForToken"
  | "refreshToken"
  | "listOrganizations"
  | "listProjects"
  | "getProject"
  | "queryIssues"
  | "listIssues"
  | "listIssueEvents"
  | "searchAlerts";

export const ERROR_SOURCE_PROVIDER_ACTION_KEYS = [
  "buildAuthorizeUrl",
  "exchangeCodeForToken",
  "refreshToken",
  "listOrganizations",
  "listProjects",
  "getProject",
  "queryIssues",
  "listIssues",
  "listIssueEvents",
  "searchAlerts",
] as const satisfies readonly ErrorSourceProviderActionKey[];

function hasConventionalActionId(
  plugin: DesktopPluginDescriptor,
  action: ErrorSourceProviderActionKey,
): boolean {
  return plugin.actions.some((candidate) => candidate.id === action);
}

export function hasErrorSourceProviderAction(
  plugin: DesktopPluginDescriptor,
  action: ErrorSourceProviderActionKey,
): boolean {
  const configured = plugin.metadata?.errorSource?.providerActions?.[action];
  if (typeof configured === "string" && configured.trim().length > 0) {
    return true;
  }

  return hasConventionalActionId(plugin, action);
}

export function resolveErrorSourceProviderActionId(input: {
  runtime: DesktopPluginRuntimeService;
  pluginId: string;
  sourceType: ErrorSourceType;
  action: ErrorSourceProviderActionKey;
}): string {
  const plugin = input.runtime.getPlugin(input.pluginId);
  const configured =
    plugin?.metadata?.errorSource?.providerActions?.[input.action];
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }

  if (
    plugin?.metadata?.errorSource?.sourceType === input.sourceType &&
    hasConventionalActionId(plugin, input.action)
  ) {
    return input.action;
  }

  throw new Error(
    `Plugin "${input.pluginId}" does not declare a provider action for "${input.action}".`,
  );
}
