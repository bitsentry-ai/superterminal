import type { ComponentType } from 'react'
import App from '@bitsentry-desktop/renderer-app'
import { runDesktopRendererMain } from './DesktopRendererMain'
import './desktop-index.css'

type DesktopRendererImportMetaEnv = {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

const desktopImportMeta = import.meta as ImportMeta & {
  readonly env?: DesktopRendererImportMetaEnv
}
const desktopImportMetaEnv = desktopImportMeta.env ?? {}

const RendererApp = App as ComponentType

void runDesktopRendererMain({
  App: RendererApp,
  posthogKey: desktopImportMetaEnv.VITE_POSTHOG_KEY ?? '',
  posthogHost: desktopImportMetaEnv.VITE_POSTHOG_HOST ?? '',
})
