/**
 * Auth provider types for user authentication
 */
export enum AuthProvider {
  Email = 'email',
  Facebook = 'facebook',
  Google = 'google',
  Apple = 'apple',
}

/**
 * Two-factor authentication method types
 */
export type TwoFAMethod = 'totp' | 'email_otp' | 'passkey';

/**
 * JWT token types
 */
export type JwtTokenType = 'regular' | 'refresh' | '2fa_temp';

/**
 * User status for auth operations
 */
export interface AuthUserStatus {
  readonly id: number | string;
  readonly name?: string;
}

/**
 * User role for auth operations
 */
export interface AuthUserRole {
  readonly id: number | string;
  readonly name?: string;
}

/**
 * Minimal user representation for auth operations
 */
export interface AuthUser {
  readonly id: number | string;
  readonly email: string | null;
  readonly password: string | null;
  readonly provider: string;
  readonly status: AuthUserStatus | null;
  readonly role: AuthUserRole | null;
  // TOTP fields
  readonly totpEnabled: boolean;
  readonly totpSecret: string | null;
  readonly totpBackupCodes: string | null;
  // Passkey fields
  readonly passkeyEnabled: boolean;
}

/**
 * Login input for email/password authentication
 */
export interface ValidateLoginInput {
  readonly email: string;
  readonly password: string;
}

/**
 * Result of successful login
 */
export interface LoginResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenExpires: number;
  readonly user: AuthUserPublic;
}

/**
 * Public user representation (safe to expose to client)
 */
export interface AuthUserPublic {
  readonly id: number | string;
  readonly email: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly role?: AuthUserRole | null;
  readonly status?: AuthUserStatus | null;
  readonly totpEnabled?: boolean;
  readonly passkeyEnabled?: boolean;
}

/**
 * Two-factor authentication required response
 */
export interface TwoFARequiredResult {
  readonly requires2FA: true;
  readonly tempToken: string;
  readonly availableMethods: TwoFAMethod[];
  readonly preferredMethod: TwoFAMethod | null;
}

/**
 * Session data for token generation
 */
export interface AuthSession {
  readonly id: number | string;
  readonly hash: string;
  readonly userId: number | string;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  readonly id: number | string;
  readonly sessionId: number | string;
  readonly hash?: string;
  readonly iat?: number;
  readonly exp?: number;
}

/**
 * Refresh token payload
 */
export interface JwtRefreshPayload {
  readonly sessionId: number | string;
  readonly hash: string;
  readonly iat?: number;
  readonly exp?: number;
}
