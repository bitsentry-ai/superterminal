import {
  type DesktopIpcInvoke,
  createDesktopLocalBitsentryServices,
  getDesktopConnectionStatus,
} from '../services/desktop-local-services'
import { ipcInvoke } from './DesktopIpcRuntime'

export { getDesktopConnectionStatus }

export const localBitsentryServices = createDesktopLocalBitsentryServices({
  ipcInvoke: ipcInvoke as DesktopIpcInvoke,
})
