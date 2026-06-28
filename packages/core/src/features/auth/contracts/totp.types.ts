/**
 * TOTP secret generation options
 */
export interface TotpSecretOptions {
  readonly name: string;
  readonly issuer: string;
  readonly length?: number;
}

/**
 * Generated TOTP secret
 */
export interface TotpSecret {
  readonly base32: string;
  readonly otpauthUrl: string;
}

/**
 * TOTP verification options
 */
export interface TotpVerifyOptions {
  readonly secret: string;
  readonly token: string;
  readonly window?: number;
}

/**
 * TOTP setup response
 */
export interface TotpSetupResult {
  readonly secret: string;
  readonly qrCode: string;
  readonly manualEntryKey: string;
  readonly backupCodes: string[];
  readonly instructions: TotpSetupInstructions;
}

/**
 * TOTP setup instructions for different platforms
 */
export interface TotpSetupInstructions {
  readonly android: string;
  readonly ios: string;
  readonly web: string;
}

/**
 * TOTP status for a user
 */
export interface TotpStatus {
  readonly enabled: boolean;
  readonly hasBackupCodes: boolean;
  readonly remainingBackupCodes: number;
}

/**
 * Input for enabling TOTP
 */
export interface EnableTotpInput {
  readonly userId: number | string;
  readonly secret: string;
  readonly token: string;
  readonly backupCodes?: string[];
}

/**
 * Input for disabling TOTP
 */
export interface DisableTotpInput {
  readonly userId: number | string;
  readonly password: string;
  readonly token: string;
}

/**
 * Input for verifying TOTP
 */
export interface VerifyTotpInput {
  readonly userId: number | string;
  readonly token: string;
}

/**
 * Input for generating TOTP secret
 */
export interface GenerateTotpSecretInput {
  readonly userId: number | string;
  readonly password: string;
  readonly appName: string;
  readonly issuer: string;
}

/**
 * Encrypted backup codes storage format
 */
export interface EncryptedBackupCodes {
  readonly codes: string[];
  readonly hashedCodes: string[];
}
