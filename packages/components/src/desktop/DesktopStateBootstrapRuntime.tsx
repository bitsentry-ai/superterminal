import type { ReactNode } from 'react'
import {
  DesktopStateBootstrap as SharedDesktopStateBootstrap,
  type DesktopStateBootstrapProps,
} from './DesktopStateBootstrap'
import { ipcInvoke } from './DesktopIpcRuntime'
import { captureDesktopAnalyticsEvent } from './DesktopPosthogRenderer'

type DesktopRunbookBridge = {
  runbooks: {
    onExecutionEvent: DesktopStateBootstrapProps['subscribeToRunbookExecutionEvents']
  }
}

type DesktopRunbookWindow = Window & {
  bitsentry?: DesktopRunbookBridge
}

const sharedIpcInvoke: DesktopStateBootstrapProps['ipcInvoke'] = (
  channel,
  ...args
) => ipcInvoke(channel as Parameters<typeof ipcInvoke>[0], ...args)

function subscribeToRunbookExecutionEvents(
  callback: Parameters<
    DesktopStateBootstrapProps['subscribeToRunbookExecutionEvents']
  >[0],
) {
  const desktopWindow: DesktopRunbookWindow = window
  if (desktopWindow.bitsentry === undefined) {
    throw new Error('Desktop runbook bridge is unavailable.')
  }

  return desktopWindow.bitsentry.runbooks.onExecutionEvent(callback)
}

export function DesktopStateBootstrap({ children }: { children: ReactNode }) {
  return (
    <SharedDesktopStateBootstrap
      ipcInvoke={sharedIpcInvoke}
      captureDesktopAnalyticsEvent={captureDesktopAnalyticsEvent}
      subscribeToRunbookExecutionEvents={subscribeToRunbookExecutionEvents}
    >
      {children}
    </SharedDesktopStateBootstrap>
  )
}
