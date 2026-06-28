import type { DesktopRunbookExportArtifactV1 } from './desktop-runbook.types'

const INVALID_RUNBOOK_IMPORT_FILE_MESSAGE =
  'Invalid runbook import file. Expected YAML or JSON.'

export interface RunbookArtifactFileRuntime {
  parseYaml(raw: string): unknown
  stringifyYaml(
    artifact: DesktopRunbookExportArtifactV1,
    options: { lineWidth: number },
  ): string
}

export function createDesktopRunbookArtifactFile(
  runtime: RunbookArtifactFileRuntime,
) {
  return {
    serializeRunbookArtifactFile(
      artifact: DesktopRunbookExportArtifactV1,
    ): string {
      return runtime.stringifyYaml(artifact, {
        lineWidth: 0,
      })
    },
    parseRunbookArtifactFile(raw: string): unknown {
      if (raw.trim().length === 0) {
        throw new Error(INVALID_RUNBOOK_IMPORT_FILE_MESSAGE)
      }

      try {
        return runtime.parseYaml(raw)
      } catch {
        throw new Error(INVALID_RUNBOOK_IMPORT_FILE_MESSAGE)
      }
    },
  }
}
