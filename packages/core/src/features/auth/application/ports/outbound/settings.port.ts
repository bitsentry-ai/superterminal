/**
 * Port for accessing security settings.
 */
export interface AuthSettingsPort {
  /**
   * Get security policy settings
   */
  getSecurityPolicy(): Promise<SecurityPolicyData>;
}

export interface SecurityPolicyData {
  rememberMeExpiryHours?: number;
  passwordMinLength?: number;
  require2FA?: boolean;
}
