import { describe, expect, it } from 'vitest'

import { DesktopSettingsAdapter } from '@bitsentry-ce/core/features/auth'

type DesktopSettingsDatabase = ConstructorParameters<typeof DesktopSettingsAdapter>[0]

function createAdapter(rows: Array<{ key: string; value: string }>): DesktopSettingsAdapter {
  const db = Object.create(null) as DesktopSettingsDatabase
  Object.defineProperty(db, 'setting', {
    value: {
      findMany: () => Promise.resolve(rows),
    },
  })

  return new DesktopSettingsAdapter(db)
}

describe('desktop settings adapter', () => {
  it('hydrates the auth security policy from desktop settings rows', async () => {
    const adapter = createAdapter([
      { key: 'security.rememberMeExpiryHours', value: '72' },
      { key: 'security.passwordMinLength', value: '14' },
      { key: 'security.require2FA', value: 'true' },
    ])

    await expect(adapter.getSecurityPolicy()).resolves.toEqual({
      rememberMeExpiryHours: 72,
      passwordMinLength: 14,
      require2FA: true,
    })
  })

  it('falls back safely for missing or invalid security setting values', async () => {
    const adapter = createAdapter([
      { key: 'security.rememberMeExpiryHours', value: 'invalid' },
      { key: 'security.require2FA', value: 'false' },
    ])

    await expect(adapter.getSecurityPolicy()).resolves.toEqual({
      rememberMeExpiryHours: undefined,
      passwordMinLength: undefined,
      require2FA: false,
    })
  })
})
