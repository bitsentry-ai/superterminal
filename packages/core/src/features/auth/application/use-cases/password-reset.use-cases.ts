import type { PasswordResetUseCases } from '../ports/inbound';
import type {
  AuthUserRepositoryPort,
  AuthEmailPort,
  AuthSessionPort,
  JwtPort,
  JwtConfig,
  PasswordHasherPort,
} from '../ports/outbound';
import { UserNotFoundError, InvalidHashError } from '../../errors';

/**
 * Password reset use cases implementation.
 * Handles forgot password and reset password flows.
 */
export class PasswordResetUseCasesImpl implements PasswordResetUseCases {
  constructor(
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly emailPort: AuthEmailPort,
    private readonly sessionPort: AuthSessionPort,
    private readonly jwtPort: JwtPort,
    private readonly jwtConfig: JwtConfig,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    if (user === null) {
      throw new UserNotFoundError();
    }

    const tokenExpires = Date.now() + this.parseExpiry(this.jwtConfig.forgotExpires);

    const hash = await this.jwtPort.sign(
      { forgotUserId: user.id },
      {
        secret: this.jwtConfig.forgotSecret,
        expiresIn: this.jwtConfig.forgotExpires,
      },
    );

    await this.emailPort.sendForgotPassword({
      to: email,
      hash,
      tokenExpires,
    });
  }

  async resetPassword(hash: string, newPassword: string): Promise<void> {
    let userId: number | string;

    try {
      const payload = await this.jwtPort.verify<{ forgotUserId: number | string }>(
        hash,
        { secret: this.jwtConfig.forgotSecret },
      );
      userId = payload.forgotUserId;
    } catch {
      throw new InvalidHashError();
    }

    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    // Hash new password
    const hashedPassword = await this.passwordHasher.hash(newPassword);

    // Delete all sessions for user
    await this.sessionPort.deleteByUserId(user.id);

    // Update password
    await this.userRepository.updatePassword?.(userId, hashedPassword);
  }

  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (match === null) return 3600000; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }
}
