import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import path from 'path'

import { createDesktopNodePluginRuntimeService } from '@bitsentry-ce/core/features/plugins/node'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

type TarModule = {
  c(
    options: {
      cwd: string
      file: string
      gzip: boolean
    },
    entries: string[],
  ): Promise<void>
}

describe('desktop code plugin archive installation', () => {
  const tempRoots: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })),
    )
    tempRoots.length = 0
  })

  it('installs a tarred plugin.js archive and reloads it for execution', async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'bitsentry-plugin-test-'))
    tempRoots.push(tempRoot)

    const sourceRoot = path.join(tempRoot, 'source')
    const pluginRoot = path.join(sourceRoot, 'marketplace-test')
    const installRoot = path.join(tempRoot, 'installed')
    const archivePath = path.join(tempRoot, 'marketplace-test.tar.gz')

    await mkdir(pluginRoot, { recursive: true })
    await writeFile(
      path.join(pluginRoot, 'plugin.js'),
      `
exports.plugin = {
  id: 'marketplace-test',
  name: 'Marketplace Test',
  version: '1.0.0',
  description: 'A marketplace-installed code plugin.',
  auth: { fields: [] },
  actions: [
    {
      id: 'ping',
      title: 'Ping',
      description: 'Proves the installed code plugin can execute.',
      riskLevel: 'read',
      fields: [],
      execute() {
        return {
          ok: true,
          status: 200,
          summary: 'pong from installed plugin',
          data: { source: 'archive' },
        }
      },
    },
  ],
  triggers: [],
}
`,
    )

    const tar = (await import(require.resolve('tar'))) as TarModule
    await tar.c(
      {
        cwd: sourceRoot,
        file: archivePath,
        gzip: true,
      },
      ['marketplace-test'],
    )

    const service = createDesktopNodePluginRuntimeService([installRoot])
    const archiveBase64 = (await readFile(archivePath)).toString('base64')
    const installResult = await service.installFromArchive({ archiveBase64 })

    expect(installResult.pluginId).toBe('marketplace-test')
    expect(installResult.descriptor.name).toBe('Marketplace Test')
    expect(service.getPlugin('marketplace-test')?.version).toBe('1.0.0')

    await expect(
      service.executeAction({
        pluginId: 'marketplace-test',
        actionId: 'ping',
        auth: {},
        input: {},
      }),
    ).resolves.toMatchObject({
      ok: true,
      status: 200,
      summary: 'pong from installed plugin',
      data: { source: 'archive' },
    })
  })
})
