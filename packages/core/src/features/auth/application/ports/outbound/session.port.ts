/**
 * Port for session operations required by authentication flows.
 */
export interface AuthSessionPort {
  /**
   * Create a new session
   */
  create(params: {
    userId: number | string;
    hash: string;
  }): Promise<AuthSessionData>;

  /**
   * Find session by ID
   */
  findById(id: number): Promise<AuthSessionData | null>;

  /**
   * Update session hash
   */
  update(id: number, data: { hash: string }): Promise<void>;

  /**
   * Delete session by ID
   */
  deleteById(id: number): Promise<void>;

  /**
   * Delete all sessions for a user
   */
  deleteByUserId(userId: number | string): Promise<void>;

  /**
   * Delete all sessions for a user except one
   */
  deleteByUserIdWithExclude(params: {
    userId: number | string;
    excludeSessionId: number;
  }): Promise<void>;
}

/**
 * Session data returned by the port
 */
export interface AuthSessionData {
  id: number;
  userId: number | string;
  hash: string;
  createdAt: Date;
}
