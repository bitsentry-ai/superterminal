import type { ReactNode } from 'react'
import {
  DesktopAppSettingsScaffold,
  type DesktopAppSettingsScaffoldProps,
} from './DesktopAppSettingsScaffold'
import { captureDesktopAnalyticsEvent } from './DesktopPosthogRenderer'
import { captureRendererException } from './DesktopSentryRenderer'

type DesktopAppSettingsPageProps = Pick<
  DesktopAppSettingsScaffoldProps,
  'primaryAgent' | 'isPrimarySelectionPending' | 'onSetPrimaryAgent'
> & {
  additionalSections?: ReactNode
  additionalDialogs?: ReactNode
  helpSectionTourMarker?: string
  appSettingsExtraSections?: DesktopAppSettingsScaffoldProps['appSettingsExtraSections']
}

export function DesktopAppSettingsPage({
  primaryAgent,
  isPrimarySelectionPending,
  onSetPrimaryAgent,
  additionalSections,
  additionalDialogs,
  helpSectionTourMarker,
  appSettingsExtraSections,
}: DesktopAppSettingsPageProps) {
  return (
    <DesktopAppSettingsScaffold
      primaryAgent={primaryAgent}
      isPrimarySelectionPending={isPrimarySelectionPending}
      onSetPrimaryAgent={onSetPrimaryAgent}
      captureDesktopAnalyticsEvent={captureDesktopAnalyticsEvent}
      captureRendererException={captureRendererException}
      additionalSections={additionalSections}
      additionalDialogs={additionalDialogs}
      helpSectionTourMarker={helpSectionTourMarker}
      appSettingsExtraSections={appSettingsExtraSections}
    />
  )
}
