import type {
  DiagnoseEntryRequest,
  DiagnoseEntryResponse,
  DiagnosisQuery,
  DiagnosisResultsResponse,
  DiagnosisTicket,
  DiagnosisTicketCreateEventData,
  DiagnosisTicketStatus,
  RecommendDiagnosisRequest,
  RecommendDiagnosisResponse,
  TelemetryEntryResponse,
  UpdateDiagnosisStateRequest,
  UpdateDiagnosisStateResponse,
  VerifyDiagnosisRequest,
  VerifyDiagnosisResponse,
} from '../../contracts';

export interface DiagnosisServicePort {
  getResults(query?: DiagnosisQuery): Promise<DiagnosisResultsResponse>;
  getTelemetryEntry(id: number): Promise<TelemetryEntryResponse>;
  diagnoseEntry(input: DiagnoseEntryRequest): Promise<DiagnoseEntryResponse>;
  verifyDiagnosis(input: VerifyDiagnosisRequest): Promise<VerifyDiagnosisResponse>;
  recommendDiagnosis(
    input: RecommendDiagnosisRequest,
  ): Promise<RecommendDiagnosisResponse>;
  updateDiagnosisState(
    input: UpdateDiagnosisStateRequest,
  ): Promise<UpdateDiagnosisStateResponse>;
}

export interface DiagnosisTicketRepositoryPort {
  findByDiagnosisId(diagnosisId: number): Promise<DiagnosisTicket | null>;
  findManyByDiagnosisIds(diagnosisIds?: number[]): Promise<DiagnosisTicket[]>;
  findManyByStatus(status: DiagnosisTicketStatus): Promise<DiagnosisTicket[]>;
  findOpen(limit?: number): Promise<DiagnosisTicket[]>;
}

export interface DiagnosisTicketProviderPort {
  getDefaultProviderType(): string;
}

export interface DiagnosisTicketEventPublisherPort {
  publishCreate(eventData: DiagnosisTicketCreateEventData): Promise<void>;
  publishCreateAsync(eventData: DiagnosisTicketCreateEventData): Promise<void>;
}
