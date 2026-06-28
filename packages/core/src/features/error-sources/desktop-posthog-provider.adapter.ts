import log from 'electron-log'
import { z } from 'zod'
import {
  type PostHogHogQLResponse,
  buildPostHogEventRecord,
  buildPostHogEventsHogQL,
  buildPostHogIssueRecord,
  buildPostHogIssuesHogQL,
  decodeOffsetCursor,
  decodePerProjectCursor,
  encodeOffsetCursor,
  encodePerProjectCursor,
  extractPostHogIssueFingerprint,
  mergePostHogIssuesByRecency,
  parsePostHogErrorBody,
  parsePostHogHogQLResponse,
  rowToObject,
} from './posthog-hogql'
import {
  assertAllowedPostHogBaseUrl,
  resolveSameOriginNextUrl,
} from './posthog-base-url'
import {
  type ErrorSourceProvider,
  type EventBatchResponse,
  type IssueBatchResponse,
  type OAuthAuthorizeInput,
  type OAuthTokenExchangeInput,
  type OAuthTokenRefreshInput,
  type OAuthTokenResponse,
  type OrganizationSummary,
  type ProjectSummary,
} from './desktop-error-source-provider.interface'

const DEFAULT_ISSUES_LIMIT = 50
const DEFAULT_EVENTS_LIMIT = 50

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function primitiveString(value: unknown, fallback = ''): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }

  return fallback
}

function trimmedPrimitiveString(value: unknown): string {
  return primitiveString(value).trim()
}

function optionalTrimmedPrimitiveString(value: unknown): string | undefined {
  const normalized = trimmedPrimitiveString(value)
  if (normalized.length > 0) {
    return normalized
  }

  return undefined
}

function finiteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  if (Number.isFinite(parsed)) {
    return parsed
  }

  return undefined
}

function boundedLimit(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback
  }

  return Math.max(1, Math.min(100, Math.trunc(value)))
}

function nextPerProjectCursor(
  hasMore: boolean,
  nextOffsets: Record<string, number>,
): string | undefined {
  if (!hasMore) {
    return undefined
  }

  return encodePerProjectCursor(nextOffsets)
}

function nextOffsetCursor(hasMore: boolean, offset: number): string | undefined {
  if (!hasMore) {
    return undefined
  }

  return encodeOffsetCursor(offset)
}

function limitRows<T>(rows: T[], limit: number): T[] {
  if (rows.length > limit) {
    return rows.slice(0, limit)
  }

  return rows
}

function attemptLabel(attempt: number, maxAttempts: number): string {
  return `${String(attempt)}/${String(maxAttempts)}`
}

function retryDelayFromHeader(header: string | null, fallbackMs: number): number {
  if (header === null) {
    return fallbackMs
  }

  const retryAfterSeconds = Number(header)
  if (!Number.isFinite(retryAfterSeconds)) {
    return fallbackMs
  }

  return Math.max(500, retryAfterSeconds * 1_000)
}

function parseExtraAllowedHosts(): string[] {
  const raw = process.env.POSTHOG_ALLOWED_BASE_URLS
  if (raw === undefined || raw.length === 0) return []
  const out: string[] = []
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim()
    if (trimmed.length === 0) continue
    try {
      out.push(new URL(trimmed).host.toLowerCase())
    } catch {
      out.push(trimmed.toLowerCase())
    }
  }
  return out
}

interface PostHogProviderOptions {
  apiBase?: string
}

interface RetryAttemptContext {
  url: string
  init: RequestInit
  attempt: number
  maxAttempts: number
  requestStartMs: number
  delayMs: number
}

/**
 * Runtime shape of PostHog's DRF-paginated list responses. We parse the
 * envelope before reading `results` or following `next` so an upstream
 * surprise can't smuggle a non-array `results` or a non-string `next` into
 * the row consumers and the SSRF guard.
 */
const postHogPaginatedSchema = z
  .object({
    count: z.number().optional(),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(z.unknown()).optional(),
  })
  .loose()

