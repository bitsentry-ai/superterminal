import type {
  AlertRule,
  AllSettings,
  GeneralSettings,
  NotificationSettings,
  SecurityPolicy,
  UpdateAlertRuleInput,
  UpdateGeneralSettingsInput,
  UpdateNotificationSettingsInput,
  UpdateSecurityPolicyInput,
} from '../../contracts';

export interface SettingsUseCases {
  initializeDefaults(userId?: number): Promise<void>;
  getAllSettings(): Promise<AllSettings>;
  getGeneralSettings(): Promise<GeneralSettings>;
  updateGeneralSettings(
    input: UpdateGeneralSettingsInput,
    userId: number | string,
  ): Promise<GeneralSettings>;
  getSecurityPolicy(): Promise<SecurityPolicy>;
  updateSecurityPolicy(
    input: UpdateSecurityPolicyInput,
    userId: number | string,
  ): Promise<SecurityPolicy>;
  getNotificationSettings(): Promise<NotificationSettings>;
  updateNotificationSettings(
    input: UpdateNotificationSettingsInput,
    userId: number | string,
  ): Promise<NotificationSettings>;
  getAlertRules(): Promise<AlertRule[]>;
  createAlertRule(
    rule: Omit<AlertRule, 'id'>,
    userId: number | string,
  ): Promise<AlertRule>;
  updateAlertRule(
    ruleId: string,
    input: UpdateAlertRuleInput,
    userId: number | string,
  ): Promise<AlertRule>;
  deleteAlertRule(ruleId: string): Promise<void>;
}
