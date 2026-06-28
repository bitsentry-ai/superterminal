import type { BrowserWindow } from 'electron'
import { DesktopMenuBuilder } from '@bitsentry-ce/desktop-cli/runtime/desktop-menu-builder'

export default class MenuBuilder extends DesktopMenuBuilder {
  constructor(mainWindow: BrowserWindow) {
    super(mainWindow, 'ce')
  }
}
