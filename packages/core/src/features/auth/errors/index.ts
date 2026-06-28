import { CoreError } from '../../../kernel';
import { AUTH_ERROR_CODES } from '../auth.constants';

function messageWithDetail(message: string, detail?: string): string {
  if (detail === undefined || detail.length === 0) return message;
  return `${message}: ${detail}`;
}

/**
 * Base class for all auth-related errors
 */
export abstract class AuthError extends CoreError {
  constructor(
    code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(code, message);
  }
}

// ============================================================================
// General Auth Errors
// ============================================================================

export class UserNotFoundError extends AuthError {
  constructor(identifier?: string) {
    super(
      AUTH_ERROR_CODES.USER_NOT_FOUND,
      messageWithDetail('User not found', identifier),
      'email',
    );
  }
}

export class WrongProviderError extends AuthError {
  constructor(public readonly expectedProvider: string) {
    super(
      AUTH_ERROR_CODES.WRONG_PROVIDER,
      `Please login via ${expectedProvider} provider`,
      'email',
    );
  }
}

export class NoPasswordSetError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.NO_PASSWORD_SET, 'No password set for this account', 'password');
  }
}

export class InvalidPasswordError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.INVALID_PASSWORD, 'Invalid password', 'password');
  }
}

export class AccountInactiveError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.ACCOUNT_INACTIVE, 'Account is inactive', 'email');
  }
}

export class EmailNotConfirmedError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED, 'Email not confirmed', 'email');
  }
}

export class InvalidTempTokenError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.INVALID_TEMP_TOKEN, 'Invalid or expired temporary token');
  }
}

export class TokenExpiredError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.TOKEN_EXPIRED, 'Token has expired');
  }
}

// ============================================================================
// TOTP Errors
// ============================================================================

export class TotpNotEnabledError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.TOTP_NOT_ENABLED, 'TOTP is not enabled for this user', 'token');
  }
}

export class InvalidTotpTokenError extends AuthError {
  constructor() {
    super(AUTH_ERROR_CODES.INVALID_TOTP, 'Invalid TOTP code', 'token');
  }
}

export class TotpAlreadyEnabledError extends AuthError {
  constructor() {
    super('TOTP_ALREADY_ENABLED', 'TOTP is already enabled for this user');
  }
}

export class InvalidBackupCodeError extends AuthError {
  constructor() {
    super('INVALID_BACKUP_CODE', 'Invalid backup code', 'token');
  }
}

// ============================================================================
// WebAuthn/Passkey Errors
// ============================================================================

export class PasskeyNotFoundError extends AuthError {
  constructor(credentialId?: string) {
    super(
      'PASSKEY_NOT_FOUND',
      messageWithDetail('Passkey not found', credentialId),
    );
  }
}

export class PasskeyRegistrationFailedError extends AuthError {
  constructor(reason?: string) {
    super(
      'PASSKEY_REGISTRATION_FAILED',
      messageWithDetail('Passkey registration failed', reason),
    );
  }
}

export class PasskeyAuthenticationFailedError extends AuthError {
  constructor(reason?: string) {
    super(
      'PASSKEY_AUTHENTICATION_FAILED',
      messageWithDetail('Passkey authentication failed', reason),
    );
  }
}

export class ChallengeExpiredError extends AuthError {
  constructor() {
    super('CHALLENGE_EXPIRED', 'Challenge has expired or is invalid');
  }
}

export class ChallengeNotFoundError extends AuthError {
  constructor() {
    super('CHALLENGE_NOT_FOUND', 'Challenge not found');
  }
}

// ============================================================================
// 2FA Errors
// ============================================================================

export class Invalid2FAMethodError extends AuthError {
  constructor(method: string) {
    super(AUTH_ERROR_CODES.INVALID_2FA_METHOD, `Invalid 2FA method: ${method}`);
  }
}

export class TwoFARequiredError extends AuthError {
  constructor(public readonly availableMethods: string[]) {
    super('2FA_REQUIRED', 'Two-factor authentication required');
  }
}

// ============================================================================
// Session/Token Errors
// ============================================================================

export class SessionNotFoundError extends AuthError {
  constructor() {
    super('SESSION_NOT_FOUND', 'Session not found or expired');
  }
}

export class InvalidTokenError extends AuthError {
  constructor(reason?: string) {
    super('INVALID_TOKEN', messageWithDetail('Invalid token', reason));
  }
}

export class InvalidHashError extends AuthError {
  constructor() {
    super('INVALID_HASH', 'Invalid or expired hash', 'hash');
  }
}

// ============================================================================
// Registration Errors
// ============================================================================

export class EmailExistsError extends AuthError {
  constructor() {
    super('EMAIL_EXISTS', 'Email already exists', 'email');
  }
}

// ============================================================================
// Magic Link Errors
// ============================================================================

export class MagicLinkExpiredError extends AuthError {
  constructor() {
    super('MAGIC_LINK_EXPIRED', 'Magic link has expired', 'token');
  }
}

export class MagicLinkInvalidError extends AuthError {
  constructor() {
    super('MAGIC_LINK_INVALID', 'Invalid magic link', 'token');
  }
}
