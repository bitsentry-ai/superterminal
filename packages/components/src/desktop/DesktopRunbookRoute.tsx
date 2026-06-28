import type { ComponentProps } from 'react'
import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import DesktopRunbookPage from './DesktopRunbookPage'
import { ipcInvoke } from './DesktopIpcRuntime'
import { captureDesktopAnalyticsEvent } from './DesktopPosthogRenderer'

const dragDropRuntime = {
  DragDropProvider,
  isSortable: isSortable as ComponentProps<
    typeof DesktopRunbookPage
  >['dragDropRuntime']['isSortable'],
  useSortable: useSortable as ComponentProps<
    typeof DesktopRunbookPage
  >['dragDropRuntime']['useSortable'],
} satisfies ComponentProps<typeof DesktopRunbookPage>['dragDropRuntime']

export default function DesktopRunbookRoute() {
  return (
    <DesktopRunbookPage
      ipcInvoke={ipcInvoke}
      captureDesktopAnalyticsEvent={captureDesktopAnalyticsEvent}
      dragDropRuntime={dragDropRuntime}
    />
  )
}
