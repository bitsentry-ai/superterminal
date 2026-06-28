import { createTRPCUntypedClient } from '@trpc/client'
import { ipcLink } from 'electron-trpc/renderer'
import {
  configureDesktopIpcClientRuntime,
  DesktopIpcClientError as IpcClientError,
  type DesktopIpcClientErrorShape as IpcError,
} from '../services'
import { captureDesktopAnalyticsEvent } from './DesktopPosthogRenderer'

export type { IpcError }
export { IpcClientError }

const trpcClient = createTRPCUntypedClient({
  links: [ipcLink()],
})

export const { ipcInvoke } = configureDesktopIpcClientRuntime({
  captureDesktopAnalyticsEvent,
  invokeMutation: (channel, payload) => trpcClient.mutation(channel, payload),
})
