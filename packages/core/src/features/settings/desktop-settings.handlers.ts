import { z } from 'zod'
import type { SettingsUseCases } from './application/ports'
import type {
  AlertRule,
  GeneralSettings,
  NotificationSettings,
  SecurityPolicy,
} from './contracts'

const generalSettingsPatchSchema: z.ZodType<Partial<GeneralSettings>> = z
  .object({
    organizationName: z.string(),
    timezone: z.string(),
    dateFormat: z.string(),
    timeFormat: z.string(),
    language: z.string(),
    defaultDashboard: z.string(),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().optional(),
    lastUsedExternalSourceId: z.string().nullable().optional(),
  })
  .partial()

const securityPolicyPatchSchema: z.ZodType<Partial<SecurityPolicy>> = z
  .object({
    passwordMinLength: z.number(),
    passwordRequireUppercase: z.boolean(),
    passwordRequireLowercase: z.boolean(),
    passwordRequireNumbers: z.boolean(),
    passwordRequireSpecialChars: z.boolean(),
    passwordExpirationDays: z.number(),
    sessionTimeoutMinutes: z.number(),
    rememberMeExpiryHours: z.number(),
    maxLoginAttempts: z.number(),
    lockoutDurationMinutes: z.number(),
    twoFactorRequired: z.boolean(),
    twoFactorGracePeriodDays: z.number(),
    twoFactorEnabledDate: z.string().optional(),
    twoFactorEnforcementMode: z.enum(['warn', 'block']),
    ipWhitelistEnabled: z.boolean(),
    ipWhitelist: z.array(z.string()),
  })
  .partial()

const notificationSettingsPatchSchema: z.ZodType<Partial<NotificationSettings>> = z
  .object({
    emailEnabled: z.boolean(),
    emailServer: z.string(),
    emailPort: z.number(),
    emailSecure: z.boolean(),
    emailFrom: z.string(),
    slackEnabled: z.boolean(),
    slackWebhookUrl: z.string().optional(),
    teamsEnabled: z.boolean(),
    teamsWebhookUrl: z.string().optional(),
    webhookEnabled: z.boolean(),
    webhookUrl: z.string().optional(),
    webhookHeaders: z.unknown().optional(),
  })
  .partial()

const alertRuleObjectSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  type: z.enum(['vulnerability', 'threat', 'agent', 'scan', 'incident']),
  severity: z.array(z.string()),
  channels: z.array(z.string()),
  recipients: z.array(z.string()),
  conditions: z.unknown(),
})
const alertRuleInputSchema: z.ZodType<Omit<AlertRule, 'id'>> = alertRuleObjectSchema

const alertRulePatchSchema: z.ZodType<Partial<Omit<AlertRule, 'id'>>> =
  alertRuleObjectSchema.partial()

function createSettingsDataPayloadSchema<T>(dataSchema: z.ZodType<T>) {
  return z.object({
    data: dataSchema,
    userId: z.number().optional(),
  })
}

const generalSettingsPayloadSchema = createSettingsDataPayloadSchema(
  generalSettingsPatchSchema,
)
const securityPolicyPayloadSchema = createSettingsDataPayloadSchema(
  securityPolicyPatchSchema,
)
const notificationSettingsPayloadSchema = createSettingsDataPayloadSchema(
  notificationSettingsPatchSchema,
)
const alertRuleCreatePayloadSchema = z.object({
  rule: alertRuleInputSchema,
  userId: z.number().optional(),
})
const alertRuleUpdatePayloadSchema = z.object({
  ruleId: z.string(),
  data: alertRulePatchSchema,
  userId: z.number().optional(),
})
const alertRuleDeletePayloadSchema = z.object({
  ruleId: z.string(),
})
const initializeDefaultsPayloadSchema = z
  .object({
    userId: z.number().optional(),
  })
  .optional()
  .default({})

export function createDesktopSettingsHandlers(
  settingsUseCases: SettingsUseCases,
): Record<string, (payload: unknown) => Promise<unknown>> {
  return {
    'settings:getAll': async () => {
      return settingsUseCases.getAllSettings()
    },

    'settings:getGeneral': async () => {
      return settingsUseCases.getGeneralSettings()
    },

    'settings:updateGeneral': async (payload: unknown) => {
      const { data, userId } = generalSettingsPayloadSchema.parse(payload)
      return settingsUseCases.updateGeneralSettings(data, userId ?? 1)
    },

    'settings:getSecurity': async () => {
      return settingsUseCases.getSecurityPolicy()
    },

    'settings:updateSecurity': async (payload: unknown) => {
      const { data, userId } = securityPolicyPayloadSchema.parse(payload)
      return settingsUseCases.updateSecurityPolicy(data, userId ?? 1)
    },

    'settings:getNotifications': async () => {
      return settingsUseCases.getNotificationSettings()
    },

    'settings:updateNotifications': async (payload: unknown) => {
      const { data, userId } = notificationSettingsPayloadSchema.parse(payload)
      return settingsUseCases.updateNotificationSettings(data, userId ?? 1)
    },

    'settings:getAlertRules': async () => {
      return settingsUseCases.getAlertRules()
    },

    'settings:createAlertRule': async (payload: unknown) => {
      const { rule, userId } = alertRuleCreatePayloadSchema.parse(payload)
      return settingsUseCases.createAlertRule(rule, userId ?? 1)
    },

    'settings:updateAlertRule': async (payload: unknown) => {
      const { ruleId, data, userId } = alertRuleUpdatePayloadSchema.parse(payload)
      return settingsUseCases.updateAlertRule(ruleId, data, userId ?? 1)
    },

    'settings:deleteAlertRule': async (payload: unknown) => {
      const { ruleId } = alertRuleDeletePayloadSchema.parse(payload)
      await settingsUseCases.deleteAlertRule(ruleId)
      return { success: true }
    },

    'settings:initializeDefaults': async (payload: unknown) => {
      const { userId } = initializeDefaultsPayloadSchema.parse(payload)
      await settingsUseCases.initializeDefaults(userId ?? 1)
      return { success: true }
    },
  }
}
