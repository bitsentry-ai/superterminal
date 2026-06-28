import type { ErrorSourceType } from "./desktop-error-sources.types";
import type { DesktopPluginRuntimeService } from "../plugins";

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

  throw new Error(
    `Plugin "${input.pluginId}" does not declare a provider action for "${input.action}".`,
  );
}
