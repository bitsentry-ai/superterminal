import { defineHttpEndpointContract } from "../../kernel/http-contract";
import {
  runbookWorkerAcceptedResponseSchema,
  runbookWorkerCancelExecutionRequestSchema,
  runbookWorkerHeartbeatRequestSchema,
  runbookWorkerClaimNextExecutionRequestSchema,
  runbookWorkerExecutionContextResponseSchema,
  runbookWorkerSnapshotUpdateRequestSchema,
} from "./runbooks.schemas";

export const runbooksWorkerContracts = {
  cancelExecution: defineHttpEndpointContract({
    method: "POST",
    path: "/runbooks/executions/cancel",
    requestEncoding: "body",
    requestSchema: runbookWorkerCancelExecutionRequestSchema,
    responseSchema: runbookWorkerAcceptedResponseSchema,
  }),
  claimNextExecutionContext: defineHttpEndpointContract({
    method: "GET",
    path: "/api/worker/runbook-executions/claim-next",
    requestEncoding: "query",
    requestSchema: runbookWorkerClaimNextExecutionRequestSchema,
    responseSchema: runbookWorkerExecutionContextResponseSchema.nullable(),
  }),
  heartbeat: defineHttpEndpointContract({
    method: "POST",
    path: "/api/worker/runbook-executions/:executionId/heartbeat",
    requestEncoding: "body",
    pathParams: ["executionId"] as const,
    requestSchema: runbookWorkerHeartbeatRequestSchema,
    responseSchema: runbookWorkerAcceptedResponseSchema,
  }),
  saveExecutionSnapshot: defineHttpEndpointContract({
    method: "POST",
    path: "/api/worker/runbook-executions/:executionId/snapshot",
    requestEncoding: "body",
    pathParams: ["executionId"] as const,
    requestSchema: runbookWorkerSnapshotUpdateRequestSchema.extend({
      executionId: runbookWorkerHeartbeatRequestSchema.shape.executionId,
    }),
    responseSchema: runbookWorkerAcceptedResponseSchema,
  }),
};
