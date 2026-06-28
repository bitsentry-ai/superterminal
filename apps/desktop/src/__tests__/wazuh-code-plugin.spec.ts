import path from 'path'

import { createDesktopNodePluginRuntimeService } from '@bitsentry-ce/core/features/plugins/node'
import { afterEach, describe, expect, it, vi } from 'vitest'

type WazuhPluginData = {
  items?: Array<{ _id?: string }>
  issues?: Array<{
    externalIssueId?: string
    level?: string
    platform?: string
    serverName?: string
    title?: string
  }>
  output?: string
  total?: number
  hasMore?: boolean
}

describe('Wazuh code plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads from the repo-managed plugin directory and executes search_alerts', async () => {
    const pluginDirectory = path.resolve(process.cwd(), '../../packages/plugins')
    const runtime = createDesktopNodePluginRuntimeService([pluginDirectory])
    const descriptor = runtime.getPlugin('wazuh')

    expect(descriptor).toMatchObject({
      id: 'wazuh',
      metadata: {
        errorSource: {
          sourceType: 'wazuh',
          providerActions: {
            queryIssues: 'query_issues',
            searchAlerts: 'search_alerts',
          },
        },
      },
    })

    const fetchMock = vi.fn<(url: string, request?: RequestInit) => Promise<Response>>().mockImplementation(
      () => Promise.resolve(new Response(
        JSON.stringify({
          hits: {
            total: { value: 1, relation: 'eq' },
            hits: [
              {
                _id: 'alert-1',
                _index: 'wazuh-alerts-4.x-2026.06.01',
                _score: 1,
                _source: {
                  '@timestamp': '2026-06-01T00:05:00.000Z',
                  rule: {
                    id: '5710',
                    level: 10,
                    description: 'sshd brute force attempt',
                  },
                  agent: {
                    name: 'prod-api-1',
                  },
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runtime.executeAction({
      pluginId: 'wazuh',
      actionId: 'search_alerts',
      auth: {
        indexUrl: 'https://wazuh.example.com:9200',
        indexPassword: 'wazuh-secret',
      },
      input: {
        query: 'rule.level:>=10',
        indexPattern: 'wazuh-alerts-*',
        limit: 2,
        offset: 0,
        since: '2026-06-01T00:00:00.000Z',
        until: '2026-06-01T01:00:00.000Z',
      },
    })

    expect(result).toMatchObject({
      pluginId: 'wazuh',
      actionId: 'search_alerts',
      ok: true,
      status: 200,
      summary: 'Fetched 1 Wazuh alerts.',
      data: {
        hasMore: false,
        total: 1,
      },
    })
    const data = result.data as WazuhPluginData
    expect(data.items?.[0]?._id).toBe('alert-1')
    expect(data.output).toContain('sshd brute force attempt')

    const queryResult = await runtime.executeAction({
      pluginId: 'wazuh',
      actionId: 'query_issues',
      auth: {
        indexUrl: 'https://wazuh.example.com:9200',
        indexPassword: 'wazuh-secret',
      },
      input: {
        query: 'rule.level:>=10',
        indexPattern: 'wazuh-alerts-*',
        limit: 2,
        cursor: '4',
        since: '2026-06-01T00:00:00.000Z',
        until: '2026-06-01T01:00:00.000Z',
      },
    })

    expect(queryResult).toMatchObject({
      pluginId: 'wazuh',
      actionId: 'query_issues',
      ok: true,
      status: 200,
      summary: 'Fetched 1 Wazuh issues.',
      data: {
        issues: [
          {
            externalIssueId: 'alert-1',
            level: 'error',
            platform: 'wazuh',
            serverName: 'prod-api-1',
            title: 'sshd brute force attempt',
          },
        ],
        hasMore: false,
        total: 1,
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstCall = fetchMock.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('Expected Wazuh plugin to call fetch')
    }

    const [url, request] = firstCall
    expect(url).toBe('https://wazuh.example.com:9200/wazuh-alerts-*/_search')
    if (request === undefined) {
      throw new Error('Expected Wazuh plugin to pass a fetch request')
    }

    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from('admin:wazuh-secret').toString('base64')}`,
        'Content-Type': 'application/json',
      },
    })

    if (typeof request.body !== 'string') {
      throw new Error('Expected Wazuh plugin to send a JSON request body')
    }

    const body = JSON.parse(request.body) as unknown
    expect(body).toMatchObject({
      size: 2,
      from: 0,
      query: {
        bool: {
          must: [
            {
              query_string: {
                query: 'rule.level:>=10',
              },
            },
            {
              range: {
                '@timestamp': {
                  gte: '2026-06-01T00:00:00.000Z',
                  lte: '2026-06-01T01:00:00.000Z',
                },
              },
            },
          ],
        },
      },
    })

    const secondCall = fetchMock.mock.calls[1]
    if (secondCall === undefined) {
      throw new Error('Expected Wazuh plugin to call fetch for query_issues')
    }

    const [, queryRequest] = secondCall
    if (queryRequest === undefined || typeof queryRequest.body !== 'string') {
      throw new Error('Expected Wazuh query_issues to send a JSON request body')
    }

    const queryBody = JSON.parse(queryRequest.body) as unknown
    expect(queryBody).toMatchObject({
      size: 2,
      from: 4,
    })
  })
})
