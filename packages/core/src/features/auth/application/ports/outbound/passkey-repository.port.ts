import type { Passkey } from '../../../contracts/webauthn.types';

/**
 * Data for creating a new passkey
 */
export interface CreatePasskeyData {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly deviceName?: string;
  readonly userId: number | string;
  readonly aaguid?: string;
  readonly transports?: string[];
}

/**
 * Data for updating a passkey
 */
export interface UpdatePasskeyData {
  readonly counter?: number;
  readonly deviceName?: string;
  readonly lastUsedAt?: Date;
  readonly transports?: string[];
}

/**
 * Port for passkey persistence operations.
 * Wraps platform-specific database implementations.
 */
export interface PasskeyRepositoryPort {
  /**
   * Create a new passkey
   */
  create(data: CreatePasskeyData): Promise<Passkey>;

  /**
   * Find a passkey by its database ID
   */
  findById(id: string): Promise<Passkey | null>;

  /**
   * Find a passkey by its credential ID
   */
  findByCredentialId(credentialId: string): Promise<Passkey | null>;

  /**
   * Find all passkeys for a user
   */
  findByUserId(userId: number | string): Promise<Passkey[]>;

  /**
   * Find a passkey by credential ID and user ID
   */
  findByCredentialIdAndUserId(
    credentialId: string,
    userId: number | string,
  ): Promise<Passkey | null>;

  /**
   * Update a passkey
   */
  update(id: string, data: UpdatePasskeyData): Promise<Passkey>;

  /**
   * Soft delete a passkey
   */
  softDelete(id: string): Promise<void>;

  /**
   * Permanently delete a passkey
   */
  permanentDelete(id: string): Promise<void>;

  /**
   * Update passkey usage (counter and lastUsedAt)
   */
  updateLastUsed(id: string, counter: number): Promise<void>;

  /**
   * Count active passkeys for a user
   */
  countByUserId(userId: number | string): Promise<number>;
}
