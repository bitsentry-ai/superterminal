import type { ComponentType } from 'react'
import { DesktopStateBootstrap } from './DesktopStateBootstrapRuntime'
import {
  configureDesktopPosthogRendererRuntime,
  initDesktopAnalytics,
} from './DesktopPosthogRenderer'
import { renderDesktopRendererEntry } from './DesktopRendererEntry'
import { initSentryRenderer } from './DesktopSentryRenderer'
import { localBitsentryServices } from './DesktopLocalServicesRuntime'

type RunDesktopRendererMainOptions = {
  App: ComponentType
  posthogKey: string
  posthogHost: string
}

export async function runDesktopRendererMain({
  App,
  posthogKey,
  posthogHost,
}: RunDesktopRendererMainOptions): Promise<void> {
  configureDesktopPosthogRendererRuntime({
    posthogKey,
    posthogHost,
  })

  await renderDesktopRendererEntry({
    App,
    DesktopStateBootstrap,
    services: localBitsentryServices,
    initDesktopAnalytics: () => {
      void initDesktopAnalytics()
    },
    initSentryRenderer,
  })
}
