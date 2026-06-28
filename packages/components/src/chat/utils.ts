import {
  type ModelCatalogProviderKey,
  getCatalogModelIds,
} from "../llm/modelCatalog";
import type { SavedProviderConfig } from "./types";

/**
 * Format duration in milliseconds to human-readable string.
 * Examples: 500 -> "0.5s", 1500 -> "1.5s", 3500 -> "3.5s", 60000 -> "60s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms / 100) / 10)}s`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)}s`;
  return `${String(Math.round(ms / 1000))}s`;
}

export function getProviderModelOptions(
  providerKey: ModelCatalogProviderKey,
  savedProviders: Record<string, SavedProviderConfig>,
): string[] {
  const saved = savedProviders[providerKey];
  let discoveredModels: string[] = [];
  if (Array.isArray(saved.availableModels)) {
    discoveredModels = saved.availableModels;
  }
  const merged = [
    ...discoveredModels,
    ...getCatalogModelIds(providerKey),
    saved.model,
  ];

  return Array.from(
    new Set(
      merged
        .map((modelId) => modelId.trim())
        .filter((modelId) => modelId.length > 0),
    ),
  );
}
