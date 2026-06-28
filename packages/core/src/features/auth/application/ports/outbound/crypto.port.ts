/**
 * Port for cryptographic operations.
 * Wraps platform-specific crypto implementations.
 */
export interface CryptoPort {
  /**
   * Generate a random UUID
   */
  randomUUID(): string;

  /**
   * Generate a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number;

  /**
   * Generate a cryptographically secure random string
   * @param length Length in bytes
   * @returns Hex-encoded random string
   */
  randomBytes(length: number): string;
}
