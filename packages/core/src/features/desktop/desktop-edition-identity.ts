export type DesktopEdition = 'ce' | 'pro'

export interface DesktopEditionIdentity {
  appDataName: string
  oauthProtocolClientId: string
  productName: string
}

const DESKTOP_EDITION_IDENTITY: Record<DesktopEdition, DesktopEditionIdentity> = {
  ce: {
    appDataName: 'SuperTerminal CE',
    oauthProtocolClientId: 'bitsentry-desktop-ce',
    productName: 'SuperTerminal',
  },
  pro: {
    // Keep the historical app-data name so existing Pro installs continue to
    // read the same userData directory and encrypted secret store.
    appDataName: 'SuperTerminal',
    oauthProtocolClientId: 'bitsentry-desktop',
    productName: 'SuperTerminal Pro',
  },
}

export function getDesktopEditionIdentity(
  edition: DesktopEdition,
): DesktopEditionIdentity {
  return DESKTOP_EDITION_IDENTITY[edition]
}
