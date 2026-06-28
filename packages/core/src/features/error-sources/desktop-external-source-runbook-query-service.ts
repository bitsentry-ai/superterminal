import {
  DEFAULT_EXTERNAL_SOURCE_QUERY_LIMIT,
} from "./external-source-query.schemas";
import {
  formatPostHogExternalSourceQueryResults,
} from "./posthog-query-format";
import {
  normalizePostHogSearchQuery,
} from "./posthog-hogql";
import {
  formatSentryExternalSourceQueryResults,
} from "./sentry-query-format";
import {
  getProviderForSource,
} from "./desktop-posthog-provider-binding";
import {
  refreshSourceAccessToken,
  type DesktopOAuthRefreshProvider,
} from "./desktop-oauth-token-refresher";
import type {
  ErrorSource,
  ErrorSourceConfiguration,
  ErrorSourceType,
} from "./desktop-error-sources.types";
import {
  readConfiguredProjectIds,
  readConfiguredProjectSlugs,
  resolveSentryProjectSelection,
  type DesktopSentryProjectSummary,
} from "./desktop-sentry-project-selection";

export interface ExternalSourceRunbookQueryInput {
  sourceId: string;
  query: string;
  signal?: AbortSignal;
}

export interface ExternalSourceRunbookQueryExecutor {
  execute(input: ExternalSourceRunbookQueryInput): Promise<string>;
}

type SupportedExternalSource = ErrorSource & {
  sourceType: "sentry" | "posthog";
};

type QueryIssuesResponse = {
  issues: unknown[];
  hasMore: boolean;
};

