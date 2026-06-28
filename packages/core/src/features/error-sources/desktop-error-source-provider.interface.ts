import type { ErrorSourceType } from './desktop-error-sources.types'

export interface OAuthAuthorizeInput {
  clientId: string
  redirectUri: string
  scopes: string[]
  state: string
  codeChallenge: string
}

export interface OAuthTokenExchangeInput {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  codeVerifier: string
  signal?: AbortSignal
}

export interface OAuthTokenRefreshInput {
  clientId: string
  clientSecret: string
  refreshToken: string
  signal?: AbortSignal
}

export interface OAuthTokenResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
}

export interface OrganizationSummary {
  slug: string
  name: string
}

export interface ProjectSummary {
  id: string
  slug: string
  name: string
  organizationId?: string
}

export type ExternalIssuePayload = Record<string, unknown>

export type ExternalEventPayload = Record<string, unknown>

export interface IssueBatchResponse {
  issues: ExternalIssuePayload[]
  nextCursor?: string
  hasMore: boolean
}

export interface EventBatchResponse {
  events: ExternalEventPayload[]
  nextCursor?: string
  hasMore: boolean
}

export interface ErrorSourceProvider {
  readonly sourceType: ErrorSourceType

  buildAuthorizeUrl(input: OAuthAuthorizeInput): string | Promise<string>

  exchangeCodeForToken(input: OAuthTokenExchangeInput): Promise<OAuthTokenResponse>

  refreshToken(input: OAuthTokenRefreshInput): Promise<OAuthTokenResponse>

  listOrganizations(accessToken: string): Promise<OrganizationSummary[]>

  listProjects(input: {
    accessToken: string
    orgSlug: string
    signal?: AbortSignal
  }): Promise<ProjectSummary[]>

  queryIssues(input: {
    accessToken: string
    orgSlug: string
    projectIds: string[]
    query: string
    limit?: number
    cursor?: string
    signal?: AbortSignal
  }): Promise<IssueBatchResponse>

  listIssues(input: {
    accessToken: string
    orgSlug: string
    projectIds: string[]
    cursor?: string
    limit?: number
    since?: string
    /**
     * Upper bound on a fingerprint's newest event timestamp. Set to the
     * sync's captured start time so OFFSET-paginated reads see a stable
     * snapshot during a sync run.
     */
    until?: string
  }): Promise<IssueBatchResponse>

  listIssueEvents(input: {
    accessToken: string
    orgSlug: string
    issueId: string
    cursor?: string
    projectIds?: string[]
    /**
     * When set, restrict the event scan to events at or after this timestamp.
     * Used by incremental syncs so we don't reread historical events on a
     * known fingerprint just because one new exception arrived.
     */
    since?: string
    /**
     * Upper bound on event timestamp. Set to the sync's captured start time
     * so OFFSET-paginated reads see a stable snapshot during a sync run.
     */
    until?: string
  }): Promise<EventBatchResponse>
}
