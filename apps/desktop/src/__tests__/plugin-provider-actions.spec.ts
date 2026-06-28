import { describe, expect, it, vi } from 'vitest'

import { ErrorSourceProviderFactory } from '@bitsentry-ce/core/features/error-sources'
import { resolveErrorSourceProviderActionId } from '@bitsentry-ce/core/features/error-sources/desktop-plugin-error-source-actions'
import {
  DesktopPluginRuntimeService,
  type DesktopPluginDescriptor,
  type DesktopPluginExecutionRequest,
  type DesktopPluginExecutionResult,
} from '@bitsentry-ce/core/features/plugins'

class TestPluginRuntimeService extends DesktopPluginRuntimeService {
  constructor(private readonly descriptors: DesktopPluginDescriptor[]) {
    super()
  }

  override listPlugins(): DesktopPluginDescriptor[] {
    return this.descriptors
  }

  override getPlugin(pluginId: string): DesktopPluginDescriptor | null {
    return this.descriptors.find((plugin) => plugin.id === pluginId) ?? null
  }
}

class TestExecutablePluginRuntimeService extends TestPluginRuntimeService {
  readonly executeActionMock = vi.fn<
    (input: DesktopPluginExecutionRequest) => Promise<DesktopPluginExecutionResult>
  >()

  override executeAction(
    input: DesktopPluginExecutionRequest,
  ): Promise<DesktopPluginExecutionResult> {
    return this.executeActionMock(input)
  }
}

function createPluginDescriptor(
  overrides: Partial<DesktopPluginDescriptor> = {},
): DesktopPluginDescriptor {
  return {
    id: 'posthog',
    name: 'PostHog',
    version: '1.0.0',
    description: 'Code plugin descriptor for PostHog.',
    metadata: {
      errorSource: {
        sourceType: 'posthog',
        setupFields: [],
      },
    },
    auth: {
      fields: [],
    },
    actions: [],
    triggers: [],
    ...overrides,
  }
}

function createProviderAction(
  id: string,
): DesktopPluginDescriptor['actions'][number] {
  return {
    id,
    title: id,
    description: `${id} action.`,
    riskLevel: 'read',
    fields: [],
  }
}

describe('plugin-backed error source provider actions', () => {
  it('resolves conventional code action IDs without provider metadata', () => {
    const runtime = new TestPluginRuntimeService([
      createPluginDescriptor({
        actions: [createProviderAction('queryIssues')],
      }),
    ])

    expect(
      resolveErrorSourceProviderActionId({
        runtime,
        pluginId: 'posthog',
        sourceType: 'posthog',
        action: 'queryIssues',
      }),
    ).toBe('queryIssues')
  })

  it('resolves explicit provider action IDs from code plugin metadata', () => {
    const runtime = new TestPluginRuntimeService([
      createPluginDescriptor({
        metadata: {
          errorSource: {
            sourceType: 'posthog',
            setupFields: [],
            providerActions: {
              queryIssues: 'query_project_errors',
            },
          },
        },
      }),
    ])

    expect(
      resolveErrorSourceProviderActionId({
        runtime,
        pluginId: 'posthog',
        sourceType: 'posthog',
        action: 'queryIssues',
      }),
    ).toBe('query_project_errors')
  })

  it('does not register named providers without explicit code plugin actions', () => {
    const factory = new ErrorSourceProviderFactory(
      new TestPluginRuntimeService([createPluginDescriptor()]),
    )

    expect(() => factory.getProvider('posthog')).toThrow(
      'Unsupported error source type: posthog',
    )
  })

  it('registers named providers from conventional code action IDs', () => {
    const factory = new ErrorSourceProviderFactory(
      new TestPluginRuntimeService([
        createPluginDescriptor({
          actions: [createProviderAction('listOrganizations')],
        }),
      ]),
    )

    expect(factory.getProvider('posthog').sourceType).toBe('posthog')
  })

  it('registers marketplace source providers from code plugin metadata', async () => {
    const runtime = new TestExecutablePluginRuntimeService([
      createPluginDescriptor({
        id: 'github',
        name: 'GitHub',
        metadata: {
          errorSource: {
            sourceType: 'github',
            setupFields: [],
          },
        },
        actions: [
          createProviderAction('listOrganizations'),
          createProviderAction('listProjects'),
        ],
      }),
    ])
    runtime.executeActionMock.mockImplementation((input) => {
      if (input.actionId === 'listOrganizations') {
        return Promise.resolve({
          pluginId: input.pluginId,
          actionId: input.actionId,
          ok: true,
          status: 200,
          summary: 'Fetched GitHub organizations.',
          data: [{ slug: 'bitsentry-ai', name: 'BitSentry AI' }],
        })
      }

      return Promise.resolve({
        pluginId: input.pluginId,
        actionId: input.actionId,
        ok: true,
        status: 200,
        summary: 'Fetched GitHub projects.',
        data: [{ id: 'repo-1', slug: 'monorepo', name: 'monorepo' }],
      })
    })

    const provider = new ErrorSourceProviderFactory(runtime).getProvider('github')

    await expect(provider.listOrganizations('gh-token')).resolves.toEqual([
      { slug: 'bitsentry-ai', name: 'BitSentry AI' },
    ])
    await expect(
      provider.listProjects({ accessToken: 'gh-token', orgSlug: 'bitsentry-ai' }),
    ).resolves.toEqual([
      {
        id: 'repo-1',
        slug: 'monorepo',
        name: 'monorepo',
      },
    ])
    expect(runtime.executeActionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        pluginId: 'github',
        actionId: 'listOrganizations',
        auth: { accessToken: 'gh-token' },
      }),
    )
    expect(runtime.executeActionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pluginId: 'github',
        actionId: 'listProjects',
        auth: { accessToken: 'gh-token' },
        input: { orgSlug: 'bitsentry-ai' },
      }),
    )
  })
})
