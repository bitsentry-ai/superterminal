import {
  OAUTH_CALLBACK_CHANNEL,
  type OAuthCallbackPayload,
} from '@bitsentry-ce/core/features/error-sources/desktop-oauth-callback'
import { createDesktopEditionOAuthCallbackBindings } from '@bitsentry-ce/core/features/desktop/desktop-oauth-callback-bindings'

const desktopOAuthCallback = createDesktopEditionOAuthCallbackBindings('ce')

export const DESKTOP_PROTOCOL_SCHEME = desktopOAuthCallback.protocolScheme
export { OAUTH_CALLBACK_CHANNEL }
export type { OAuthCallbackPayload }

export const parseOAuthCallbackUrl: typeof desktopOAuthCallback.parseOAuthCallbackUrl = (
  url,
  receivedAt,
) => desktopOAuthCallback.parseOAuthCallbackUrl(url, receivedAt)
export const extractDeepLinkFromArgv: typeof desktopOAuthCallback.extractDeepLinkFromArgv = (
  argv,
) => desktopOAuthCallback.extractDeepLinkFromArgv(argv)
