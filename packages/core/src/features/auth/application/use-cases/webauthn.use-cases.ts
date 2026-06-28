import type { WebAuthnUseCases } from '../ports/inbound';
import type { WebAuthnPort } from '../ports/outbound/webauthn.port';
import type { AuthCachePort } from '../ports/outbound/auth-cache.port';
import type { CryptoPort } from '../ports/outbound/crypto.port';
import type { PasskeyRepositoryPort } from '../ports/outbound/passkey-repository.port';
import type { AuthUserRepositoryPort } from '../ports/outbound/auth-user-repository.port';
import type {
  RegistrationOptionsResult,
  AuthenticationOptionsResult,
  WebAuthnRegistrationResponse,
  WebAuthnAuthenticationResponse,
  PasskeyListItem,
  WebAuthnChallengeData,
} from '../../contracts/webauthn.types';
import { WEBAUTHN_CONFIG } from '../../auth.constants';
import {
  ChallengeNotFoundError,
  ChallengeExpiredError,
  PasskeyRegistrationFailedError,
  PasskeyAuthenticationFailedError,
  PasskeyNotFoundError,
  UserNotFoundError,
} from '../../errors';

function challengeUserId(challengeData: WebAuthnChallengeData): number | string {
  if (challengeData.userId !== null) return challengeData.userId;
  throw new ChallengeNotFoundError();
}

function defaultPasskeyDeviceName(): string {
  return `Passkey - ${new Date().toLocaleDateString()}`;
}

export class WebAuthnUseCasesImpl implements WebAuthnUseCases {
  constructor(
    private readonly webAuthnPort: WebAuthnPort,
    private readonly cache: AuthCachePort,
    private readonly crypto: CryptoPort,
    private readonly passkeyRepository: PasskeyRepositoryPort,
    private readonly userRepository: AuthUserRepositoryPort,
  ) {}

