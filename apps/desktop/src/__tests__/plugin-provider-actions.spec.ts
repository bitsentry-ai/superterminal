import { describe, expect, it } from 'vitest'

import { ErrorSourceProviderFactory } from '@bitsentry-ce/core/features/error-sources'
import { resolveErrorSourceProviderActionId } from '@bitsentry-ce/core/features/error-sources/desktop-plugin-error-source-actions'
import {
  DesktopPluginRuntimeService,
  type DesktopPluginDescriptor,
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

describe('plugin-backed error source provider actions', () => {
  it('requires provider action IDs to come from plugin metadata', () => {
    const runtime = new TestPluginRuntimeService([createPluginDescriptor()])

    expect(() =>
      resolveErrorSourceProviderActionId({
        runtime,
        pluginId: 'posthog',
        sourceType: 'posthog',
        action: 'queryIssues',
      }),
    ).toThrow(
      'Plugin "posthog" does not declare a provider action for "queryIssues".',
    )
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

  it('registers named providers when their code plugin declares provider actions', () => {
    const factory = new ErrorSourceProviderFactory(
      new TestPluginRuntimeService([
        createPluginDescriptor({
          metadata: {
            errorSource: {
              sourceType: 'posthog',
              setupFields: [],
              providerActions: {
                listOrganizations: 'list_organizations',
              },
            },
          },
        }),
      ]),
    )

    expect(factory.getProvider('posthog').sourceType).toBe('posthog')
  })
})
