import type { DiagnosisStateValue } from "../../../domain/value-objects/DiagnosisState";
import type { DiagnosisLlmProviderKey } from "../../../../diagnosis/contracts";

/**
 * Inbound Port: RecommendDiagnosisUseCase
 * Interface for generating remediation recommendations for verified diagnoses
 */

export interface RecommendDiagnosisInput {
  entryId: number;
  llmProviderKey?: DiagnosisLlmProviderKey;
  llmModel?: string;
}

export interface RecommendDiagnosisOutput {
  entryId: number;
  newState: DiagnosisStateValue;
  recommendationText: string;
  providerUsed?: DiagnosisLlmProviderKey;
  modelUsed?: string;
  currentActionLabel?: string;
  failureReason?: string;
}

export interface RecommendDiagnosisUseCase {
  execute(input: RecommendDiagnosisInput): Promise<RecommendDiagnosisOutput>;
}
