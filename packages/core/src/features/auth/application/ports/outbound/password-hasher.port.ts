/**
 * Port for password hashing operations.
 * Wraps library-specific hashing implementations (e.g., bcrypt).
 */
export interface PasswordHasherPort {
  /**
   * Hash a plain text password
   * @param password The plain text password
   * @returns The hashed password
   */
  hash(password: string): Promise<string>;

  /**
   * Compare a plain text password against a hash
   * @param password The plain text password
   * @param hash The hashed password to compare against
   * @returns true if password matches
   */
  compare(password: string, hash: string): Promise<boolean>;
}
