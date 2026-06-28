import type { TotpSetupResult, TotpStatus } from "../../contracts/totp.types";
import type {
  PasskeyListItem,
  RegistrationOptionsResult,
  AuthenticationOptionsResult,
  WebAuthnRegistrationResponse,
  WebAuthnAuthenticationResponse,
} from "../../contracts/webauthn.types";
import type {
  AuthUserRole,
  LoginResult,
  TwoFARequiredResult,
} from "../../contracts/auth.types";

// ============================================================================
// TOTP Use Cases Interface
// ============================================================================

export interface TotpUseCases {
  /**
   * Generate TOTP secret and QR code for setup
   */
  generateSecret(input: {
    userId: number | string;
    password: string;
    appName: string;
    issuer: string;
  }): Promise<TotpSetupResult>;

  /**
   * Enable TOTP for user after verification
   */
  enableTotp(input: {
    userId: number | string;
    secret: string;
    token: string;
  }): Promise<void>;

  /**
   * Disable TOTP for user
   */
  disableTotp(input: {
    userId: number | string;
    password: string;
    token: string;
  }): Promise<void>;

  /**
   * Verify TOTP token
   */
  verifyToken(input: {
    userId: number | string;
    token: string;
  }): Promise<boolean>;

  /**
   * Verify TOTP token with provided secret (for setup/enable flow)
   */
  verifyTokenWithSecret(token: string, secret: string): boolean;

  /**
   * Get TOTP status for user
   */
  getStatus(userId: number | string): Promise<TotpStatus>;

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes(userId: number | string): Promise<string[]>;
}

// ============================================================================
// WebAuthn/Passkey Use Cases Interface
// ============================================================================

export interface WebAuthnUseCases {
  /**
   * Generate registration options for passkey creation
   */
  generateRegistrationOptions(input: {
    userId: number | string;
    deviceName?: string;
    rpName: string;
    rpId: string;
    origin: string;
  }): Promise<RegistrationOptionsResult>;

  /**
   * Verify passkey registration response
   */
  verifyRegistration(input: {
    challengeId: string;
    response: WebAuthnRegistrationResponse;
    deviceName?: string;
    rpId: string;
    origin: string;
  }): Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Generate authentication options for passkey login
   */
  generateAuthenticationOptions(input: {
    email?: string;
    rpId: string;
    origin: string;
  }): Promise<
    | AuthenticationOptionsResult
    | { authenticationOptions: null; message: string }
  >;

  /**
   * Verify passkey authentication response
   */
  verifyAuthentication(input: {
    challengeId: string;
    response: WebAuthnAuthenticationResponse;
    rpId: string;
    origin: string;
  }): Promise<{
    success: boolean;
    userId: number | string;
    passkeyId: string;
    deviceName?: string;
  }>;

  /**
   * Get all passkeys for a user
   */
  getUserPasskeys(userId: number | string): Promise<PasskeyListItem[]>;

  /**
   * Delete a passkey
   */
  deletePasskey(userId: number | string, passkeyId: string): Promise<void>;

  /**
   * Rename a passkey
   */
  renamePasskey(
    userId: number | string,
    passkeyId: string,
    newName: string,
  ): Promise<void>;
}

// ============================================================================
// Login Use Cases Interface
// ============================================================================

export interface LoginUseCases {
  /**
   * Validate email/password login
   */
  validateLogin(input: LoginInput): Promise<LoginResult>;

  /**
   * Validate login and check if 2FA is required
   */
  validateLoginFor2FA(
    input: LoginInput,
  ): Promise<LoginResult | TwoFARequiredResult>;

  /**
   * Complete login after 2FA verification
   */
  complete2FALogin(input: Complete2FAInput): Promise<LoginResult>;

  /**
   * Complete login (create session and tokens)
   */
  completeLogin(userId: number | string): Promise<LoginResult>;

  /**
   * Validate social login
   */
  validateSocialLogin(input: SocialLoginInput): Promise<LoginResult>;

  /**
   * Logout (delete session)
   */
  logout(sessionId: number): Promise<void>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Complete2FAInput {
  tempToken: string;
  method: "totp" | "email_otp";
  code: string;
}

export interface SocialLoginInput {
  provider: string;
  socialId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

// ============================================================================
// Register Use Cases Interface
// ============================================================================

export interface RegisterUseCases {
  /**
   * Register a new user
   */
  register(input: RegisterInput): Promise<void>;

  /**
   * Confirm email address
   */
  confirmEmail(hash: string): Promise<void>;

  /**
   * Confirm new email (after email change)
   */
  confirmNewEmail(hash: string): Promise<void>;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// ============================================================================
// Token Use Cases Interface
// ============================================================================

export interface TokenUseCases {
  /**
   * Refresh access token
   */
  refreshToken(input: RefreshTokenInput): Promise<TokenResult>;

  /**
   * Create temporary token for 2FA flow
   */
  createTemporaryToken(userId: number | string): Promise<string>;

  /**
   * Validate temporary token
   */
  validateTemporaryToken(
    token: string,
  ): Promise<{ userId: number | string } | null>;

  /**
   * Generate access and refresh tokens
   */
  generateTokens(input: GenerateTokensInput): Promise<TokenResult>;
}

export interface RefreshTokenInput {
  sessionId: number;
  hash: string;
}

export interface GenerateTokensInput {
  userId: number | string;
  role?: AuthUserRole | null;
  sessionId: number;
  hash: string;
}

export interface TokenResult {
  token: string;
  refreshToken: string;
  tokenExpires: number;
}

// ============================================================================
// Password Reset Use Cases Interface
// ============================================================================

export interface PasswordResetUseCases {
  /**
   * Request password reset (send email)
   */
  forgotPassword(email: string): Promise<void>;

  /**
   * Reset password with hash
   */
  resetPassword(hash: string, newPassword: string): Promise<void>;
}

// ============================================================================
// Magic Link Use Cases Interface
// ============================================================================

export interface MagicLinkUseCases {
  /**
   * Send magic link email
   */
  sendMagicLink(email: string): Promise<MagicLinkResult>;

  /**
   * Verify magic link and login
   */
  verifyMagicLink(token: string): Promise<LoginResult>;
}

export interface MagicLinkResult {
  success: boolean;
  message: string;
  expiresInSeconds: number;
}
