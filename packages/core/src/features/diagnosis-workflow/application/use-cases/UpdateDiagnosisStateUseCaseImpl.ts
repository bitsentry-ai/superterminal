import type {
  UpdateDiagnosisStateUseCase,
  UpdateDiagnosisStateInput,
  UpdateDiagnosisStateOutput,
} from "../ports/inbound/UpdateDiagnosisStateUseCase";
import type { DiagnosisRepository } from "../ports/outbound/DiagnosisRepository";
import type { TelemetryQueryService } from "../ports/outbound/TelemetryQueryService";
import { DiagnosisState } from "../../domain/value-objects/DiagnosisState";
import {
  EntryNotFoundError,
  InvalidStateTransitionError,
} from "../../domain/errors/DiagnosisError";

/**
 * Application Service: UpdateDiagnosisStateUseCaseImpl
 * Manually updates the diagnosis state
 */
export class UpdateDiagnosisStateUseCaseImpl implements UpdateDiagnosisStateUseCase {
  constructor(
    private readonly diagnosisRepository: DiagnosisRepository,
    private readonly telemetryQueryService: TelemetryQueryService,
  ) {}

  async execute(
    input: UpdateDiagnosisStateInput,
  ): Promise<UpdateDiagnosisStateOutput> {
    // 1. Verify entry exists
    const entry = await this.telemetryQueryService.getEntryById(input.entryId);
    if (entry === null) {
      throw new EntryNotFoundError(input.entryId);
    }

    // 2. Ensure diagnosis record exists
    const diagnosisRecord = await this.diagnosisRepository.ensureForEntry(
      input.entryId,
    );

    // 3. Parse target state
    const targetState = DiagnosisState.create(input.toState);

    // 4. Validate and transition
    if (!diagnosisRecord.currentState.canTransitionTo(targetState)) {
      throw new InvalidStateTransitionError(
        diagnosisRecord.currentState.value(),
        input.toState,
      );
    }

    diagnosisRecord.transitionTo(targetState, input.text, input.metadata);

    // 5. Save
    const savedRecord = await this.diagnosisRepository.save(diagnosisRecord);

    return {
      entryId: input.entryId,
      newState: savedRecord.currentState.value(),
      updatedAt: savedRecord.updatedAt ?? new Date(),
    };
  }
}
