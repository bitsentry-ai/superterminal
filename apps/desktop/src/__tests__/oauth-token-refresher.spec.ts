import { describe, expect, it, vi } from 'vitest'

import {
  refreshSourceAccessToken,
  type RefreshAccessTokenInput,
} from '@bitsentry-ce/core/features/error-sources/desktop-oauth-token-refresher'

describe('refreshSourceAccessToken', () => {
  it('uses stored OAuth tokens directly before deciding whether to refresh', async () => {
    const getProvider = vi.fn(() => {
      throw new Error('Provider should not be requested for a fresh stored token')
    })
    const providerFactory = {
      getProvider,
    }

    await expect(
      refreshSourceAccessToken({
        source: {
          id: 'source-1',
          name: 'Production PostHog',
          sourceType: 'posthog' as const,
          accessTokenRef: 'stored-access-token',
          refreshTokenRef: 'stored-refresh-token',
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          grantedScopes: [],
          configuration: {},
          logLevelThreshold: 'error',
          additionalMetadata: null,
          syncEnabled: true,
          autoDiagnosisEnabled: false,
          lastSyncAt: null,
          lastSyncStatus: null,
          lastSyncError: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        sourcesRepository: {
          update: vi.fn(),
        },
        providerFactory,
      } satisfies RefreshAccessTokenInput),
    ).resolves.toBe('stored-access-token')

    expect(getProvider).not.toHaveBeenCalled()
  })

  it('refreshes non-built-in code plugin sources from plugin OAuth metadata', async () => {
    const refreshToken = vi.fn().mockResolvedValue({
      accessToken: 'refreshed-github-access-token',
      refreshToken: 'refreshed-github-refresh-token',
      expiresIn: 3600,
      scope: 'repo read:org',
    })
    const provider = { refreshToken }
    const update = vi.fn().mockResolvedValue({})
    const providerFactory = {
      getProvider: vi.fn(() => provider),
      getProviderForSource: vi.fn(() => provider),
      getPlugin: vi.fn((pluginId: string) => {
        if (pluginId !== 'github') return null

        return {
          metadata: {
            errorSource: {
              sourceType: 'github',
              oauth: {
                envClientIdName: 'GITHUB_OAUTH_CLIENT_ID',
                envClientSecretName: 'GITHUB_OAUTH_CLIENT_SECRET',
                publicClient: false,
              },
            },
          },
        }
      }),
    }

    await expect(
      refreshSourceAccessToken({
        source: {
          id: 'source-2',
          name: 'GitHub',
          sourceType: 'github' as const,
          accessTokenRef: 'stale-access-token',
          refreshTokenRef: 'stored-refresh-token',
          expiresAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          grantedScopes: ['repo'],
          configuration: {
            oauthClientId: 'client-id',
            oauthClientSecret: 'client-secret',
          },
          additionalMetadata: {
            pluginId: 'github',
          },
        },
        sourcesRepository: {
          update,
        },
        providerFactory,
      } satisfies RefreshAccessTokenInput),
    ).resolves.toBe('refreshed-github-access-token')

    expect(providerFactory.getProviderForSource).toHaveBeenCalledWith({
      sourceType: 'github',
      additionalMetadata: {
        pluginId: 'github',
      },
      configuration: {
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      },
    })
    expect(refreshToken).toHaveBeenCalledWith({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'stored-refresh-token',
      signal: undefined,
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'source-2',
        accessTokenRef: 'refreshed-github-access-token',
        refreshTokenRef: 'refreshed-github-refresh-token',
        grantedScopes: ['repo', 'read:org'],
      }),
    )
  })

  it('does not fall back to built-in OAuth refresh config', async () => {
    const provider = {
      refreshToken: vi.fn(),
    }
    const providerFactory = {
      getProvider: vi.fn(() => provider),
      getProviderForSource: vi.fn(() => provider),
      getPlugin: vi.fn(() => ({
        metadata: {
          errorSource: {
            sourceType: 'posthog',
          },
        },
      })),
    }

    await expect(
      refreshSourceAccessToken({
        source: {
          id: 'source-3',
          name: 'Production PostHog',
          sourceType: 'posthog' as const,
          accessTokenRef: 'stale-access-token',
          refreshTokenRef: 'stored-refresh-token',
          expiresAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          grantedScopes: ['project:read'],
          configuration: {
            oauthClientId: 'client-id',
          },
          additionalMetadata: {
            pluginId: 'posthog',
          },
        },
        sourcesRepository: {
          update: vi.fn(),
        },
        providerFactory,
      } satisfies RefreshAccessTokenInput),
    ).rejects.toThrow(
      'OAuth refresh is not configured for source type: posthog',
    )

    expect(providerFactory.getProviderForSource).not.toHaveBeenCalled()
    expect(provider.refreshToken).not.toHaveBeenCalled()
  })
})