type DesktopExternalSourceProvider = DesktopOAuthRefreshProvider & {
  listProjects(input: {
    accessToken: string;
    orgSlug: string;
    signal?: AbortSignal;
  }): Promise<DesktopSentryProjectSummary[]>;
  queryIssues(input: {
    accessToken: string;
    orgSlug: string;
    projectIds: string[];
    query: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<QueryIssuesResponse>;
};

type DesktopExternalSourceProviderFactory = {
  getProvider(
    sourceType: ErrorSourceType,
  ): DesktopExternalSourceProvider;
};

type DesktopExternalSourceSourcesRepository = {
  findById(id: string): Promise<ErrorSource | null>;
  update(input: {
    id: string;
    accessTokenRef?: string | null;
    refreshTokenRef?: string | null;
    expiresAt?: string | null;
    grantedScopes?: string[];
    configuration?: ErrorSourceConfiguration;
  }): Promise<unknown>;
};

function readQueryInput(input: ExternalSourceRunbookQueryInput): {
  sourceId: string;
  query: string;
} {
  const sourceId = input.sourceId.trim();
  const query = input.query.trim();

  if (sourceId.length === 0) {
    throw new Error("External Source action is missing a selected source");
  }
  if (query.length === 0) {
    throw new Error("External Source action is missing a query");
  }

  return { sourceId, query };
}

function isSupportedExternalSource(
  source: ErrorSource,
): source is SupportedExternalSource {
  return source.sourceType === "sentry" || source.sourceType === "posthog";
}

function requireSupportedSource(source: ErrorSource): SupportedExternalSource {
  if (isSupportedExternalSource(source)) {
    return source;
  }

  throw new Error(
    `External Source provider ${source.sourceType} is not supported yet`,
  );
}

function readOrgSlug(source: ErrorSource): string {
  const orgSlug = source.configuration.orgSlug?.trim();
  if (orgSlug === undefined || orgSlug.length === 0) {
    throw new Error(
      `External Source "${source.name}" is missing configuration.orgSlug`,
    );
  }

  return orgSlug;
}

function normalizeQuery(
  source: SupportedExternalSource,
  query: string,
): string {
  if (source.sourceType === "posthog") {
    return normalizePostHogSearchQuery(query);
  }

  return query;
}

function normalizeIssues(issues: unknown): unknown[] {
  if (Array.isArray(issues)) {
    return issues;
  }

  return [];
}

export class ExternalSourceRunbookQueryService
  implements ExternalSourceRunbookQueryExecutor
{
  constructor(
    private readonly sourcesRepository: DesktopExternalSourceSourcesRepository,
    private readonly providerFactory: DesktopExternalSourceProviderFactory,
    private readonly options?: { defaultLimit?: number },
  ) {}

  async execute(input: ExternalSourceRunbookQueryInput): Promise<string> {
    const { sourceId, query } = readQueryInput(input);

    const source = await this.sourcesRepository.findById(sourceId);
    if (source === null) {
      throw new Error(`Selected external source ${sourceId} was not found`);
    }

    const supportedSource = requireSupportedSource(source);
    const normalizedQuery = normalizeQuery(supportedSource, query);
    const orgSlug = readOrgSlug(supportedSource);

    const token = await this.resolveAccessToken(supportedSource, input.signal);
    const provider = getProviderForSource(this.providerFactory, supportedSource);
    const projectIds = await this.resolveProjectIds(
      supportedSource,
      token,
      orgSlug,
      input.signal,
    );
    const limit =
      this.options?.defaultLimit ?? DEFAULT_EXTERNAL_SOURCE_QUERY_LIMIT;
    const page = await provider.queryIssues({
      accessToken: token,
      orgSlug,
      projectIds,
      query: normalizedQuery,
      limit,
      signal: input.signal,
    });

    return this.formatOutput({
      source: supportedSource,
      query: normalizedQuery,
      issues: normalizeIssues(page.issues),
      hasMore: page.hasMore,
      limit,
    });
  }

  private async resolveAccessToken(
    source: SupportedExternalSource,
    signal?: AbortSignal,
  ): Promise<string> {
    return refreshSourceAccessToken({
      source: source,
      sourcesRepository: this.sourcesRepository,
      providerFactory: this.providerFactory,
      signal,
    });
  }

  private async resolveProjectIds(
    source: SupportedExternalSource,
    accessToken: string,
    orgSlug: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const configuredProjectIds = readConfiguredProjectIds(source.configuration);
    if (configuredProjectIds.length > 0) {
      return configuredProjectIds;
    }

    const configuredProjectSlugs = readConfiguredProjectSlugs(
      source.configuration,
    );
    if (configuredProjectSlugs.length === 0) {
      return [];
    }

    const provider = getProviderForSource(this.providerFactory, source);
    const projects = await provider.listProjects({
      accessToken,
      orgSlug,
      signal,
    });
    const resolvedProjects = resolveSentryProjectSelection(projects, {
      projectSlugs: configuredProjectSlugs,
    });

    if (resolvedProjects.projectIds.length === 0) {
      throw new Error(
        `External Source "${source.name}" has Sentry project slugs that could not be resolved to numeric project IDs`,
      );
    }

    await this.sourcesRepository.update({
      id: source.id,
      configuration: {
        ...source.configuration,
        projectIds: resolvedProjects.projectIds,
        projectSlugs: resolvedProjects.projectSlugs,
        projectNames: resolvedProjects.projectNames,
      },
    });

    source.configuration = {
      ...source.configuration,
      projectIds: resolvedProjects.projectIds,
      projectSlugs: resolvedProjects.projectSlugs,
      projectNames: resolvedProjects.projectNames,
    };

    return resolvedProjects.projectIds;
  }

  private formatOutput(input: {
    source: ErrorSource;
    query: string;
    issues: unknown[];
    hasMore: boolean;
    limit: number;
  }): string {
    if (input.source.sourceType === "posthog") {
      return formatPostHogExternalSourceQueryResults({
        sourceName: input.source.name,
        sourceType: input.source.sourceType,
        query: input.query,
        issues: input.issues,
        hasMore: input.hasMore,
        limit: input.limit,
      });
    }
    return formatSentryExternalSourceQueryResults({
      sourceName: input.source.name,
      sourceType: input.source.sourceType,
      query: input.query,
      issues: input.issues,
      hasMore: input.hasMore,
      limit: input.limit,
    });
  }
}
