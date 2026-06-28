/**
 * Port for JWT token operations.
 * Platform-specific implementations handle actual token signing/verification.
 */
export interface JwtPort {
  /**
   * Sign a payload to create a JWT token
   */
  sign(payload: Record<string, unknown>, options: JwtSignOptions): Promise<string>;

  /**
   * Verify and decode a JWT token
   */
  verify<T = Record<string, unknown>>(token: string, options: JwtVerifyOptions): Promise<T>;
}

export interface JwtSignOptions {
  secret: string;
  expiresIn: string;
}

export interface JwtVerifyOptions {
  secret: string;
}

/**
 * JWT configuration required by auth use cases
 */
export interface JwtConfig {
  secret: string;
  refreshSecret: string;
  expires: string;
  refreshExpires: string;
  confirmEmailSecret: string;
  confirmEmailExpires: string;
  forgotSecret: string;
  forgotExpires: string;
}
