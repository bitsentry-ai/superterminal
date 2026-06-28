import type { DiagnosisStateValue } from "../../../domain/value-objects/DiagnosisState";

/**
 * Inbound Port: UpdateDiagnosisStateUseCase
 * Interface for manually updating diagnosis state
 */

export interface UpdateDiagnosisStateInput {
  entryId: number;
  toState: DiagnosisStateValue;
  text?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDiagnosisStateOutput {
  entryId: number;
  newState: DiagnosisStateValue;
  updatedAt: Date;
}

export interface UpdateDiagnosisStateUseCase {
  execute(
    input: UpdateDiagnosisStateInput,
  ): Promise<UpdateDiagnosisStateOutput>;
}
