import {
  exportRunbooksInputSchema,
  logFilterConfigSchema,
  runbookImportOptionsSchema,
  telemetryActionConfigSchema,
} from '@bitsentry-ce/core'
import {
  createDesktopEditionIpcPayloadValidator,
} from './desktop-ipc-payload-schemas'
import type { DesktopRpcChannel } from './desktop-ipc-contract'

type DesktopIpcPayloadValidatorOptions = {
  edition: 'ce' | 'pro'
  importFromFileOptionsRequired?: boolean
}

export function createDesktopAppIpcPayloadValidator({
  edition,
  importFromFileOptionsRequired,
}: DesktopIpcPayloadValidatorOptions) {
  const validatePayload = createDesktopEditionIpcPayloadValidator({
    edition,
    exportRunbooksInputSchema,
    runbookImportOptionsSchema,
    logFilterConfigSchema,
    telemetryActionConfigSchema,
    importFromFileOptionsRequired,
  })

  return (channel: DesktopRpcChannel, payload: unknown): unknown => {
    return validatePayload(channel, payload)
  }
}