function normalizeTokenResponse(payload: unknown): OAuthTokenResponse {
  const parsed = asRecord(payload)
  const accessToken = trimmedPrimitiveString(parsed.access_token)
  if (accessToken.length === 0) {
    throw new Error('PostHog OAuth response did not include an access token')
  }

  const refreshToken = optionalTrimmedPrimitiveString(parsed.refresh_token)
  const scope = optionalTrimmedPrimitiveString(parsed.scope)
  const expiresIn = finiteNumber(parsed.expires_in)

  const response: OAuthTokenResponse = {
    accessToken,
  }
  if (refreshToken !== undefined) {
    response.refreshToken = refreshToken
  }
  if (expiresIn !== undefined) {
    response.expiresIn = expiresIn
  }
  if (scope !== undefined) {
    response.scope = scope
  }

  return response
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return String(error)
}

function valueOrNull(...values: unknown[]): unknown {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return null
}

function summarizeUntitledIssueRow(row: Record<string, unknown>): Record<string, unknown> {
  const exceptionList = row.exception_list

  return {
    fingerprint: valueOrNull(row.fingerprint, row.id),
    project_id: valueOrNull(row.project_id),
    message: valueOrNull(row.message, row.exception_message),
    exception_type: valueOrNull(row.exception_type, row.type),
    level: valueOrNull(row.level),
    environment: valueOrNull(row.environment),
    exception_list_type: exceptionListType(exceptionList),
    exception_list_preview: exceptionListPreview(exceptionList),
  }
}

function exceptionListPreview(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.slice(0, 500)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 2)
  }
  if (value !== null && typeof value === 'object') {
    return value
  }

  return null
}

function exceptionListType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'nullish'
  }
  if (Array.isArray(value)) {
    return 'array'
  }

  return typeof value
}

export class PostHogProviderAdapter implements ErrorSourceProvider {
  readonly sourceType = 'posthog' as const
  private readonly apiBase: string

  constructor(options: PostHogProviderOptions = {}) {
    // Even though every documented caller is expected to validate the base
    // URL before constructing the adapter, treat the constructor as a
    // last-line SSRF gate: a future caller that forgets to validate would
    // otherwise turn the adapter into a request primitive. Empty input falls
    // back to the US cloud default; anything else must pass the allowlist.
    this.apiBase = assertAllowedPostHogBaseUrl(options.apiBase, {
      extraAllowedHosts: parseExtraAllowedHosts(),
    })
  }

  withApiBase(apiBase: string | null | undefined): PostHogProviderAdapter {
    const next = (apiBase ?? '').trim()
    if (next.length === 0) return this
    const validated = assertAllowedPostHogBaseUrl(next, {
      extraAllowedHosts: parseExtraAllowedHosts(),
    })
    if (validated === this.apiBase) return this
    return new PostHogProviderAdapter({ apiBase: validated })
  }

  private oauthUrl(pathname: string): string {
    return new URL(pathname, this.apiBase).toString()
  }

  buildAuthorizeUrl(input: OAuthAuthorizeInput): string {
    const url = new URL(this.oauthUrl('/oauth/authorize/'))
    url.searchParams.set('client_id', input.clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', input.redirectUri)
    url.searchParams.set('scope', input.scopes.join(' '))
    url.searchParams.set('state', input.state)
    url.searchParams.set('code_challenge', input.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    return url.toString()
  }

  async exchangeCodeForToken(input: OAuthTokenExchangeInput): Promise<OAuthTokenResponse> {
    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
    })
    if (input.clientSecret.length > 0) {
      payload.set('client_secret', input.clientSecret)
    }

    const response = await this.requestWithRetry(this.oauthUrl('/oauth/token/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      signal: input.signal,
    })
    return normalizeTokenResponse(await response.json())
  }

