import type {
  TokenUseCases,
  RefreshTokenInput,
  GenerateTokensInput,
  TokenResult,
} from '../ports/inbound';
import type { JwtPort, JwtConfig, AuthSessionPort, AuthUserRepositoryPort } from '../ports/outbound';
import { JWT_TOKEN_TYPES, TWO_FA_TOKEN_EXPIRY } from '../../auth.constants';
import { UserNotFoundError, InvalidTokenError, SessionNotFoundError } from '../../errors';

/**
 * Token use cases implementation.
 * Handles token generation, refresh, and temporary tokens for 2FA.
 */
export class TokenUseCasesImpl implements TokenUseCases {
  constructor(
    private readonly jwtPort: JwtPort,
    private readonly sessionPort: AuthSessionPort,
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly jwtConfig: JwtConfig,
  ) {}

  async refreshToken(input: RefreshTokenInput): Promise<TokenResult> {
    const session = await this.sessionPort.findById(input.sessionId);

    if (session === null) {
      throw new SessionNotFoundError();
    }

    if (session.hash !== input.hash) {
      throw new InvalidTokenError('Invalid session hash');
    }

    const user = await this.userRepository.findById(session.userId);

    if (user === null || user.role === null) {
      throw new UserNotFoundError();
    }

    // Generate new hash for session
    const newHash = this.generateHash();

    await this.sessionPort.update(session.id, { hash: newHash });

    return this.generateTokens({
      userId: session.userId,
      role: user.role,
      sessionId: session.id,
      hash: newHash,
    });
  }

  async createTemporaryToken(userId: number | string): Promise<string> {
    const payload = {
      id: userId,
      userId: userId,
      type: JWT_TOKEN_TYPES.TEMP_2FA,
      sessionId: Date.now(),
      expiresAt: Date.now() + TWO_FA_TOKEN_EXPIRY.TEMP_TOKEN_MINUTES * 60 * 1000,
    };

    return this.jwtPort.sign(payload, {
      secret: this.jwtConfig.secret,
      expiresIn: `${String(TWO_FA_TOKEN_EXPIRY.TEMP_TOKEN_MINUTES)}m`,
    });
  }

  async validateTemporaryToken(token: string): Promise<{ userId: number | string } | null> {
    try {
      const payload = await this.jwtPort.verify<{
        userId: number | string;
        type: string;
        expiresAt?: number;
      }>(token, { secret: this.jwtConfig.secret });

      if (payload.type !== JWT_TOKEN_TYPES.TEMP_2FA) {
        return null;
      }

      if (payload.expiresAt !== undefined && Date.now() > payload.expiresAt) {
        return null;
      }

      return { userId: payload.userId };
    } catch {
      return null;
    }
  }

  async generateTokens(input: GenerateTokensInput): Promise<TokenResult> {
    const tokenExpires = Date.now() + this.parseExpiry(this.jwtConfig.expires);

    const [token, refreshToken] = await Promise.all([
      this.jwtPort.sign(
        {
          id: input.userId,
          role: input.role,
          sessionId: input.sessionId,
        },
        {
          secret: this.jwtConfig.secret,
          expiresIn: this.jwtConfig.expires,
        },
      ),
      this.jwtPort.sign(
        {
          sessionId: input.sessionId,
          hash: input.hash,
        },
        {
          secret: this.jwtConfig.refreshSecret,
          expiresIn: this.jwtConfig.refreshExpires,
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  private generateHash(): string {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (match === null) return 900000; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 900000;
    }
  }
}
