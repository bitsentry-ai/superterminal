import { describe, expect, it, vi } from 'vitest'
import { DesktopGlobalVariablesService } from '@bitsentry-ce/core/features/runbooks'

describe('DesktopGlobalVariablesService', () => {
  it('masks secure globals in renderer DTOs but still resolves them for execution', async () => {
    const row = {
      id: 'global-1',
      key: 'POSTHOG_API_KEY',
      value: 'stored-posthog-key',
      valueRef: null,
      description: 'PostHog API key',
      secure: true,
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-20T00:00:00.000Z',
    }

    const db = {
      globalVariable: {
        findMany: vi.fn(() => Promise.resolve([row])),
        findUnique: vi.fn(({ where }: { where: { key?: string } }) => {
          if (where.key === 'POSTHOG_API_KEY') {
            return Promise.resolve(row)
          }

          return Promise.resolve(null)
        }),
      },
    }

    const service = new DesktopGlobalVariablesService(db as never)

    await expect(service.list()).resolves.toMatchObject([
      {
        key: 'POSTHOG_API_KEY',
        secure: true,
      },
    ])
    await expect(service.getByKey('POSTHOG_API_KEY')).resolves.toMatchObject({
      key: 'POSTHOG_API_KEY',
      secure: true,
    })
    await expect(service.loadResolvedGlobals()).resolves.toMatchObject({
      values: {
        POSTHOG_API_KEY: 'stored-posthog-key',
      },
      definitions: [
        {
          key: 'POSTHOG_API_KEY',
          secure: true,
          description: 'PostHog API key',
        },
      ],
    })
  })
})
