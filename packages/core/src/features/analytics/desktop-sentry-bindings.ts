import {
  createDesktopSentry,
  type DesktopSentryApi,
  type DesktopSentryLogger,
  type DesktopSentryPort,
  type DesktopSentryRuntime,
} from './desktop-sentry'

export interface CreateDesktopSentryBindingsOptions {
  runtime: DesktopSentryRuntime
  logger: DesktopSentryLogger
  loadSentryMain(): Promise<DesktopSentryPort>
  env?: NodeJS.ProcessEnv
}

export function createDesktopSentryBindings(
  options: CreateDesktopSentryBindingsOptions,
): DesktopSentryApi {
  const env = options.env ?? process.env

  return createDesktopSentry({
    dsn: env.BITSENTRY_SENTRY_DSN ?? '',
    releaseChannel: env.BITSENTRY_RELEASE_CHANNEL ?? 'stable',
    runtime: options.runtime,
    logger: options.logger,
    loadSentryMain: () => options.loadSentryMain(),
  })
}
