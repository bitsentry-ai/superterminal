import type { CurrentUser as ApiCurrentUser } from "./api.types";

// Shared authentication types across frontend components

export type User = ApiCurrentUser;

export interface PasswordLoginResult {
  token?: string;
  refreshToken?: string;
  user: User;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  totpEnabled?: boolean;
  emailOtpEnabled?: boolean;
}

export interface TwoFactorAuthResult {
  token: string;
  refreshToken?: string;
  rememberMeExpiryHours?: number;
  user: User;
  totpVerified?: boolean;
  emailOtpVerified?: boolean;
}

export interface TotpSetupData {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
  backupCodes: string[];
}

// Common component props interfaces
export interface TotpSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface TwoFactorAuthProps {
  email: string;
  tempToken?: string;
  passwordLoginResult?: PasswordLoginResult;
  onSuccess?: (result: TwoFactorAuthResult) => void;
  onError?: (error: string) => void;
  onBack?: () => void;
}

// Form validation types
export interface TotpFormData {
  password: string;
  totpCode?: string;
}

export interface TotpFormErrors {
  password?: string;
  totpCode?: string;
  general?: string;
}
