const RELEASE_CHANNEL = process.env.BITSENTRY_RELEASE_CHANNEL ?? 'stable'
export const PRIMARY_TELEMETRY_SETTINGS_KEY = 'telemetry.enabled'

export interface TelemetryStatus {
  enabled: boolean
  canDisable: boolean
}

export interface DesktopTelemetrySettingsDb {
  setting: {
    findUnique(args: {
      where: { key: string }
    }): Promise<Record<string, unknown> | null>
    upsert(args: {
      where: { key: string }
      create: Record<string, unknown>
      update: Record<string, unknown>
    }): Promise<unknown>
  }
}

function isPreReleaseChannel(): boolean {
  return RELEASE_CHANNEL === 'beta' || RELEASE_CHANNEL === 'preview'
}

async function readPrimaryTelemetrySetting(
  db: DesktopTelemetrySettingsDb,
): Promise<boolean | null> {
  const setting = await db.setting.findUnique({
    where: { key: PRIMARY_TELEMETRY_SETTINGS_KEY },
  })
  if (setting === null) {
    return null
  }
  return setting.value === 'true'
}

export async function getTelemetryStatus(
  db: DesktopTelemetrySettingsDb,
): Promise<TelemetryStatus> {
  if (isPreReleaseChannel()) {
    return { enabled: true, canDisable: false }
  }

  const primarySetting = await readPrimaryTelemetrySetting(db)
  return { enabled: primarySetting ?? false, canDisable: true }
}

export async function isTelemetryEnabled(
  db: DesktopTelemetrySettingsDb,
): Promise<boolean> {
  try {
    const status = await getTelemetryStatus(db)
    return status.enabled
  } catch {
    return false
  }
}

export async function setTelemetryEnabled(
  db: DesktopTelemetrySettingsDb,
  enabled: boolean,
): Promise<void> {
  if (isPreReleaseChannel() && !enabled) {
    return
  }

  const value = String(enabled)
  await db.setting.upsert({
    where: { key: PRIMARY_TELEMETRY_SETTINGS_KEY },
    create: { key: PRIMARY_TELEMETRY_SETTINGS_KEY, value, type: 'boolean' },
    update: { value, type: 'boolean' },
  })
}
