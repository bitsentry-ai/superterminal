import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SqliteErrorSourcesRepositoryAdapter,
  type ErrorSourceDatabase,
} from '@bitsentry-ce/core/features/error-sources/desktop-sqlite-error-sources.adapter'
import { SentryProviderAdapter } from '@bitsentry-ce/core/features/error-sources/desktop-sentry-provider.adapter'
import { ErrorSourceSyncService } from '@bitsentry-ce/core/features/error-sources/desktop-error-source-sync.service'
import type { ErrorSourceProvider } from '@bitsentry-ce/core/features/error-sources/desktop-error-source-provider.interface'
import type { UpsertErrorIssueInput } from '@bitsentry-ce/core/features/error-sources/desktop-sqlite-error-issues.adapter'
import type { ErrorIssue, ErrorSource } from '@bitsentry-ce/core/features/error-sources/desktop-error-sources.types'

function makeSource(overrides: Partial<ErrorSource> = {}): ErrorSource {
  return {
    id: 'source-sentry',
    sourceType: 'sentry',
    name: 'Jagad',
    accessTokenRef: 'token',
    refreshTokenRef: null,
    expiresAt: null,
    grantedScopes: [],
    configuration: {
      orgSlug: 'jagad',
      projectIds: ['4504367120777216'],
    },
    logLevelThreshold: 'error',
    additionalMetadata: null,
    syncEnabled: true,
    autoDiagnosisEnabled: false,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null
}

function rejectUnexpectedDatabaseCall(): Promise<never> {
  return Promise.reject(new Error('Unexpected error source database call'))
}

function makeIssue(input: UpsertErrorIssueInput): ErrorIssue {
  return {
    id: `local-${input.externalIssueId}`,
    sourceId: input.sourceId,
    externalIssueId: input.externalIssueId,
    externalShortId: nullable(input.externalShortId),
    title: input.title,
    culprit: nullable(input.culprit),
    type: nullable(input.type),
    metadata: nullable(input.metadata),
    projectIdentifier: nullable(input.projectIdentifier),
    level: input.level,
    status: input.status,
    isUnhandled: nullable(input.isUnhandled),
    firstSeen: input.firstSeen,
    lastSeen: input.lastSeen,
    eventCount: input.eventCount,
    userCount: nullable(input.userCount),
    tags: nullable(input.tags),
    environment: nullable(input.environment),
    release: nullable(input.release),
    platform: nullable(input.platform),
    additionalMetadata: nullable(input.additionalMetadata),
    diagnosisStatus: null,
    diagnosisResult: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

describe('Sentry external source sync', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('bounds the first Sentry sync to a latest snapshot instead of walking full event history', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T09:00:00.000Z'))

    const source = makeSource()
    const issues = Array.from({ length: 20 }, (_, index) => ({
      id: `issue-${String(index + 1)}`,
      title: `Issue ${String(index + 1)}`,
      level: 'error',
      count: 1,
      firstSeen: '2026-06-01T08:00:00.000Z',
      lastSeen: '2026-06-01T08:00:00.000Z',
    }))
    const provider = {
      sourceType: 'sentry',
      buildAuthorizeUrl: vi.fn(),
      exchangeCodeForToken: vi.fn(),
      refreshToken: vi.fn(),
      listOrganizations: vi.fn(),
      listProjects: vi.fn(),
      queryIssues: vi.fn(),
      listIssues: vi.fn().mockResolvedValue({
        issues,
        hasMore: true,
        nextCursor: 'next-issues',
      }),
      listIssueEvents: vi.fn().mockResolvedValue({
        events: [],
        hasMore: true,
        nextCursor: 'next-events',
      }),
    } satisfies ErrorSourceProvider
    const sourcesRepository = {
      findById: vi.fn().mockResolvedValue(source),
      findSyncEnabled: vi.fn().mockResolvedValue([source]),
      updateSyncStatus: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(source),
    }
    const service = new ErrorSourceSyncService(
      {
        $queryRawUnsafe: () => Promise.resolve([]),
        telemetryDaily: { upsert: vi.fn() },
        telemetryEntry: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
        diagnosisEntry: { upsert: vi.fn() },
        diagnosisEntrySourceRef: { upsert: vi.fn() },
      },
      sourcesRepository,
      {
        upsert: vi.fn((input: UpsertErrorIssueInput) => Promise.resolve(makeIssue(input))),
        findById: vi.fn(),
      },
      {
        upsert: vi.fn(),
        findById: vi.fn(),
      },
      {
        getProvider: vi.fn(() => provider),
      },
    )

    const result = await service.syncSourceById(source.id)

    expect(result).toEqual({
      sourceId: source.id,
      syncedIssues: 20,
      syncedEvents: 0,
    })
    expect(provider.listIssues).toHaveBeenCalledTimes(1)
    expect(provider.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        since: '2026-05-25T09:00:00.000Z',
      }),
    )
    expect(provider.listIssueEvents).toHaveBeenCalledTimes(20)
    expect(sourcesRepository.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: source.id,
        lastSyncStatus: 'success',
        lastSyncError: null,
        lastSyncAt: '2026-06-01T09:00:00.000Z',
      }),
    )
  })

  it('queries Sentry by last seen when doing incremental source sync', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new SentryProviderAdapter()
    await provider.listIssues({
      accessToken: 'token',
      orgSlug: 'jagad',
      projectIds: ['4504367120777216'],
      since: '2026-06-01T08:00:00.000Z',
      limit: 20,
    })

    const url = String(fetchMock.mock.calls[0]?.[0] ?? '')
    expect(url).toContain('limit=20')
    expect(url).toContain('project=4504367120777216')
    expect(decodeURIComponent(url)).toContain('query=lastSeen:>=2026-06-01T08:00:00.000Z')
  })

  it('can clear interrupted in-progress source sync status', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db: ErrorSourceDatabase = {
      errorSource: {
        create: rejectUnexpectedDatabaseCall,
        delete: rejectUnexpectedDatabaseCall,
        findMany: rejectUnexpectedDatabaseCall,
        findUnique: rejectUnexpectedDatabaseCall,
        update: rejectUnexpectedDatabaseCall,
        updateMany,
      },
    }
    const repository = new SqliteErrorSourcesRepositoryAdapter(db)

    await expect(
      repository.markInterruptedSyncsFailed('Previous sync was interrupted before completion.'),
    ).resolves.toBe(1)

    expect(updateMany).toHaveBeenCalledWith({
      where: { lastSyncStatus: 'in_progress' },
      data: {
        lastSyncStatus: 'failed',
        lastSyncError: 'Previous sync was interrupted before completion.',
      },
    })
  })
})
