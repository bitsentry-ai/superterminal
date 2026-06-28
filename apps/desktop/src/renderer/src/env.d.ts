/// <reference types="vite/client" />

import type {
  DesktopBitsentryBridge,
  DesktopUpdaterStateBase,
} from '@bitsentry-ce/components/services'

type UpdaterDisabledReasonCode =
  | 'not-packaged'
  | 'smoke-test'
  | 'unsupported-feed'

type UpdaterState = DesktopUpdaterStateBase & {
  disabledReasonCode: UpdaterDisabledReasonCode | null
}

type BitsentryAPI = DesktopBitsentryBridge<UpdaterState>

declare global {
  interface ImportMetaEnv {
    readonly VITE_POSTHOG_KEY: string
    readonly VITE_POSTHOG_HOST: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }

  interface Window {
    bitsentry: BitsentryAPI
  }
}

export {}
