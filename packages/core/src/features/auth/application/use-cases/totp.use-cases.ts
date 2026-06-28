import type { TotpUseCases } from "../ports/inbound";
import type { TotpPort } from "../ports/outbound/totp.port";
import type { QrCodePort } from "../ports/outbound/qr-code.port";
import type { PasswordHasherPort } from "../ports/outbound/password-hasher.port";
import type { CryptoPort } from "../ports/outbound/crypto.port";
import type { AuthUserRepositoryPort } from "../ports/outbound/auth-user-repository.port";
import type { TotpSetupResult, TotpStatus } from "../../contracts/totp.types";
import { TOTP_CONFIG } from "../../auth.constants";
import {
  InvalidTotpTokenError,
  TotpNotEnabledError,
  TotpAlreadyEnabledError,
  NoPasswordSetError,
  InvalidPasswordError,
  UserNotFoundError,
} from "../../errors";
import { stringArrayValue } from "../../../../shared/values";

export class TotpUseCasesImpl implements TotpUseCases {
  constructor(
    private readonly totpPort: TotpPort,
    private readonly qrCodePort: QrCodePort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly crypto: CryptoPort,
    private readonly userRepository: AuthUserRepositoryPort,
  ) {}

  async generateSecret(input: {
    userId: number | string;
    password: string;
    appName: string;
    issuer: string;
  }): Promise<TotpSetupResult> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(String(input.userId));
    }

    // Verify user password before enabling TOTP
    await this.verifyUserPassword(user.password, input.password);

    // Generate a new secret
    const secret = this.totpPort.generateSecret({
      name: `${input.appName} (${this.totpAccountName(user.email)})`,
      issuer: input.issuer,
      length: TOTP_CONFIG.SECRET_LENGTH,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Generate QR code
    const qrCode = await this.qrCodePort.toDataURL(secret.otpauthUrl);

    return {
      secret: secret.base32,
      qrCode,
      manualEntryKey: secret.base32,
      backupCodes,
      instructions: {
        android:
          "Install Google Authenticator, scan QR code, or enter manual key",
        ios: "Install Google Authenticator, scan QR code, or enter manual key",
        web: "Use Authy extension or scan QR code with your phone",
      },
    };
  }

  async enableTotp(input: {
    userId: number | string;
    secret: string;
    token: string;
  }): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(String(input.userId));
    }

    if (user.totpEnabled) {
      throw new TotpAlreadyEnabledError();
    }

    // Verify the TOTP token
    const verified = this.verifyTokenWithSecret(input.token, input.secret);
    if (!verified) {
      throw new InvalidTotpTokenError();
    }

    // Generate encrypted backup codes
    const backupCodes = this.generateBackupCodes();
    const encryptedBackupCodes = await this.encryptBackupCodes(backupCodes);

    // Update user with TOTP settings
    await this.userRepository.updateTotpSettings(input.userId, {
      totpSecret: input.secret,
      totpEnabled: true,
      totpBackupCodes: encryptedBackupCodes,
    });
  }

  async disableTotp(input: {
    userId: number | string;
    password: string;
    token: string;
  }): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(String(input.userId));
    }

    // Verify password
    await this.verifyUserPassword(user.password, input.password);
    await this.verifyDisableToken(input.token, input.userId, user);

    // Disable TOTP
    await this.userRepository.updateTotpSettings(input.userId, {
      totpSecret: null,
      totpEnabled: false,
      totpBackupCodes: null,
    });
  }

  async verifyToken(input: {
    userId: number | string;
    token: string;
  }): Promise<boolean> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(String(input.userId));
    }

    if (!user.totpEnabled || user.totpSecret === null) {
      throw new TotpNotEnabledError();
    }

    // Check backup codes first
    if (this.isBackupCode(input.token)) {
      return this.verifyBackupCode(
        user.totpBackupCodes,
        input.token,
        input.userId,
      );
    }

    // Verify TOTP token
    const verified = this.verifyTokenWithSecret(input.token, user.totpSecret);
    if (!verified) {
      throw new InvalidTotpTokenError();
    }

    return true;
  }

  verifyTokenWithSecret(token: string, secret: string): boolean {
    return this.totpPort.verify({
      secret,
      token,
      window: TOTP_CONFIG.TOKEN_WINDOW,
    });
  }

  async getStatus(userId: number | string): Promise<TotpStatus> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError(String(userId));
    }

    const remainingCodes = this.getRemainingBackupCodes(user.totpBackupCodes);

    return {
      enabled: user.totpEnabled,
      hasBackupCodes: remainingCodes > 0,
      remainingBackupCodes: remainingCodes,
    };
  }

  async regenerateBackupCodes(userId: number | string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError(String(userId));
    }

    if (!user.totpEnabled) {
      throw new TotpNotEnabledError();
    }

    const backupCodes = this.generateBackupCodes();
    const encryptedBackupCodes = await this.encryptBackupCodes(backupCodes);

    await this.userRepository.updateTotpSettings(userId, {
      totpBackupCodes: encryptedBackupCodes,
    });

    return backupCodes;
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private generateBackupCodes(): string[] {
    return Array.from({ length: TOTP_CONFIG.BACKUP_CODES_COUNT }, () =>
      this.crypto
        .randomInt(10000000, 99999999)
        .toString()
        .padStart(TOTP_CONFIG.BACKUP_CODE_LENGTH, "0"),
    );
  }

  private async encryptBackupCodes(codes: string[]): Promise<string> {
    const hashedCodes = await Promise.all(
      codes.map((code) => this.passwordHasher.hash(code)),
    );
    return JSON.stringify(hashedCodes);
  }

  private isBackupCode(token: string): boolean {
    return token.length === TOTP_CONFIG.BACKUP_CODE_LENGTH;
  }

  private totpAccountName(email: string | null): string {
    if (email !== null && email.length > 0) return email;
    return "unknown";
  }

  private async verifyDisableToken(
    token: string,
    userId: number | string,
    user: { totpEnabled: boolean; totpSecret: string | null; totpBackupCodes: string | null },
  ): Promise<void> {
    if (!user.totpEnabled || user.totpSecret === null) return;

    if (this.isBackupCode(token)) {
      const backupValid = await this.verifyBackupCode(
        user.totpBackupCodes,
        token,
        userId,
      );
      if (!backupValid) {
        throw new InvalidTotpTokenError();
      }
      return;
    }

    const verified = this.verifyTokenWithSecret(token, user.totpSecret);
    if (!verified) {
      throw new InvalidTotpTokenError();
    }
  }

  private async verifyBackupCode(
    encryptedBackupCodes: string | null,
    token: string,
    userId: number | string,
  ): Promise<boolean> {
    const hashedCodes = this.backupCodesFromEncrypted(encryptedBackupCodes);
    if (hashedCodes === null) return false;

    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await this.passwordHasher.compare(token, hashedCodes[i]);
      if (isMatch) {
        await this.removeUsedBackupCode(hashedCodes, i, userId);
        return true;
      }
    }

    return false;
  }

  private backupCodesFromEncrypted(encryptedBackupCodes: string | null): string[] | null {
    if (encryptedBackupCodes === null || encryptedBackupCodes.length === 0) {
      return null;
    }

    try {
      const rawHashedCodes: unknown = JSON.parse(encryptedBackupCodes);
      const hashedCodes = stringArrayValue(rawHashedCodes);
      if (hashedCodes !== undefined) return hashedCodes;
      return null;
    } catch {
      return null;
    }
  }

  private async removeUsedBackupCode(
    hashedCodes: string[],
    usedIndex: number,
    userId: number | string,
  ): Promise<void> {
    const remainingCodes = hashedCodes.filter((_, index) => index !== usedIndex);
    let totpBackupCodes: string | null = null;
    if (remainingCodes.length > 0) {
      totpBackupCodes = JSON.stringify(remainingCodes);
    }
    await this.userRepository.updateTotpSettings(userId, {
      totpBackupCodes,
    });
  }

  private getRemainingBackupCodes(encryptedBackupCodes: string | null): number {
    if (encryptedBackupCodes === null || encryptedBackupCodes.length === 0) return 0;

    try {
      const rawHashedCodes: unknown = JSON.parse(encryptedBackupCodes);
      const hashedCodes = stringArrayValue(rawHashedCodes);
      if (hashedCodes === undefined) return 0;
      return hashedCodes.length;
    } catch {
      return 0;
    }
  }

  private async verifyUserPassword(
    storedPassword: string | null,
    inputPassword: string,
  ): Promise<void> {
    if (storedPassword === null || storedPassword.length === 0) {
      throw new NoPasswordSetError();
    }

    const isValidPassword = await this.passwordHasher.compare(
      inputPassword,
      storedPassword,
    );

    if (!isValidPassword) {
      throw new InvalidPasswordError();
    }
  }
}
