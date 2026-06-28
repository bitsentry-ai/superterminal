import type { ErrorSourceType } from "./desktop-error-sources.types";
import {
  assertAllowedPostHogBaseUrl,
  parsePostHogAllowedHostsEnv,
} from "./posthog-base-url";

type SourceWithPostHogConfig<TSourceType extends ErrorSourceType> = {
  sourceType: TSourceType;
  additionalMetadata?: unknown;
  configuration?: {
    posthogBaseUrl?: unknown;
  };
};

type ProviderFactory<TSourceType extends ErrorSourceType, TProvider> = {
  getProvider(sourceType: TSourceType): TProvider;
  getPlugin?: (
    pluginId: string,
  ) => {
    metadata?: {
      errorSource?: {
        sourceType?: TSourceType;
      };
    };
  } | null;
  getProviderForSource?: (
    source: SourceWithPostHogConfig<TSourceType>,
  ) => TProvider;
};

function hasWithApiBase<TProvider>(
  provider: TProvider,
): provider is TProvider & {
  withApiBase(baseUrl: string): TProvider;
} {
  if (
    provider === null ||
    provider === undefined ||
    typeof provider !== "object" ||
    Array.isArray(provider)
  ) {
    return false;
  }

  return (
    typeof (provider as { withApiBase?: unknown }).withApiBase === "function"
  );
}

function readPluginId(additionalMetadata: unknown): string | undefined {
  if (
    additionalMetadata === null ||
    additionalMetadata === undefined ||
    typeof additionalMetadata !== "object" ||
    Array.isArray(additionalMetadata)
  ) {
    return undefined;
  }

  const pluginId = (additionalMetadata as { pluginId?: unknown }).pluginId;
  if (typeof pluginId !== "string") {
    return undefined;
  }

  const normalized = pluginId.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

function hasMatchingErrorSourcePlugin<TSourceType extends ErrorSourceType>(
  factory: ProviderFactory<TSourceType, unknown>,
  source: SourceWithPostHogConfig<TSourceType>,
): boolean {
  const pluginId = readPluginId(source.additionalMetadata);
  if (pluginId === undefined) {
    return false;
  }

  return factory.getPlugin?.(pluginId)?.metadata?.errorSource?.sourceType === source.sourceType;
}

export function getProviderForSource<
  TSourceType extends ErrorSourceType,
  TProvider,
>(
  factory: ProviderFactory<TSourceType, TProvider>,
  source: SourceWithPostHogConfig<TSourceType>,
): TProvider {
  const provider =
    factory.getProviderForSource?.(source) ?? factory.getProvider(source.sourceType);
  if (source.sourceType !== "posthog") {
    return provider;
  }

  const posthogBaseUrl = source.configuration?.posthogBaseUrl;
  if (
    typeof posthogBaseUrl !== "string" ||
    posthogBaseUrl.trim().length === 0
  ) {
    return provider;
  }

  if (!hasWithApiBase(provider)) {
    throw new Error("PostHog provider does not support custom API bases");
  }

  const normalizedPostHogBaseUrl = posthogBaseUrl.trim();
  if (hasMatchingErrorSourcePlugin(factory, source)) {
    return provider.withApiBase(normalizedPostHogBaseUrl);
  }

  // Let allowlist errors propagate before a plugin can receive a request URL.
  return provider.withApiBase(
    assertAllowedPostHogBaseUrl(normalizedPostHogBaseUrl, {
      extraAllowedHosts: parsePostHogAllowedHostsEnv(
        process.env.POSTHOG_ALLOWED_BASE_URLS,
      ),
    }),
  );
}
