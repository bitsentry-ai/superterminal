import {
  createDesktopOAuthCallbackBindings,
  type DesktopOAuthCallbackBindings,
} from '../error-sources/desktop-oauth-callback'
import {
  getDesktopEditionIdentity,
  type DesktopEdition,
} from './desktop-edition-identity'

export function createDesktopEditionOAuthCallbackBindings(
  edition: DesktopEdition,
): DesktopOAuthCallbackBindings {
  return createDesktopOAuthCallbackBindings(
    getDesktopEditionIdentity(edition).oauthProtocolClientId,
  )
}
