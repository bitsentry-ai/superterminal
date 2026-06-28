import { z } from 'zod'
import type { AuthSettingsPort, SecurityPolicyData } from './application/ports/outbound/settings.port'

const settingRowSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export interface DesktopSettingsDb {
  setting: {
    findMany(args: {
      where: {
        key: {
          in: string[]
        }
      }
    }): Promise<Array<{ key: string; value: string }>>
  }
}

export class DesktopSettingsAdapter implements AuthSettingsPort {
  constructor(private readonly db: DesktopSettingsDb) {}

  async getSecurityPolicy(): Promise<SecurityPolicyData> {
    const settings = await this.db.setting.findMany({
      where: {
        key: {
          in: [
            'security.rememberMeExpiryHours',
            'security.passwordMinLength',
            'security.require2FA',
          ],
        },
      },
    })

    const settingsMap = new Map(
      settings.map((setting) => {
        const row = settingRowSchema.parse(setting)
        return [row.key, row.value]
      }),
    )

    return {
      rememberMeExpiryHours: parseOptionalInt(settingsMap.get('security.rememberMeExpiryHours')),
      passwordMinLength: parseOptionalInt(settingsMap.get('security.passwordMinLength')),
      require2FA: settingsMap.get('security.require2FA') === 'true',
    }
  }
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) return undefined
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}
