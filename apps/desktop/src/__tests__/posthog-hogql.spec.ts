import { describe, expect, it } from 'vitest'

import {
  buildPostHogIssueRecord,
  buildPostHogEventsHogQL,
  buildPostHogIssuesHogQL,
  mergePostHogIssuesByRecency,
  parsePostHogHogQLResponse,
  quoteHogQLUtcDateTime64,
} from '@bitsentry-ce/core/features/error-sources'

describe('posthog HogQL timestamp filters', () => {
  it('casts sync watermarks to explicit UTC DateTime64 literals', () => {
    expect(quoteHogQLUtcDateTime64('2026-05-12T04:42:07.163Z')).toBe(
      "toDateTime64('2026-05-12 04:42:07.163000', 6, 'UTC')",
    )
  })

  it('uses DateTime64 casts for aggregated issue windows', () => {
    const query = buildPostHogIssuesHogQL({
      projectId: '123',
      limit: 50,
      since: '2026-05-12T04:42:07.163Z',
      until: '2026-05-12T05:42:07.456Z',
    })

    expect(query).toContain(
      "max(timestamp) >= toDateTime64('2026-05-12 04:42:07.163000', 6, 'UTC')",
    )
    expect(query).toContain(
      "max(timestamp) <= toDateTime64('2026-05-12 05:42:07.456000', 6, 'UTC')",
    )
  })

  it('searches across message, type, fingerprint, and exception list', () => {
    const query = buildPostHogIssuesHogQL({
      projectId: '123',
      limit: 50,
      searchQuery: 'error',
    })

    expect(query).toContain("properties.$exception_message ILIKE '%error%'")
    expect(query).toContain("properties.$exception_type ILIKE '%error%'")
    expect(query).toContain("properties.$exception_fingerprint ILIKE '%error%'")
    expect(query).toContain("toString(properties.$exception_list) ILIKE '%error%'")
  })

  it('strips whole-query Markdown code wrappers from search text', () => {
    const query = buildPostHogIssuesHogQL({
      projectId: '123',
      limit: 50,
      searchQuery: '`error`',
    })

    expect(query).toContain("properties.$exception_message ILIKE '%error%'")
    expect(query).not.toContain("'%`error`%'")
  })

  it('uses DateTime64 casts for per-event windows', () => {
    const query = buildPostHogEventsHogQL({
      projectId: '123',
      fingerprint: 'fingerprint-1',
      limit: 50,
      since: '2026-05-12T04:42:07.163Z',
      until: '2026-05-12T05:42:07.456Z',
    })

    expect(query).toContain(
      "timestamp >= toDateTime64('2026-05-12 04:42:07.163000', 6, 'UTC')",
    )
    expect(query).toContain(
      "timestamp <= toDateTime64('2026-05-12 05:42:07.456000', 6, 'UTC')",
    )
  })

  it('accepts null pagination metadata from PostHog query responses', () => {
    expect(
      parsePostHogHogQLResponse({
        columns: ['fingerprint'],
        results: [['abc']],
        hasMore: null,
        limit: null,
        offset: null,
      }),
    ).toEqual({
      columns: ['fingerprint'],
      results: [['abc']],
      hasMore: undefined,
      limit: undefined,
      offset: undefined,
    })
  })

  it('derives issue titles from exception_list when top-level fields are missing', () => {
    const issue = buildPostHogIssueRecord({
      fingerprint: 'fp-1',
      project_id: '123',
      exception_list: [
        {
          type: 'EmailDeliveryError',
          value: 'SMTP 550 mailbox full',
        },
      ],
      level: 'error',
      first_seen: '2026-05-12T04:31:56.740Z',
      last_seen: '2026-05-12T04:55:40.560Z',
      event_count: 19,
      user_count: 16,
    })

    expect(issue.title).toBe('EmailDeliveryError: SMTP 550 mailbox full')
    expect(issue.exceptionType).toBe('EmailDeliveryError')
    expect(issue.message).toBe('SMTP 550 mailbox full')
  })

  it('derives issue titles from stringified exception_list payloads', () => {
    const issue = buildPostHogIssueRecord({
      fingerprint: 'fp-2',
      project_id: '123',
      exception_list: JSON.stringify([
        {
          type: 'JSONDecodeError',
          value: 'Expecting property name enclosed in double quotes',
        },
      ]),
      level: 'error',
      first_seen: '2026-05-12T04:31:56.740Z',
      last_seen: '2026-05-12T04:55:40.560Z',
      event_count: 1,
      user_count: 1,
    })

    expect(issue.title).toBe(
      'JSONDecodeError: Expecting property name enclosed in double quotes',
    )
  })

  it('drops PostHog issue rows with empty fingerprints from downstream filters', () => {
    const issue = buildPostHogIssueRecord({
      fingerprint: '',
      project_id: '123',
      message: 'Missing fingerprint',
      last_seen: '2026-05-12T04:55:40.560Z',
    })

    expect(issue.id).toBe('')
    expect(issue.fingerprint).toBe('')
  })

  it('preserves offsets for exhausted projects while another project has more rows', () => {
    const merged = mergePostHogIssuesByRecency(
      [
        {
          projectId: 'busy',
          startOffset: 50,
          issues: [
            { id: 'busy:newer', lastSeen: '2026-05-12T05:00:00.000Z' },
            { id: 'busy:older', lastSeen: '2026-05-12T04:00:00.000Z' },
          ],
          hasMore: true,
        },
        {
          projectId: 'quiet',
          startOffset: 20,
          issues: [],
          hasMore: false,
        },
      ],
      1,
    )

    expect(merged.hasMore).toBe(true)
    expect(merged.nextOffsets).toEqual({
      busy: 51,
      quiet: 20,
    })
  })
})
