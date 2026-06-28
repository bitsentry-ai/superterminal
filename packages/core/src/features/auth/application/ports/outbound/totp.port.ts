import type { TotpSecret, TotpSecretOptions, TotpVerifyOptions } from '../../../contracts/totp.types';

/**
 * Port for TOTP (Time-based One-Time Password) operations.
 * Wraps library-specific TOTP implementations (e.g., speakeasy).
 */
export interface TotpPort {
  /**
   * Generate a new TOTP secret for user setup
   */
  generateSecret(options: TotpSecretOptions): TotpSecret;

  /**
   * Verify a TOTP token against a secret
   * @returns true if token is valid
   */
  verify(options: TotpVerifyOptions): boolean;
}