  async generateRegistrationOptions(input: {
    userId: number | string;
    deviceName?: string;
    rpName: string;
    rpId: string;
    origin: string;
  }): Promise<RegistrationOptionsResult> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(String(input.userId));
    }

    const existingPasskeys = await this.passkeyRepository.findByUserId(input.userId);

    const registrationOptions = await this.webAuthnPort.generateRegistrationOptions({
      rpName: input.rpName,
      rpId: input.rpId,
      userId: new TextEncoder().encode(String(input.userId)).toString(),
      userName: user.email ?? `user-${String(input.userId)}`,
      userDisplayName: user.email ?? `User ${String(input.userId)}`,
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.credentialId,
        type: 'public-key' as const,
        transports: passkey.transports,
      })),
      timeout: WEBAUTHN_CONFIG.TIMEOUT_MS,
      attestationType: WEBAUTHN_CONFIG.ATTESTATION_TYPE,
      authenticatorSelection: {
        residentKey: WEBAUTHN_CONFIG.RESIDENT_KEY,
        userVerification: WEBAUTHN_CONFIG.USER_VERIFICATION,
      },
    });

    // Store challenge in cache
    const challengeId = this.crypto.randomUUID();
    const cacheKey = `webauthn:reg:${challengeId}`;

    const cacheData: WebAuthnChallengeData = {
      challenge: registrationOptions.challenge,
      userId: input.userId,
      deviceName: input.deviceName,
      timestamp: Date.now(),
    };

    await this.cache.set(cacheKey, cacheData, WEBAUTHN_CONFIG.CHALLENGE_TTL_MS);

    return {
      registrationOptions,
      challengeId,
      expiresIn: WEBAUTHN_CONFIG.CHALLENGE_TTL_MS,
    };
  }

  async verifyRegistration(input: {
    challengeId: string;
    response: WebAuthnRegistrationResponse;
    deviceName?: string;
    rpId: string;
    origin: string;
  }): Promise<{ success: boolean; message: string }> {
    const cacheKey = `webauthn:reg:${input.challengeId}`;
    const cachedData = await this.cache.get<WebAuthnChallengeData>(cacheKey);

    if (cachedData === null) {
      throw new ChallengeNotFoundError();
    }

    // Verify challenge is not too old
    if (Date.now() - cachedData.timestamp > WEBAUTHN_CONFIG.CHALLENGE_TTL_MS) {
      throw new ChallengeExpiredError();
    }

    const verification = await this.webAuthnPort.verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: cachedData.challenge,
      expectedOrigin: input.origin,
      expectedRpId: input.rpId,
    });

    const credential = verification.credential;
    if (!verification.verified || credential === undefined) {
      throw new PasskeyRegistrationFailedError('Verification failed');
    }
    const userId = challengeUserId(cachedData);

    // Store passkey in database
    await this.passkeyRepository.create({
      credentialId: credential.id,
      publicKey: this.uint8ArrayToBase64(
        new Uint8Array(credential.publicKey),
      ),
      counter: credential.counter,
      deviceName:
        input.deviceName ?? cachedData.deviceName ?? defaultPasskeyDeviceName(),
      userId,
      aaguid: verification.aaguid,
      transports: credential.transports ?? [],
    });

    // Update user passkey enabled status
    await this.userRepository.updatePasskeySettings(userId, {
      passkeyEnabled: true,
    });

    // Clean up challenge
    await this.cache.del(cacheKey);

    return {
      success: true,
      message: 'Passkey registered successfully',
    };
  }

  async generateAuthenticationOptions(input: {
    email?: string;
    rpId: string;
    origin: string;
  }): Promise<AuthenticationOptionsResult | { authenticationOptions: null; message: string }> {
    let userId: number | string | null = null;
    let allowedPasskeys: { id: string; type: 'public-key'; transports?: string[] }[] = [];

    if (input.email !== undefined && input.email !== '') {
      // Email-based: Find user and their passkeys
      const user = await this.userRepository.findByEmail(input.email);
      if (user === null) {
        // Don't reveal user existence for security
        return {
          authenticationOptions: null,
          message: 'If this email is registered, you will receive authentication options',
        };
      }

      const passkeys = await this.passkeyRepository.findByUserId(user.id);
      if (passkeys.length === 0) {
        return {
          authenticationOptions: null,
          message: 'No passkeys registered for this account',
        };
      }

      userId = user.id;
      allowedPasskeys = passkeys.map((passkey) => ({
        id: passkey.credentialId,
        type: 'public-key' as const,
        transports: passkey.transports,
      }));
    }

    // Generate authentication options
    const authenticationOptions = await this.webAuthnPort.generateAuthenticationOptions({
      rpId: input.rpId,
      allowCredentials: this.allowedCredentialsOrUndefined(allowedPasskeys),
      userVerification: WEBAUTHN_CONFIG.USER_VERIFICATION,
      timeout: WEBAUTHN_CONFIG.TIMEOUT_MS,
    });

    // Store challenge in cache
    const challengeId = this.crypto.randomUUID();
    const cacheKey = `webauthn:auth:${challengeId}`;

    const cacheData: WebAuthnChallengeData = {
      challenge: authenticationOptions.challenge,
      userId,
      timestamp: Date.now(),
    };

    await this.cache.set(cacheKey, cacheData, WEBAUTHN_CONFIG.CHALLENGE_TTL_MS);

    return {
      authenticationOptions,
      challengeId,
      expiresIn: WEBAUTHN_CONFIG.CHALLENGE_TTL_MS,
    };
  }

  async verifyAuthentication(input: {
    challengeId: string;
    response: WebAuthnAuthenticationResponse;
    rpId: string;
    origin: string;
  }): Promise<{
    success: boolean;
    userId: number | string;
    passkeyId: string;
    deviceName?: string;
  }> {
    const cacheKey = `webauthn:auth:${input.challengeId}`;
    const cachedData = await this.cache.get<WebAuthnChallengeData>(cacheKey);

    if (cachedData === null) {
      throw new ChallengeNotFoundError();
    }

    // Verify challenge is not too old
    if (Date.now() - cachedData.timestamp > WEBAUTHN_CONFIG.CHALLENGE_TTL_MS) {
      throw new ChallengeExpiredError();
    }

    // Find passkey by credential ID
    const passkey = await this.findAuthenticationPasskey(
      input.response.id,
      cachedData.userId,
    );

    if (passkey === null) {
      throw new PasskeyNotFoundError(input.response.id);
    }

    // Verify authentication
    const verification = await this.webAuthnPort.verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: cachedData.challenge,
      expectedOrigin: input.origin,
      expectedRpId: input.rpId,
      requireUserVerification: false,
      credential: {
        id: passkey.credentialId,
        publicKey: this.base64ToUint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });

    if (!verification.verified) {
      throw new PasskeyAuthenticationFailedError();
    }

    // Update passkey usage
    await this.passkeyRepository.updateLastUsed(
      passkey.id,
      verification.newCounter ?? passkey.counter + 1,
    );

    // Update user last login
    await this.userRepository.updateLastLogin(passkey.userId);

    // Clean up challenge
    await this.cache.del(cacheKey);

    return {
      success: true,
      userId: passkey.userId,
      passkeyId: passkey.id,
      deviceName: passkey.deviceName ?? undefined,
    };
  }

  async getUserPasskeys(userId: number | string): Promise<PasskeyListItem[]> {
    const passkeys = await this.passkeyRepository.findByUserId(userId);

    return passkeys.map((passkey) => ({
      id: passkey.id,
      deviceName: passkey.deviceName,
      createdAt: passkey.createdAt,
      lastUsedAt: passkey.lastUsedAt,
      isActive: passkey.deletedAt === null,
    }));
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  async deletePasskey(userId: number | string, passkeyId: string): Promise<void> {
    const passkey = await this.passkeyRepository.findById(passkeyId);

    if (passkey === null || passkey.userId !== userId) {
      throw new PasskeyNotFoundError(passkeyId);
    }

    await this.passkeyRepository.softDelete(passkeyId);

    // Check if user has any remaining passkeys
    const remainingCount = await this.passkeyRepository.countByUserId(userId);
    if (remainingCount === 0) {
      await this.userRepository.updatePasskeySettings(userId, {
        passkeyEnabled: false,
      });
    }
  }

  async renamePasskey(userId: number | string, passkeyId: string, newName: string): Promise<void> {
    const passkey = await this.passkeyRepository.findById(passkeyId);

    if (passkey === null || passkey.userId !== userId) {
      throw new PasskeyNotFoundError(passkeyId);
    }

    await this.passkeyRepository.update(passkeyId, {
      deviceName: newName,
    });
  }

  private allowedCredentialsOrUndefined(
    allowedPasskeys: { id: string; type: 'public-key'; transports?: string[] }[],
  ): { id: string; type: 'public-key'; transports?: string[] }[] | undefined {
    if (allowedPasskeys.length > 0) return allowedPasskeys;
    return undefined;
  }

  private async findAuthenticationPasskey(
    credentialId: string,
    userId: number | string | null,
  ) {
    if (userId !== null) {
      return this.passkeyRepository.findByCredentialIdAndUserId(
        credentialId,
        userId,
      );
    }

    return this.passkeyRepository.findByCredentialId(credentialId);
  }
}
