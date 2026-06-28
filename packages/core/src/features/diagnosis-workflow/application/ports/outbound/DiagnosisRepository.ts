import {
  DiagnosisRecord,
  type LogCategory,
  type DiagnosisLogLevel,
  type DiagnosisSeverity,
  type DiagnosisSourceCategory,
} from "../../../domain/entities/DiagnosisRecord";
import type { DiagnosisStateValue } from "../../../domain/value-objects/DiagnosisState";

/**
 * Outbound Port: DiagnosisRepository
 * Interface for diagnosis state machine persistence
 */
export interface DiagnosisRepository {
  /**
   * Finds a diagnosis record by telemetry entry ID
   */
  findByEntryId(telemetryEntryId: number): Promise<DiagnosisRecord | null>;

  /**
   * Ensures a diagnosis record exists for an entry, creating if needed
   */
  ensureForEntry(telemetryEntryId: number): Promise<DiagnosisRecord>;

  /**
   * Saves a diagnosis record (create or update)
   */
  save(record: DiagnosisRecord): Promise<DiagnosisRecord>;

  /**
   * Lists diagnosis records with filtering
   */
  list(params: ListDiagnosisParams): Promise<ListDiagnosisResult>;

  /**
   * Gets raw diagnostic info for debugging purposes
   * Returns the raw database state without domain mapping
   */
  getDebugInfo(telemetryEntryId: number): Promise<DiagnosisDebugInfo | null>;
}

/**
 * Raw diagnostic info for debugging state machine issues
 */
export interface DiagnosisDebugInfo {
  id: number;
  telemetryEntryId: number;
  currentState: string;
  stateHistoryRaw: unknown;
  stateHistoryRawType: string;
  stateTextsRaw: unknown;
  stateTextsRawType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListDiagnosisParams {
  recordIds?: number[];
  telemetryEntryId?: number;
  status?: DiagnosisStateValue;
  statuses?: DiagnosisStateValue[];
  category?: LogCategory;
  sourceCategory?: DiagnosisSourceCategory;
  logLevel?: DiagnosisLogLevel;
  severity?: DiagnosisSeverity;
  limit: number;
}

export interface ListDiagnosisResult {
  items: DiagnosisRecord[];
  total: number;
}
