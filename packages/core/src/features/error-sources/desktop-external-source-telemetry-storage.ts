import { z } from 'zod'
import type {
  ErrorEvent,
  ErrorIssue,
  ErrorSourceType,
} from './desktop-error-sources.types'

const COMPACT_EXTERNAL_SOURCE_PAYLOAD_SCHEMA = 'external-source-ref'
const COMPACT_EXTERNAL_SOURCE_PAYLOAD_VERSION = 1
const FULL_LOG_SUMMARY_MAX_LENGTH = 1024

type JsonObject = Record<string, unknown>
const jsonObjectSchema = z.record(z.string(), z.unknown())
type CompactPayloadEntry = {
  parsed: Record<string, unknown>
  compact: CompactExternalSourceTelemetryPayload
}
type CompactPayloadCollection = {
  compactPayloads: Map<number, CompactPayloadEntry>
  sourceIds: Set<string>
  issueIds: Set<string>
  eventIds: Set<string>
}

export interface CompactExternalSourceTelemetryPayload {
  schema: typeof COMPACT_EXTERNAL_SOURCE_PAYLOAD_SCHEMA
  version: typeof COMPACT_EXTERNAL_SOURCE_PAYLOAD_VERSION
  sourceType: ErrorSourceType
  sourceId: string
  issueId: string | null
  issueExternalId: string | null
  issueTitle: string | null
  issueEnvironment: string | null
  projectIdentifier: string | null
  eventId: string | null
  eventExternalId: string | null
  eventMessage: string | null
  eventExceptionValue: string | null
  eventEnvironment: string | null
  serverName: string | null
}

export interface ExternalSourceTelemetryStorageDb {
  errorSource: {
    findMany(args: { where: { id: { in: string[] } } }): Promise<unknown[]>
  }
  errorIssue: {
    findMany(args: { where: { id: { in: string[] } } }): Promise<unknown[]>
  }
  errorEvent: {
    findMany(args: { where: { id: { in: string[] } } }): Promise<unknown[]>
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseJsonObjectRecord(value: unknown): JsonObject {
  return jsonObjectSchema.parse(value)
}

function primitiveString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback
  }

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

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(primitiveString(value))
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  return new Date(0).toISOString()
}

function trimOrNull(value: unknown): string | null {
  const normalized = primitiveString(value).trim()
  if (normalized.length > 0) {
    return normalized
  }

  return null
}

function nullableBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  return Boolean(value)
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  return Number(value)
}

