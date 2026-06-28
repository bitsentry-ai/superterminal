import type { RegisterUseCases, RegisterInput } from '../ports/inbound';
import type {
  AuthUserRepositoryPort,
  AuthEmailPort,
  JwtPort,
  JwtConfig,
  PasswordHasherPort,
} from '../ports/outbound';
import { UserNotFoundError, InvalidHashError, EmailExistsError } from '../../errors';

// Status enum values (should match backend)
const StatusEnum = {
  active: 1,
  inactive: 2,
  pending: 3,
} as const;

// Role enum values
const RoleEnum = {
  user: 2,
} as const;

/**
 * Register use cases implementation.
 * Handles user registration and email confirmation.
 */
export class RegisterUseCasesImpl implements RegisterUseCases {
  constructor(
    private readonly userRepository: AuthUserRepositoryPort,
    private readonly emailPort: AuthEmailPort,
    private readonly jwtPort: JwtPort,
    private readonly jwtConfig: JwtConfig,
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async register(input: RegisterInput): Promise<void> {
    // Check if email already exists
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser !== null) {
      throw new EmailExistsError();
    }

    // Hash password
    const hashedPassword = await this.passwordHasher.hash(input.password);

    // Create user with pending status
    const userId = await this.userRepository.create?.({
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      provider: 'email',
      role: { id: RoleEnum.user, name: 'User' },
      status: { id: StatusEnum.active, name: 'Active' },
    });

    if (userId === undefined || userId === "") {
      throw new Error('Failed to create user');
    }

    // Generate confirmation hash
    const hash = await this.jwtPort.sign(
      { confirmEmailUserId: userId },
      {
        secret: this.jwtConfig.confirmEmailSecret,
        expiresIn: this.jwtConfig.confirmEmailExpires,
      },
    );

    // Send confirmation email
    await this.emailPort.sendSignupConfirmation({
      to: input.email,
      hash,
    });
  }

  async confirmEmail(hash: string): Promise<void> {
    let userId: number | string;

    try {
      const payload = await this.jwtPort.verify<{ confirmEmailUserId: number | string }>(
        hash,
        { secret: this.jwtConfig.confirmEmailSecret },
      );
      userId = payload.confirmEmailUserId;
    } catch {
      throw new InvalidHashError();
    }

    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    // If already active, just return
    if (user.status?.id === StatusEnum.active) {
      return;
    }

    // Update status to active
    await this.userRepository.updateStatus?.(userId, {
      id: StatusEnum.active,
      name: 'Active',
    });
  }

  async confirmNewEmail(hash: string): Promise<void> {
    let userId: number | string;
    let newEmail: string;

    try {
      const payload = await this.jwtPort.verify<{
        confirmEmailUserId: number | string;
        newEmail: string;
      }>(hash, { secret: this.jwtConfig.confirmEmailSecret });
      userId = payload.confirmEmailUserId;
      newEmail = payload.newEmail;
    } catch {
      throw new InvalidHashError();
    }

    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    // Update email
    await this.userRepository.updateEmail?.(userId, newEmail);
  }
}
