import type { ErrorSourceType } from './desktop-error-sources.types'
import type { ErrorSourceProvider } from './desktop-error-source-provider.interface'
import { PostHogProviderAdapter } from './desktop-posthog-provider.adapter'
import { SentryProviderAdapter } from './desktop-sentry-provider.adapter'

export class ErrorSourceProviderFactory {
  private readonly providers = new Map<ErrorSourceType, ErrorSourceProvider>()

  constructor() {
    const sentry = new SentryProviderAdapter()
    this.providers.set(sentry.sourceType, sentry)
    const posthog = new PostHogProviderAdapter()
    this.providers.set(posthog.sourceType, posthog)
  }

  getProvider(sourceType: ErrorSourceType): ErrorSourceProvider {
    const provider = this.providers.get(sourceType)
    if (provider === undefined) {
      throw new Error(`Unsupported error source type: ${sourceType}`)
    }
    return provider
  }
}
