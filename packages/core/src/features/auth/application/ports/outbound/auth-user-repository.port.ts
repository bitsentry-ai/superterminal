import type { AuthUser, AuthUserStatus, AuthUserRole } from '../../../contracts/auth.types';

/**
 * TOTP update data
 */
export interface AuthUserTotpUpdate {
  readonly totpSecret?: string | null;
  readonly totpEnabled?: boolean;
  readonly totpBackupCodes?: string | null;
}

/**
 * Passkey update data
 */
export interface AuthUserPasskeyUpdate {
  readonly passkeyEnabled?: boolean;
}

/**
 * Data for creating a new user
 */
export interface CreateAuthUserData {
  readonly email: string;
  readonly password: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly provider: string;
  readonly role: AuthUserRole;
  readonly status: AuthUserStatus;
  readonly socialId?: string;
}

/**
 * Magic link data
 */
export interface MagicLinkData {
  readonly token: string;
  readonly expires: Date;
}

/**
 * Port for auth-specific user repository operations.
 * Provides minimal user operations needed for auth use cases.
 *
 * Required methods must be implemented by all platforms.
 * Optional methods (marked with ?) are only needed for specific features.
 */
export interface AuthUserRepositoryPort {
  // ============================================================================
  // Required Methods
  // ============================================================================

  /**
   * Find a user by ID
   */
  findById(id: number | string): Promise<AuthUser | null>;

  /**
   * Find a user by email
   */
  findByEmail(email: string): Promise<AuthUser | null>;

  /**
   * Update TOTP settings for a user
   */
  updateTotpSettings(userId: number | string, data: AuthUserTotpUpdate): Promise<void>;

  /**
   * Update passkey settings for a user
   */
  updatePasskeySettings(userId: number | string, data: AuthUserPasskeyUpdate): Promise<void>;

  /**
   * Update user's last login time
   */
  updateLastLogin(userId: number | string): Promise<void>;

  // ============================================================================
  // Optional Methods - Registration
  // ============================================================================

  /**
   * Create a new user (for registration flow)
   */
  create?(data: CreateAuthUserData): Promise<number | string>;

  /**
   * Update user's status
   */
  updateStatus?(userId: number | string, status: AuthUserStatus): Promise<void>;

  /**
   * Update user's email
   */
  updateEmail?(userId: number | string, email: string): Promise<void>;

  /**
   * Update user's password
   */
  updatePassword?(userId: number | string, hashedPassword: string): Promise<void>;

  // ============================================================================
  // Optional Methods - Magic Link
  // ============================================================================

  /**
   * Update magic link token and expiry
   */
  updateMagicLink?(userId: number | string, data: MagicLinkData): Promise<void>;

  /**
   * Find user by magic link token
   */
  findByMagicLinkToken?(token: string): Promise<AuthUser | null>;

  /**
   * Get magic link expiry for a user
   */
  getMagicLinkExpiry?(userId: number | string): Promise<Date | null>;

  /**
   * Clear magic link token
   */
  clearMagicLink?(userId: number | string): Promise<void>;

  // ============================================================================
  // Optional Methods - Social Login
  // ============================================================================

  /**
   * Find user by social ID and provider
   */
  findBySocialId?(socialId: string, provider: string): Promise<AuthUser | null>;
}
