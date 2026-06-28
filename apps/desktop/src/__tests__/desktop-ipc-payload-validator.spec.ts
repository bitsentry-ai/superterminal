import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createDesktopIpcPayloadValidator } from '@bitsentry-ce/components/services'

function createValidator() {
  const looseObjectSchema = z.looseObject({})

  return createDesktopIpcPayloadValidator({
    llmProviderKeys: ['claude_code'],
    telemetryActionTypes: ['data_source_query'],
    exportRunbooksInputSchema: z.object({}),
    runbookImportOptionsSchema: looseObjectSchema,
    logFilterConfigSchema: looseObjectSchema,
    telemetryActionConfigSchema: looseObjectSchema,
  })
}

describe('desktop IPC payload validation', () => {
  it('accepts marketplace source types for error source probes', () => {
    const validate = createValidator()

    expect(
      validate('errorSources:probeConnection', {
        pluginId: 'github',
        sourceType: 'github',
        authToken: 'github-token',
      }),
    ).toMatchObject({
      pluginId: 'github',
      sourceType: 'github',
      authToken: 'github-token',
    })
  })
})
