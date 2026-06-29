import type { ErrorSourceType } from "./desktop-error-sources.types";

type SourceWithPluginConfig<TSourceType extends ErrorSourceType> = {
  sourceType: TSourceType;
  additionalMetadata?: unknown;
  configuration?: {
    baseUrl?: unknown;
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
    source: SourceWithPluginConfig<TSourceType>,
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

export function getProviderForSource<
  TSourceType extends ErrorSourceType,
  TProvider,
>(
  factory: ProviderFactory<TSourceType, TProvider>,
  source: SourceWithPluginConfig<TSourceType>,
): TProvider {
  const provider =
    factory.getProviderForSource?.(source) ?? factory.getProvider(source.sourceType);

  const baseUrl = source.configuration?.baseUrl;
  if (
    typeof baseUrl !== "string" ||
    baseUrl.trim().length === 0
  ) {
    return provider;
  }

  if (!hasWithApiBase(provider)) {
    throw new Error("Plugin-backed provider does not support custom API bases");
  }

  return provider.withApiBase(baseUrl.trim());
}
