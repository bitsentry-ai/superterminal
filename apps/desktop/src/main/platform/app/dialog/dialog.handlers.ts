import { app, dialog } from 'electron'
import {
  createDesktopDialogHandlers,
  type DesktopDialogWindow,
} from '@bitsentry-ce/core/features/runbooks/desktop-dialog.handlers'
import {
  approveRunbookExportPath,
  approveRunbookImportPaths,
} from '@bitsentry-ce/core/features/runbooks/desktop-trusted-runbook-paths'

export function createDialogHandlers(getWindow: () => DesktopDialogWindow) {
  return createDesktopDialogHandlers({
    app,
    dialog,
    getWindow,
    approveRunbookExportPath,
    approveRunbookImportPaths,
  })
}
