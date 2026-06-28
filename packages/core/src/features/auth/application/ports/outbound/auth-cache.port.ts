/**
 * Port for caching operations in auth context.
 * Wraps platform-specific cache implementations (e.g., cache-manager, Redis).
 */
export interface AuthCachePort {
  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlMs Time to live in milliseconds
   */
  set(key: string, value: unknown, ttlMs: number): Promise<void>;

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  del(key: string): Promise<void>;
}
