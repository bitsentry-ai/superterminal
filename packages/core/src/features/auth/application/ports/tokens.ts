import { createDiToken } from '../../../../kernel';
import type {
  TotpUseCases,
  WebAuthnUseCases,
} from './inbound';

export const TOTP_USE_CASES = createDiToken<TotpUseCases>('@bitsentry-ce/core/auth/totp-use-cases');

export const WEBAUTHN_USE_CASES = createDiToken<WebAuthnUseCases>(
  '@bitsentry-ce/core/auth/webauthn-use-cases',
);
