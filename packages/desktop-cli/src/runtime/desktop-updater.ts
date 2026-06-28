import { app, ipcMain, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import {
  startDesktopAutoUpdater,
  type AutoUpdaterDisabledReasonCode,
  type UpdaterState,
  type UpdaterStatus,
  UPDATER_STATE_CHANNEL,
} from '@bitsentry-ce/core/features/updater'

export { UPDATER_STATE_CHANNEL }
export type { UpdaterState, UpdaterStatus }

interface StartOptions {
  getWindow: () => BrowserWindow | null
  shouldEnable: boolean
  disabledReasonCode: AutoUpdaterDisabledReasonCode | null
  feedUrl: string | null
  beforeInstall: () => Promise<void> | void
}

export function startAutoUpdater(options: StartOptions): {
  stop: () => void
  getState: () => UpdaterState
} {
  return startDesktopAutoUpdater({
    ipcMain,
    autoUpdater,
    logger: log,
    currentVersion: app.getVersion(),
    ...options,
  })
}