  async refreshToken(input: OAuthTokenRefreshInput): Promise<OAuthTokenResponse> {
    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: input.refreshToken,
      client_id: input.clientId,
    })
    if (input.clientSecret.length > 0) {
      payload.set('client_secret', input.clientSecret)
    }

    const response = await this.requestWithRetry(this.oauthUrl('/oauth/token/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
      signal: input.signal,
    })
    return normalizeTokenResponse(await response.json())
  }

  async listOrganizations(accessToken: string): Promise<OrganizationSummary[]> {
    const rows = await this.fetchAllPaginated<Record<string, unknown>>(
      `${this.apiBase}/api/organizations/`,
      accessToken,
    )
    return rows.map((item) => {
      const slug = primitiveString(item.id, primitiveString(item.slug))
      return {
        slug,
        name: primitiveString(item.name, primitiveString(item.slug, slug)),
      }
    })
  }

  async listProjects(input: {
    accessToken: string
    orgSlug?: string
    signal?: AbortSignal
  }): Promise<ProjectSummary[]> {
    const url = new URL(`${this.apiBase}/api/projects/`)
    if (input.orgSlug !== undefined && input.orgSlug.length > 0) {
      url.searchParams.set('organization_id', input.orgSlug)
    }
    const rows = await this.fetchAllPaginated<Record<string, unknown>>(
      url.toString(),
      input.accessToken,
      input.signal,
    )
    return rows.map((item) => {
      const id = primitiveString(item.id)
      return {
        id,
        slug: id,
        name: primitiveString(item.name, id),
      }
    })
  }

  async getProject(input: {
    accessToken: string
    projectId: string
    signal?: AbortSignal
  }): Promise<ProjectSummary> {
    const projectId = input.projectId.trim()
    if (projectId.length === 0) {
      throw new Error('PostHog project id is required')
    }
    const response = await this.requestWithRetry(
      `${this.apiBase}/api/projects/${encodeURIComponent(projectId)}/`,
      {
        headers: this.authHeaders(input.accessToken),
        signal: input.signal,
      },
    )
    const item = asRecord(await response.json())
    const id = primitiveString(item.id, projectId)
    const project: ProjectSummary = {
      id,
      slug: id,
      name: primitiveString(item.name, primitiveString(item.id, projectId)),
    }
    const organizationId = optionalTrimmedPrimitiveString(item.organization)
    if (organizationId !== undefined) {
      project.organizationId = organizationId
    }

    return project
  }

  /**
   * Walk the PostHog DRF-style cursor pagination (`results` + `next` URL)
   * until exhausted. The previous version only read the first page, which
   * silently truncated organizations and projects in larger workspaces and
   * caused "unknown project id" errors for projects that lived past the
   * default 100-row response.
   */
  private async fetchAllPaginated<T>(
    initialUrl: string,
    accessToken: string,
    signal?: AbortSignal,
  ): Promise<T[]> {
    // Bound the loop defensively so an upstream cycle in `next` cannot stall
    // the desktop app — 50 pages * 100 rows = 5k entities is way past any
    // realistic PostHog tenant size.
    const MAX_PAGES = 50
    const out: T[] = []
    let nextUrl: string | null = initialUrl
    let pageCount = 0
    while (nextUrl !== null) {
      if (pageCount >= MAX_PAGES) {
        // Bail with a clear error instead of silently truncating. Returning
        // a partial list lets callers report bogus "unknown project id"
        // errors against rows we never fetched.
        throw new Error(
          `PostHog paginator exceeded ${String(MAX_PAGES)} pages without exhausting results`,
        )
      }
      pageCount += 1
      const response = await this.requestWithRetry(nextUrl, {
        headers: this.authHeaders(accessToken),
        signal,
      })
      const parsed = postHogPaginatedSchema.parse(await response.json())
      if (parsed.results !== undefined) {
        for (const row of parsed.results) out.push(row as T)
      }
      // Only follow same-origin `next` URLs. PostHog returns a fully-
      // qualified URL here; trusting it verbatim would let an upstream
      // response (or a man-in-the-middle on an attacker-controlled
      // self-hosted instance) redirect our bearer token to another host.
      nextUrl = resolveSameOriginNextUrl(parsed.next, this.apiBase)
    }
    return out
  }

  async queryIssues(input: {
    accessToken: string
    orgSlug: string
    projectIds: string[]
    query: string
    limit?: number
    cursor?: string
    signal?: AbortSignal
  }): Promise<IssueBatchResponse> {
    const limit = boundedLimit(input.limit, DEFAULT_ISSUES_LIMIT)
    const trimmedQuery = input.query.trim()
    const projectIds = input.projectIds.filter(
      (projectId) => typeof projectId === 'string' && projectId.length > 0,
    )

    if (projectIds.length === 0) {
      return { issues: [], hasMore: false }
    }

    // Fetch the top `limit` issues per selected project, then merge by
    // recency (lastSeen desc) and slice to the global `limit`. The cursor is
    // a per-project offset map so each project advances only by the number
    // of rows actually consumed from that project — a global offset would
    // skip rows from quieter projects whose newer issues lose the
    // recency-merge tie to a noisier sibling.
    const perProjectOffsets = decodePerProjectCursor(input.cursor)
    const perProjectResults = await Promise.all(
      projectIds.map(async (projectId) => {
        const startOffset = perProjectOffsets[projectId] ?? 0
        const result = await this.runHogQLIssuesQuery({
          accessToken: input.accessToken,
          projectId,
          searchQuery: trimmedQuery,
          limit,
          offset: startOffset,
          signal: input.signal,
        })
        return { projectId, startOffset, ...result }
      }),
    )

    const merged = mergePostHogIssuesByRecency(perProjectResults, limit)
    return {
      issues: merged.issues,
      hasMore: merged.hasMore,
      nextCursor: nextPerProjectCursor(merged.hasMore, merged.nextOffsets),
    }
  }

  async listIssues(input: {
    accessToken: string
    orgSlug: string
    projectIds: string[]
    cursor?: string
    limit?: number
    since?: string
    until?: string
  }): Promise<IssueBatchResponse> {
    const limit = input.limit ?? DEFAULT_ISSUES_LIMIT
    const projectIds = input.projectIds.filter(
      (projectId) => typeof projectId === 'string' && projectId.length > 0,
    )

    if (projectIds.length === 0) {
      return { issues: [], hasMore: false }
    }

    const perProjectOffsets = decodePerProjectCursor(input.cursor)
    const perProjectResults = await Promise.all(
      projectIds.map(async (projectId) => {
        const startOffset = perProjectOffsets[projectId] ?? 0
        const result = await this.runHogQLIssuesQuery({
          accessToken: input.accessToken,
          projectId,
          searchQuery: '',
          since: input.since,
          until: input.until,
          limit,
          offset: startOffset,
        })
        return { projectId, startOffset, ...result }
      }),
    )

    const merged = mergePostHogIssuesByRecency(perProjectResults, limit)
    return {
      issues: merged.issues,
      hasMore: merged.hasMore,
      nextCursor: nextPerProjectCursor(merged.hasMore, merged.nextOffsets),
    }
  }

  async listIssueEvents(input: {
    accessToken: string
    orgSlug: string
    issueId: string
    cursor?: string
    projectIds?: string[]
    since?: string
    until?: string
  }): Promise<EventBatchResponse> {
    const offset = decodeOffsetCursor(input.cursor)
    const limit = DEFAULT_EVENTS_LIMIT
    // The issueId may be namespaced as `${projectId}:${fingerprint}` so two
    // PostHog projects under one source can keep separate upsert rows. Pull
    // the fingerprint back out for the HogQL filter and scope the sweep to
    // the namespaced project id when present.
    const { projectId: scopedProjectId, fingerprint } =
      extractPostHogIssueFingerprint(input.issueId)
    let projectIds = input.projectIds ?? []
    if (scopedProjectId !== undefined && scopedProjectId.length > 0) {
      projectIds = [scopedProjectId]
    }
    const candidateProjects = projectIds.filter(
      (projectId) => typeof projectId === 'string' && projectId.length > 0,
    )

    const events: Array<Record<string, unknown>> = []
    let aggregatedHasMore = false

    for (const projectId of candidateProjects) {
      const result = await this.runHogQLEventsQuery({
        accessToken: input.accessToken,
        projectId,
        fingerprint,
        limit,
        offset,
        since: input.since,
        until: input.until,
      })
      for (const event of result.events) events.push(event)
      aggregatedHasMore = aggregatedHasMore || result.hasMore
    }

    return {
      events,
      hasMore: aggregatedHasMore,
      nextCursor: nextOffsetCursor(aggregatedHasMore, offset + limit),
    }
  }

  private async runHogQLIssuesQuery(input: {
    accessToken: string
    projectId: string
    searchQuery: string
    since?: string
    until?: string
    limit: number
    offset: number
    signal?: AbortSignal
  }): Promise<{ issues: Array<Record<string, unknown>>; hasMore: boolean }> {
    const hogQL = buildPostHogIssuesHogQL({
      projectId: input.projectId,
      searchQuery: input.searchQuery,
      since: input.since,
      until: input.until,
      limit: input.limit,
      offset: input.offset,
    })

    const response = await this.runHogQLQuery({
      accessToken: input.accessToken,
      projectId: input.projectId,
      hogQL,
      signal: input.signal,
    })

    const columns = response.columns ?? []
    const rawResults = response.results ?? []
    const overFetched = rawResults.length > input.limit
    const usableRows = limitRows(rawResults, input.limit)
    const issues = usableRows
      .map((row) => {
        const rawIssue = rowToObject(row, columns)
        const issue = buildPostHogIssueRecord(rawIssue)
        if (issue.title === 'Untitled exception') {
          log.warn('[posthog] issue title fallback hit', {
            projectId: input.projectId,
            searchQuery: input.searchQuery,
            summary: summarizeUntitledIssueRow(rawIssue),
          })
        }
        return issue
      })
      .filter((issue) => Boolean(issue.id))

    return {
      issues,
      hasMore: overFetched || Boolean(response.hasMore ?? response.has_more),
    }
  }

  private async runHogQLEventsQuery(input: {
    accessToken: string
    projectId: string
    fingerprint: string
    limit: number
    offset: number
    signal?: AbortSignal
    since?: string
    until?: string
  }): Promise<{ events: Array<Record<string, unknown>>; hasMore: boolean }> {
    const hogQL = buildPostHogEventsHogQL({
      projectId: input.projectId,
      fingerprint: input.fingerprint,
      limit: input.limit,
      offset: input.offset,
      since: input.since,
      until: input.until,
    })

    const response = await this.runHogQLQuery({
      accessToken: input.accessToken,
      projectId: input.projectId,
      hogQL,
      signal: input.signal,
    })

    const columns = response.columns ?? []
    const rawResults = response.results ?? []
    const overFetched = rawResults.length > input.limit
    const usableRows = limitRows(rawResults, input.limit)
    const events = usableRows
      .map((row) => buildPostHogEventRecord(rowToObject(row, columns)))
      .filter((event) => Boolean(event.id))

    return {
      events,
      hasMore: overFetched || Boolean(response.hasMore ?? response.has_more),
    }
  }

  private async runHogQLQuery(input: {
    accessToken: string
    projectId: string
    hogQL: string
    signal?: AbortSignal
  }): Promise<PostHogHogQLResponse> {
    const url = `${this.apiBase}/api/projects/${encodeURIComponent(input.projectId)}/query/`
    const startMs = Date.now()
    log.info(
      `[posthog] HogQL start project=${input.projectId} chars=${String(input.hogQL.length)}`,
    )
    const response = await this.requestWithRetry(url, {
      method: 'POST',
      headers: {
        ...this.authHeaders(input.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: { kind: 'HogQLQuery', query: input.hogQL },
      }),
      signal: input.signal,
    })

    const parsed = parsePostHogHogQLResponse(await response.json())
    const rowCount = parsed.results?.length ?? 0
    log.info(
      `[posthog] HogQL done project=${input.projectId} rows=${String(rowCount)} elapsedMs=${String(Date.now() - startMs)}`,
    )
    return parsed
  }

  private authHeaders(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    }
  }

  private async requestWithRetry(
    url: string,
    init: RequestInit,
    maxAttempts = 5,
  ): Promise<Response> {
    let attempt = 0
    let delayMs = 1_000
    const requestStartMs = Date.now()

    while (attempt < maxAttempts) {
      attempt += 1
      const context: RetryAttemptContext = {
        url,
        init,
        attempt,
        maxAttempts,
        requestStartMs,
        delayMs,
      }
      const response = await this.fetchAttempt(context)
      if (response === null) {
        delayMs = this.nextBackoff(delayMs)
        continue
      }

      if (response.ok) {
        this.logRequestSuccess(context)
        return response
      }

      const nextDelay = await this.handleHttpFailure(response, context)
      await this.waitForRetry(nextDelay, init.signal)
      delayMs = this.nextBackoff(delayMs)
    }

    log.error(
      `[posthog] request failed after ${String(maxAttempts)} attempts totalMs=${String(Date.now() - requestStartMs)} url=${url}`,
    )
    throw new Error('PostHog API request failed after retries')
  }

  private async fetchAttempt(context: RetryAttemptContext): Promise<Response | null> {
    const attemptStartMs = Date.now()
    try {
      return await fetch(context.url, {
        ...context.init,
        signal: this.withRequestTimeout(context.init.signal),
      })
    } catch (error) {
      await this.handleFetchFailure(error, context, Date.now() - attemptStartMs)
      return null
    }
  }

  private async handleFetchFailure(
    error: unknown,
    context: RetryAttemptContext,
    elapsedMs: number,
  ): Promise<void> {
    if (this.isAbortSignalAborted(context.init.signal)) {
      log.warn(
        `[posthog] request cancelled url=${context.url} attempt=${attemptLabel(context.attempt, context.maxAttempts)} elapsedMs=${String(elapsedMs)}`,
      )
      throw new Error('PostHog API request cancelled')
    }

    const message = toErrorMessage(error)
    log.warn(
      `[posthog] fetch failed url=${context.url} attempt=${attemptLabel(context.attempt, context.maxAttempts)} elapsedMs=${String(elapsedMs)} error="${message}"`,
    )
    if (context.attempt >= context.maxAttempts) {
      log.error(
        `[posthog] giving up after ${String(context.attempt)} attempts totalMs=${String(Date.now() - context.requestStartMs)} url=${context.url}`,
      )
      throw new Error(`PostHog API request failed: ${message}`)
    }

    log.info(
      `[posthog] backing off ${String(context.delayMs)}ms before retry ${String(context.attempt + 1)}`,
    )
    await this.waitForRetry(context.delayMs, context.init.signal)
  }

  private logRequestSuccess(context: RetryAttemptContext): void {
    if (context.attempt <= 1) return

    log.info(
      `[posthog] succeeded on attempt ${attemptLabel(context.attempt, context.maxAttempts)} totalMs=${String(Date.now() - context.requestStartMs)} url=${context.url}`,
    )
  }

  private async handleHttpFailure(
    response: Response,
    context: RetryAttemptContext,
  ): Promise<number> {
    const status = response.status
    const isRetryable = status === 429 || status >= 500
    if (!isRetryable || context.attempt >= context.maxAttempts) {
      const body = await response.text().catch(() => '')
      log.error(
        `[posthog] non-retryable status=${String(status)} attempt=${attemptLabel(context.attempt, context.maxAttempts)} url=${context.url} body="${body.slice(0, 200)}"`,
      )
      throw new Error(`PostHog API ${String(status)}: ${parsePostHogErrorBody(body)}`)
    }

    const retryAfterHeader = response.headers.get('retry-after')
    const nextDelay = retryDelayFromHeader(retryAfterHeader, context.delayMs)
    log.warn(
      `[posthog] retryable status=${String(status)} attempt=${attemptLabel(context.attempt, context.maxAttempts)} retryAfterHeader=${retryAfterHeader ?? 'none'} backoffMs=${String(nextDelay)} url=${context.url}`,
    )
    return nextDelay
  }

  private nextBackoff(delayMs: number): number {
    return Math.min(delayMs * 2, 30_000)
  }

  private withRequestTimeout(signal: AbortSignal | null | undefined): AbortSignal {
    const timeoutSignal = AbortSignal.timeout(30_000)
    if (signal !== null && signal !== undefined) {
      return AbortSignal.any([signal, timeoutSignal])
    }

    return timeoutSignal
  }

  private isAbortSignalAborted(signal: AbortSignal | null | undefined): boolean {
    return signal?.aborted === true
  }

  private async waitForRetry(
    delayMs: number,
    signal: AbortSignal | null | undefined,
  ): Promise<void> {
    if (signal === null || signal === undefined) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return
    }
    if (signal.aborted) {
      throw new Error('PostHog API request cancelled')
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal.removeEventListener('abort', handleAbort)
        resolve()
      }, delayMs)
      const handleAbort = (): void => {
        clearTimeout(timeout)
        reject(new Error('PostHog API request cancelled'))
      }
      signal.addEventListener('abort', handleAbort, { once: true })
    })
  }
}