function truncate(value: string, limit = FULL_LOG_SUMMARY_MAX_LENGTH): string {
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 3))}...`
}

export function parseTelemetryEntrySource(value: unknown): JsonObject | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as JsonObject
    }
  } catch {
    // no-op
  }
  return null
}

export function isCompactExternalSourceTelemetryPayload(
  value: unknown,
): value is CompactExternalSourceTelemetryPayload {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const payload = value as Record<string, unknown>
  return (
    payload.schema === COMPACT_EXTERNAL_SOURCE_PAYLOAD_SCHEMA &&
    Number(payload.version) === COMPACT_EXTERNAL_SOURCE_PAYLOAD_VERSION &&
    typeof payload.sourceId === 'string' &&
    typeof payload.sourceType === 'string'
  )
}

export function buildCompactExternalSourceTelemetryPayload(params: {
  sourceType: ErrorSourceType
  sourceId: string
  issue: Pick<ErrorIssue, 'id' | 'externalIssueId' | 'title' | 'environment' | 'projectIdentifier'>
  event: Pick<
    ErrorEvent,
    'id' | 'externalEventId' | 'message' | 'exceptionValue' | 'environment' | 'serverName'
  >
}): CompactExternalSourceTelemetryPayload {
  return {
    schema: COMPACT_EXTERNAL_SOURCE_PAYLOAD_SCHEMA,
    version: COMPACT_EXTERNAL_SOURCE_PAYLOAD_VERSION,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    issueId: params.issue.id,
    issueExternalId: params.issue.externalIssueId,
    issueTitle: params.issue.title,
    issueEnvironment: params.issue.environment,
    projectIdentifier: params.issue.projectIdentifier,
    eventId: params.event.id,
    eventExternalId: params.event.externalEventId,
    eventMessage: params.event.message,
    eventExceptionValue: params.event.exceptionValue,
    eventEnvironment: params.event.environment,
    serverName: params.event.serverName,
  }
}

export function buildCompactExternalSourceIssueFallback(
  payload: CompactExternalSourceTelemetryPayload,
): Record<string, unknown> | null {
  if (
    payload.issueId === null &&
    payload.issueExternalId === null &&
    payload.issueTitle === null
  ) {
    return null
  }

  return {
    id: payload.issueId,
    externalIssueId: payload.issueExternalId,
    title: payload.issueTitle,
    environment: payload.issueEnvironment,
    projectIdentifier: payload.projectIdentifier,
  }
}

export function buildCompactExternalSourceEventFallback(
  payload: CompactExternalSourceTelemetryPayload,
): Record<string, unknown> | null {
  if (
    payload.eventId === null &&
    payload.eventExternalId === null &&
    payload.eventMessage === null &&
    payload.eventExceptionValue === null
  ) {
    return null
  }

  return {
    id: payload.eventId,
    externalEventId: payload.eventExternalId,
    message: payload.eventMessage,
    exceptionValue: payload.eventExceptionValue,
    environment: payload.eventEnvironment,
    serverName: payload.serverName,
  }
}

export function summarizeExternalSourcePayload(
  payload: CompactExternalSourceTelemetryPayload,
): string {
  const primary =
    trimOrNull(payload.eventMessage) ??
    trimOrNull(payload.eventExceptionValue) ??
    trimOrNull(payload.issueTitle) ??
    `${payload.sourceType.toUpperCase()} error event`

  const identifiers = [
    trimOrNull(payload.projectIdentifier),
    trimOrNull(payload.issueExternalId),
    trimOrNull(payload.eventExternalId),
  ].filter((value): value is string => value != null)

  if (identifiers.length === 0) {
    return truncate(primary)
  }

  return truncate(`${primary} [${identifiers.join(' | ')}]`)
}

function mapIssueRow(row: unknown): ErrorIssue {
  const record = parseJsonObjectRecord(row)
  return {
    id: String(record.id),
    sourceId: String(record.sourceId),
    externalIssueId: String(record.externalIssueId),
    externalShortId: trimOrNull(record.externalShortId),
    title: primitiveString(record.title),
    culprit: trimOrNull(record.culprit),
    type: trimOrNull(record.type),
    metadata: parseJson<Record<string, unknown> | null>(record.metadata, null),
    projectIdentifier: trimOrNull(record.projectIdentifier),
    level: primitiveString(record.level, 'error'),
    status: primitiveString(record.status, 'unresolved'),
    isUnhandled: nullableBoolean(record.isUnhandled),
    firstSeen: toIso(record.firstSeen),
    lastSeen: toIso(record.lastSeen),
    eventCount: Number(record.eventCount ?? 0),
    userCount: nullableNumber(record.userCount),
    tags: parseJson<Record<string, unknown> | null>(record.tags, null),
    environment: trimOrNull(record.environment),
    release: trimOrNull(record.release),
    platform: trimOrNull(record.platform),
    additionalMetadata: parseJson<Record<string, unknown> | null>(
      record.additionalMetadata,
      null,
    ),
    diagnosisStatus: trimOrNull(record.diagnosisStatus),
    diagnosisResult: parseJson<Record<string, unknown> | null>(record.diagnosisResult, null),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  }
}

function mapEventRow(row: unknown): ErrorEvent {
  const record = parseJsonObjectRecord(row)
  return {
    id: String(record.id),
    sourceId: String(record.sourceId),
    issueId: String(record.issueId),
    externalEventId: String(record.externalEventId),
    timestamp: toIso(record.timestamp),
    message: trimOrNull(record.message),
    exceptionType: trimOrNull(record.exceptionType),
    exceptionValue: trimOrNull(record.exceptionValue),
    exceptionMechanism: parseJson<Record<string, unknown> | null>(
      record.exceptionMechanism,
      null,
    ),
    stacktrace: parseJson<Record<string, unknown> | null>(record.stacktrace, null),
    inAppFrames: parseJson<Array<Record<string, unknown>> | null>(record.inAppFrames, null),
    tags: parseJson<Record<string, unknown> | null>(record.tags, null),
    contexts: parseJson<Record<string, unknown> | null>(record.contexts, null),
    userContext: parseJson<Record<string, unknown> | null>(record.userContext, null),
    requestContext: parseJson<Record<string, unknown> | null>(record.requestContext, null),
    environment: trimOrNull(record.environment),
    release: trimOrNull(record.release),
    serverName: trimOrNull(record.serverName),
    traceId: trimOrNull(record.traceId),
    requestId: trimOrNull(record.requestId),
    transactionName: trimOrNull(record.transactionName),
    additionalMetadata: parseJson<Record<string, unknown> | null>(
      record.additionalMetadata,
      null,
    ),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  }
}

function collectCompactPayloads(
  rows: Array<Record<string, unknown>>,
): CompactPayloadCollection {
  const compactPayloads = new Map<number, CompactPayloadEntry>()
  const sourceIds = new Set<string>()
  const issueIds = new Set<string>()
  const eventIds = new Set<string>()

  for (const row of rows) {
    const telemetryEntryId = Number(row.id)
    if (!Number.isFinite(telemetryEntryId)) continue
    const parsed = parseTelemetryEntrySource(row.entrySource ?? row.fullLog)
    if (!isCompactExternalSourceTelemetryPayload(parsed)) continue

    compactPayloads.set(telemetryEntryId, { parsed, compact: parsed })
    sourceIds.add(parsed.sourceId)
    if (parsed.issueId !== null) issueIds.add(parsed.issueId)
    if (parsed.eventId !== null) eventIds.add(parsed.eventId)
  }

  return {
    compactPayloads,
    sourceIds,
    issueIds,
    eventIds,
  }
}

async function findErrorSourcesByIds(
  db: ExternalSourceTelemetryStorageDb,
  ids: Set<string>,
) {
  if (ids.size === 0) {
    return []
  }

  return db.errorSource.findMany({ where: { id: { in: [...ids] } } })
}

async function findErrorIssuesByIds(
  db: ExternalSourceTelemetryStorageDb,
  ids: Set<string>,
) {
  if (ids.size === 0) {
    return []
  }

  return db.errorIssue.findMany({ where: { id: { in: [...ids] } } })
}

async function findErrorEventsByIds(
  db: ExternalSourceTelemetryStorageDb,
  ids: Set<string>,
) {
  if (ids.size === 0) {
    return []
  }

  return db.errorEvent.findMany({ where: { id: { in: [...ids] } } })
}

function toSourceMap(
  sourceRows: unknown[],
): Map<string, { id: string; sourceType: string; name: string | null }> {
  return new Map(
    sourceRows.map((row: unknown) => {
      const record = parseJsonObjectRecord(row)
      return [
        String(record.id),
        {
          id: String(record.id),
          sourceType: primitiveString(record.sourceType),
          name: trimOrNull(record.name),
        },
      ]
    }),
  )
}

function toIssueMap(issueRows: unknown[]): Map<string, ErrorIssue> {
  return new Map(
    issueRows.map((row: unknown) => {
      const record = parseJsonObjectRecord(row)
      return [String(record.id), mapIssueRow(record)]
    }),
  )
}

function toEventMap(eventRows: unknown[]): Map<string, ErrorEvent> {
  return new Map(
    eventRows.map((row: unknown) => {
      const record = parseJsonObjectRecord(row)
      return [String(record.id), mapEventRow(record)]
    }),
  )
}

function nullableMapValue<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey | null,
): TValue | null {
  if (key === null) {
    return null
  }

  return map.get(key) ?? null
}

function hydrateCompactPayloadEntries(
  compactPayloads: Map<number, CompactPayloadEntry>,
  sourceMap: Map<string, { id: string; sourceType: string; name: string | null }>,
  issueMap: Map<string, ErrorIssue>,
  eventMap: Map<string, ErrorEvent>,
): Map<number, Record<string, unknown>> {
  const hydrated = new Map<number, Record<string, unknown>>()

  for (const [telemetryEntryId, { parsed, compact }] of compactPayloads) {
    const source = sourceMap.get(compact.sourceId)
    const issue = nullableMapValue(issueMap, compact.issueId)
    const event = nullableMapValue(eventMap, compact.eventId)

    hydrated.set(telemetryEntryId, {
      ...parsed,
      sourceType: source?.sourceType ?? compact.sourceType,
      sourceId: compact.sourceId,
      sourceName: source?.name ?? null,
      issue: issue ?? buildCompactExternalSourceIssueFallback(compact),
      event: event ?? buildCompactExternalSourceEventFallback(compact),
    })
  }

  return hydrated
}

export async function hydrateCompactExternalSourcePayloads(
  db: ExternalSourceTelemetryStorageDb,
  rows: Array<Record<string, unknown>>,
): Promise<Map<number, Record<string, unknown>>> {
  const { compactPayloads, sourceIds, issueIds, eventIds } =
    collectCompactPayloads(rows)

  if (compactPayloads.size === 0) {
    return new Map()
  }

  const [sourceRows, issueRows, eventRows] = await Promise.all([
    findErrorSourcesByIds(db, sourceIds),
    findErrorIssuesByIds(db, issueIds),
    findErrorEventsByIds(db, eventIds),
  ])

  const sourceMap = toSourceMap(sourceRows)
  const issueMap = toIssueMap(issueRows)
  const eventMap = toEventMap(eventRows)
  return hydrateCompactPayloadEntries(
    compactPayloads,
    sourceMap,
    issueMap,
    eventMap,
  )
}
