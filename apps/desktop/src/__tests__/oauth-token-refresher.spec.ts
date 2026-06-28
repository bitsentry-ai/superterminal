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
})
