export type { TotpPort } from './totp.port';
export type { QrCodePort } from './qr-code.port';
export type { PasswordHasherPort } from './password-hasher.port';
export type { AuthCachePort } from './auth-cache.port';
export type {
  WebAuthnPort,
  WebAuthnGenerateRegistrationInput,
  WebAuthnGenerateAuthenticationInput,
  WebAuthnVerifyRegistrationInput,
  WebAuthnVerifyAuthenticationInput,
} from './webauthn.port';
export type {
  PasskeyRepositoryPort,
  CreatePasskeyData,
  UpdatePasskeyData,
} from './passkey-repository.port';
export type {
  AuthUserRepositoryPort,
  AuthUserTotpUpdate,
  AuthUserPasskeyUpdate,
  CreateAuthUserData,
  MagicLinkData,
} from './auth-user-repository.port';
export type { CryptoPort } from './crypto.port';

// New ports for auth orchestration
export type { AuthEmailPort } from './email.port';
export type { AuthSessionPort, AuthSessionData } from './session.port';
export type { JwtPort, JwtSignOptions, JwtVerifyOptions, JwtConfig } from './jwt.port';
export type { AuthSettingsPort, SecurityPolicyData } from './settings.port';
