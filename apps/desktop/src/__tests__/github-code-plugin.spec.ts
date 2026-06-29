import path from 'path'

import { ErrorSourceProviderFactory } from '@bitsentry-ce/core/features/error-sources'
import { createDesktopNodePluginRuntimeService } from '@bitsentry-ce/core/features/plugins/node'
import { afterEach, describe, expect, it, vi } from 'vitest'

type GitHubIssuePage = {
  issues?: Array<{
    externalIssueId?: string
    projectIdentifier?: string
    status?: string
    title?: string
    type?: string
  }>
  hasMore?: boolean
}

function createGitHubIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    number: 42,
    title: 'API deploy failed',
    body: 'Deploy job failed after checkout.',
    state: 'open',
    html_url: 'https://github.com/bitsentry-ai/monorepo/issues/42',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:05:00Z',
    comments: 3,
    labels: [{ name: 'deploy' }],
    user: { login: 'octocat' },
    ...overrides,
  }
}

describe('GitHub code plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function createRuntime() {
    const pluginDirectory = path.resolve(process.cwd(), '../../packages/plugins')
    return createDesktopNodePluginRuntimeService([pluginDirectory])
  }

  it('loads from the repo-managed plugin directory and executes list_issues', async () => {
    const runtime = createRuntime()
    const descriptor = runtime.getPlugin('github')

    if (descriptor === null) {
      throw new Error('Expected GitHub plugin to load')
    }

    expect(descriptor).toMatchObject({
      id: 'github',
      referenceRepositoryPath: '.repos/references/plugins/stackstorm-github',
      metadata: {
        errorSource: {
          sourceType: 'github',
        },
      },
    })
    const actionIds = descriptor.actions.map((action) => action.id)
    expect(actionIds).toContain('list_issues')
    expect(actionIds).toContain('query_issues')

    const fetchMock = vi.fn<(url: string, request?: RequestInit) => Promise<Response>>()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([createGitHubIssue()]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runtime.executeAction({
      pluginId: 'github',
      actionId: 'list_issues',
      auth: {
        accessToken: 'gh-token',
        apiBase: 'https://github.example.com/api/v3',
      },
      input: {
        owner: 'bitsentry-ai',
        repo: 'monorepo',
        labels: ['deploy'],
        limit: 2,
        since: '2026-06-01T00:00:00Z',
      },
    })

    expect(result).toMatchObject({
      pluginId: 'github',
      actionId: 'list_issues',
      ok: true,
      status: 200,
      summary: 'Fetched 1 GitHub issues.',
      data: {
        issues: [
          {
            externalIssueId: 'bitsentry-ai/monorepo#42',
            projectIdentifier: 'bitsentry-ai/monorepo',
            status: 'open',
            title: 'API deploy failed',
            type: 'issue',
          },
        ],
        hasMore: false,
      },
    } satisfies Partial<typeof result>)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('Expected GitHub plugin to call fetch')
    }

    const [url, request] = firstCall
    const parsedUrl = new URL(url)
    expect(parsedUrl.origin).toBe('https://github.example.com')
    expect(parsedUrl.pathname).toBe('/api/v3/repos/bitsentry-ai/monorepo/issues')
    expect(parsedUrl.searchParams.get('labels')).toBe('deploy')
    expect(parsedUrl.searchParams.get('per_page')).toBe('3')
    expect(parsedUrl.searchParams.get('state')).toBe('open')
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer gh-token',
      Accept: 'application/vnd.github+json',
    })
  })

  it('keeps GitHub error-source setup and auth mapping inside plugin code', async () => {
    const runtime = createRuntime()

    await expect(
      runtime.resolveErrorSourceSetup({
        pluginId: 'github',
        setupValues: {
          accessToken: 'gh-token',
          owner: 'bitsentry-ai',
          repos: ['monorepo', 'runbooks'],
          apiBase: 'https://github.example.com/api/v3',
        },
      }),
    ).resolves.toEqual({
      accessTokenRef: 'gh-token',
      configuration: {
        orgSlug: 'bitsentry-ai',
        projectIds: ['monorepo', 'runbooks'],
        baseUrl: 'https://github.example.com/api/v3',
      },
    })

    await expect(
      runtime.buildErrorSourceAuth({
        pluginId: 'github',
        source: {
          sourceType: 'github',
          accessTokenRef: 'stored-gh-token',
          configuration: {
            orgSlug: 'bitsentry-ai',
            projectIds: ['monorepo'],
            baseUrl: 'https://github.example.com/api/v3',
          },
        },
      }),
    ).resolves.toMatchObject({
      accessToken: 'stored-gh-token',
      authToken: 'stored-gh-token',
      orgSlug: 'bitsentry-ai',
      repos: ['monorepo'],
      baseUrl: 'https://github.example.com/api/v3',
    })
  })

  it('registers GitHub as a plugin-backed source provider', async () => {
    const runtime = createRuntime()
    const fetchMock = vi.fn<(url: string, request?: RequestInit) => Promise<Response>>()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([createGitHubIssue({ number: 7 })]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ErrorSourceProviderFactory(runtime).getProvider('github')
    const page = await provider.listIssues({
      accessToken: 'gh-token',
      orgSlug: 'bitsentry-ai',
      projectIds: ['monorepo'],
      limit: 5,
    })

    expect(page).toMatchObject({
      hasMore: false,
      issues: [
        {
          externalIssueId: 'bitsentry-ai/monorepo#7',
          projectIdentifier: 'bitsentry-ai/monorepo',
          title: 'API deploy failed',
        },
      ],
    } satisfies GitHubIssuePage)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCall = fetchMock.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('Expected GitHub provider action to call fetch')
    }
    const [url] = firstCall
    expect(new URL(url).pathname).toBe('/repos/bitsentry-ai/monorepo/issues')
  })

  it('falls back to user repositories when the owner is not an organization', async () => {
    const runtime = createRuntime()
    const fetchMock = vi.fn<(url: string, request?: RequestInit) => Promise<Response>>()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              name: 'personal-runbooks',
              full_name: 'octocat/personal-runbooks',
              owner: { login: 'octocat' },
            },
          ]),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new ErrorSourceProviderFactory(runtime).getProvider('github')

    await expect(
      provider.listProjects({ accessToken: 'gh-token', orgSlug: 'octocat' }),
    ).resolves.toEqual([
      {
        id: 'octocat/personal-runbooks',
        slug: 'personal-runbooks',
        name: 'octocat/personal-runbooks',
        organizationId: 'octocat',
      },
    ])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[0]?.[0] ?? '').pathname).toBe(
      '/orgs/octocat/repos',
    )
    expect(new URL(fetchMock.mock.calls[1]?.[0] ?? '').pathname).toBe(
      '/users/octocat/repos',
    )
  })
})
