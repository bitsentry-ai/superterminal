import type { MagicLinkUseCases, MagicLinkResult, TokenUseCases } from '../ports/inbound';
import type {
  AuthUserRepositoryPort,
  AuthEmailPort,
  AuthSessionPort,
  CryptoPort,
} from '../ports/outbound';
import type { AuthUser, LoginResult } from '../../contracts/auth.types';
import {
  MagicLinkExpiredError,
  MagicLinkInvalidError,
  AccountInactiveError,
} from '../../errors';

// Status enum values
const StatusEnum = {
  active: 1,
  inactive: 2,
} as const;

// Magic link expiry in milliseconds (5 minutes)
const MAGIC_LINK_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Magic link use cases implementation.
 * Handles passwordless login via email magic links.
 */
export class MagicLinkUseCasesImpl implements MagicLinkUseCases {
  constructor(
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly emailPort: AuthEmailPort,
    private readonly sessionPort: AuthSessionPort,
    private readonly tokenUseCases: TokenUseCases,
    private readonly crypto: CryptoPort,
  ) {}

  async sendMagicLink(email: string): Promise<MagicLinkResult> {
    const user = await this.userRepository.findByEmail(email);

    // Always return success to prevent email enumeration
    const successResponse: MagicLinkResult = {
      success: true,
      message: 'If your email is registered, you will receive a magic link shortly.',
      expiresInSeconds: MAGIC_LINK_EXPIRY_MS / 1000,
    };

    if (user === null) {
      return successResponse;
    }

    // Check if user is active
    if (user.status?.id !== StatusEnum.active) {
      return successResponse;
    }

    // Generate magic link token
    const token = this.crypto.randomBytes(32);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

    // Store token on user
    await this.userRepository.updateMagicLink?.(user.id, {
      token,
      expires: expiresAt,
    });

    // Send email
    await this.emailPort.sendMagicLink({
      to: email,
      token,
      expiresInSeconds: MAGIC_LINK_EXPIRY_MS / 1000,
      userFirstName: undefined, // User first name not available from AuthUser
    });

    return {
      success: true,
      message: 'Magic link sent to your email. Please check your inbox.',
      expiresInSeconds: MAGIC_LINK_EXPIRY_MS / 1000,
    };
  }

  async verifyMagicLink(token: string): Promise<LoginResult> {
    const user = await this.userForMagicLink(token);

    // Clear magic link token (single-use)
    await this.userRepository.clearMagicLink?.(user.id);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Create session
    const hash = this.crypto.randomBytes(32);
    const session = await this.sessionPort.create({
      userId: user.id,
      hash,
    });

    // Generate tokens
    const tokens = await this.tokenUseCases.generateTokens({
      userId: user.id,
      role: user.role,
      sessionId: session.id,
      hash,
    });

    return {
      accessToken: tokens.token,
      refreshToken: tokens.refreshToken,
      tokenExpires: tokens.tokenExpires,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        totpEnabled: user.totpEnabled,
        passkeyEnabled: user.passkeyEnabled,
      },
    };
  }

  private async userForMagicLink(token: string): Promise<AuthUser> {
    if (token.length === 0) {
      throw new MagicLinkInvalidError();
    }

    const user = await this.userRepository.findByMagicLinkToken?.(token);
    if (user === null || user === undefined) {
      throw new MagicLinkInvalidError();
    }

    await this.assertMagicLinkNotExpired(user);

    if (user.status?.id !== StatusEnum.active) {
      throw new AccountInactiveError();
    }

    return user;
  }

  private async assertMagicLinkNotExpired(user: AuthUser): Promise<void> {
    const magicLinkExpires = await this.userRepository.getMagicLinkExpiry?.(user.id);
    if (
      magicLinkExpires !== null &&
      magicLinkExpires !== undefined &&
      new Date() > magicLinkExpires
    ) {
      throw new MagicLinkExpiredError();
    }
  }
}
