/**
 * Port for email operations required by authentication flows.
 * Platform-specific implementations handle actual email delivery.
 */
export interface AuthEmailPort {
  /**
   * Send signup confirmation email
   */
  sendSignupConfirmation(params: {
    to: string;
    hash: string;
  }): Promise<void>;

  /**
   * Send magic link email
   */
  sendMagicLink(params: {
    to: string;
    token: string;
    expiresInSeconds: number;
    userFirstName?: string;
  }): Promise<void>;

  /**
   * Send forgot password email
   */
  sendForgotPassword(params: {
    to: string;
    hash: string;
    tokenExpires: number;
  }): Promise<void>;

  /**
   * Send email change confirmation
   */
  sendEmailChangeConfirmation(params: {
    to: string;
    hash: string;
  }): Promise<void>;
}
