export interface SettingRecord {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  type: string;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityPolicy {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordExpirationDays: number;
  sessionTimeoutMinutes: number;
  rememberMeExpiryHours: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  twoFactorRequired: boolean;
  twoFactorGracePeriodDays: number;
  twoFactorEnabledDate?: string;
  twoFactorEnforcementMode: "warn" | "block";
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  type: "vulnerability" | "threat" | "agent" | "scan" | "incident";
  severity: string[];
  channels: string[];
  recipients: string[];
  conditions: unknown;
}

export interface GeneralSettings {
  organizationName: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  defaultDashboard: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  lastUsedExternalSourceId?: string | null;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  emailServer: string;
  emailPort: number;
  emailSecure: boolean;
  emailFrom: string;
  slackEnabled: boolean;
  slackWebhookUrl?: string;
  teamsEnabled: boolean;
  teamsWebhookUrl?: string;
  webhookEnabled: boolean;
  webhookUrl?: string;
  webhookHeaders?: unknown;
}

export interface AllSettings {
  general: GeneralSettings;
  security: SecurityPolicy;
  notifications: NotificationSettings;
  alertRules: AlertRule[];
}

export type UpdateGeneralSettingsInput = Partial<GeneralSettings>;
export type UpdateSecurityPolicyInput = Partial<SecurityPolicy>;
export type UpdateNotificationSettingsInput = Partial<NotificationSettings>;
export type UpdateAlertRuleInput = Partial<Omit<AlertRule, "id">>;

/**
 * Data Policy: AI redaction rules and outbound data handling
 */
export interface DataPolicy {
  payloadClass: "incident_bundle";
  payloadClassDescription: string;
  rawDataOverride: boolean;
  rawDataOverrideDescription: string;
  redactionRules: Array<{
    label: string;
    description: string;
  }>;
  version: string;
  disclaimer: string;
}
