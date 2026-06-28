import type { LogCategory } from "../../../domain/entities/DiagnosisRecord";
import type { DiagnosisTelemetryEntrySource } from "../../../utils";

/**
 * Outbound Port: TelemetryQueryService
 * Interface for querying telemetry entries from the telemetry service
 */

export interface TelemetryEntryData {
  id: number;
  telemetryId: number;
  entryId: string;
  entryIndex: string;
  entrySource: DiagnosisTelemetryEntrySource;
  entryTimestamp: Date;
  agentName?: string;
  agentIp?: string;
  ruleId?: string;
  ruleDescription?: string;
  ruleLevel?: number;
  ruleGroups?: string[];
  category?: LogCategory;
}

export interface TelemetryQueryService {
  /**
   * Gets a telemetry entry by ID
   */
  getEntryById(id: number): Promise<TelemetryEntryData | null>;

  /**
   * Gets multiple telemetry entries by IDs (batch operation)
   * Returns a map of id -> entry data for efficient lookup
   */
  getEntriesByIds(ids: number[]): Promise<Map<number, TelemetryEntryData>>;
}
