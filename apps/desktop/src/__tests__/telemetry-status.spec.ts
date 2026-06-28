import { beforeEach, describe, expect, it, vi } from 'vitest'

const importTelemetryModule = async (releaseChannel = 'stable') => {
  vi.resetModules()
  process.env.BITSENTRY_RELEASE_CHANNEL = releaseChannel
  return import('@bitsentry-ce/core/features/analytics')
}

function createDb(
  values: Record<string, string | undefined> = {},
) {
  const stored = new Map(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] != null),
  )

  return {
    setting: {
      findUnique: vi.fn(({ where: { key } }: { where: { key: string } }) => {
        const value = stored.get(key)
        if (value === undefined) {
          return Promise.resolve(null)
        }

        return Promise.resolve({ key, value })
      }),
    },
  }
}

function createFailingDb() {
  return {
    setting: {
      findUnique: vi.fn(() => {
        throw new Error('db unavailable')
      }),
    },
  }
}

describe('desktop telemetry status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.BITSENTRY_RELEASE_CHANNEL
  })

  it('defaults to enabled on preview builds without a saved setting', async () => {
    const telemetry = await importTelemetryModule('preview')

    await expect(
      telemetry.getTelemetryStatus(createDb() as never),
    ).resolves.toEqual({ enabled: true, canDisable: false })
  })

  it('defaults to disabled on stable builds without a saved setting', async () => {
    const telemetry = await importTelemetryModule('stable')

    await expect(
      telemetry.getTelemetryStatus(createDb() as never),
    ).resolves.toEqual({ enabled: false, canDisable: true })
  })

  it('honors the saved telemetry setting', async () => {
    const telemetry = await importTelemetryModule('stable')

    await expect(
      telemetry.getTelemetryStatus(
        createDb({ 'telemetry.enabled': 'true' }) as never,
      ),
    ).resolves.toEqual({ enabled: true, canDisable: true })
  })

  it('keeps preview telemetry enabled even if an old saved setting says false', async () => {
    const telemetry = await importTelemetryModule('preview')

    await expect(
      telemetry.getTelemetryStatus(
        createDb({ 'telemetry.enabled': 'false' }) as never,
      ),
    ).resolves.toEqual({ enabled: true, canDisable: false })
  })

  it('surfaces settings read failures through getTelemetryStatus but fails closed for runtime gates', async () => {
    const telemetry = await importTelemetryModule('stable')
    const db = createFailingDb()

    await expect(
      telemetry.getTelemetryStatus(db as never),
    ).rejects.toThrow('db unavailable')
    await expect(
      telemetry.isTelemetryEnabled(db as never),
    ).resolves.toBe(false)
  })
})
