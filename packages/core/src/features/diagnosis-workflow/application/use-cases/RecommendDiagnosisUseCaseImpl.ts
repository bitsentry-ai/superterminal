import type {
  RecommendDiagnosisUseCase,
  RecommendDiagnosisInput,
  RecommendDiagnosisOutput,
} from "../ports/inbound/RecommendDiagnosisUseCase";
import type { DiagnosisRepository } from "../ports/outbound/DiagnosisRepository";
import type { TelemetryQueryService } from "../ports/outbound/TelemetryQueryService";
import type { LLMService } from "../ports/outbound/LLMService";
import { DiagnosisState } from "../../domain/value-objects/DiagnosisState";
import {
  EntryNotFoundError,
  DiagnosisNotFoundError,
  WrongStateError,
} from "../../domain/errors/DiagnosisError";

function normalizedRecommendationText(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
}

/**
 * Application Service: RecommendDiagnosisUseCaseImpl
 * Generates remediation recommendations for verified diagnoses
 */
export class RecommendDiagnosisUseCaseImpl implements RecommendDiagnosisUseCase {
  constructor(
    private readonly diagnosisRepository: DiagnosisRepository,
    private readonly telemetryQueryService: TelemetryQueryService,
    private readonly llmService: LLMService,
  ) {}

  async execute(
    input: RecommendDiagnosisInput,
  ): Promise<RecommendDiagnosisOutput> {
    // 1. Validate that the telemetry entry exists
    const entry = await this.telemetryQueryService.getEntryById(input.entryId);
    if (entry === null) {
      throw new EntryNotFoundError(input.entryId);
    }

    // 2. Get diagnosis record
    const diagnosisRecord = await this.diagnosisRepository.findByEntryId(
      input.entryId,
    );
    if (diagnosisRecord === null) {
      throw new DiagnosisNotFoundError(input.entryId);
    }

    // 3. Validate current state is 'verified'
    if (!diagnosisRecord.currentState.isVerified()) {
      throw new WrongStateError(
        "verified",
        diagnosisRecord.currentState.value(),
        "recommend",
      );
    }

    // 4. Build recommendation text from prior diagnosis artifacts
    // Repository handles backward compatibility, so canonical keys are populated
    // Read directly from canonical keys (repository handles legacy fallbacks)
    const assessment = normalizedRecommendationText(
      diagnosisRecord.stateTexts.diagnose,
    );
    const verificationText = normalizedRecommendationText(
      diagnosisRecord.stateTexts.verify,
    );
    const diagnosisConfirmation = normalizedRecommendationText(
      diagnosisRecord.stateTexts.verify,
    );

    const recommendationResult = await this.llmService.recommend({
      assessment: assessment ?? "N/A",
      verificationText,
      diagnosisConfirmation,
      llmProviderKey: input.llmProviderKey,
      llmModel: input.llmModel,
    });
    const recommendationText = recommendationResult.recommendationText;

    // 5. Transition state from 'verified' to 'completed' with recommendation text
    diagnosisRecord.transitionTo(DiagnosisState.completed(), {
      operation: "recommend",
      text: recommendationText,
      metadata: {
        recommendation_generated: true,
        recommendation_timestamp: new Date().toISOString(),
        provider_used: recommendationResult.providerUsed,
        model_used: recommendationResult.modelUsed,
        current_action_label: "Generating Recommendation",
      },
    });

    // 6. Save the updated record
    await this.diagnosisRepository.save(diagnosisRecord);

    return {
      entryId: input.entryId,
      newState: "completed",
      recommendationText,
      providerUsed: recommendationResult.providerUsed,
      modelUsed: recommendationResult.modelUsed,
      currentActionLabel: "Generating Recommendation",
    };
  }
}
