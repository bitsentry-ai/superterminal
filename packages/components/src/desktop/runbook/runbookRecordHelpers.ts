import type {
  RunbookActionRecord,
  RunbookHttpMethod,
  RunbookLlmProviderKey,
  RunbookRecord,
} from "../../services";

export type RunbookMetaPatch = Partial<
  Pick<RunbookRecord, "title" | "description" | "idleTimeout">
>;

export function cloneRunbook(runbook: RunbookRecord | null): RunbookRecord | null {
  if (runbook === null) {
    return null;
  }

  return {
    ...runbook,
    actions: runbook.actions.map((action) => {
      const clonedAction = { ...action };
      if (action.headers !== undefined) {
        clonedAction.headers = action.headers.map((header) => ({ ...header }));
      }
      if (action.parameters !== undefined) {
        clonedAction.parameters = action.parameters.map((parameter) => ({ ...parameter }));
      }
      if (action.logFilter !== undefined) {
        clonedAction.logFilter = { ...action.logFilter };
      }
      return clonedAction;
    }),
  };
}

export function toErrorMessage(error: unknown): string {
  let message = "";
  if (error instanceof Error) {
    message = error.message.trim();
  }

  if (message.length > 0) {
    return message;
  }

  return "Unknown error";
}

export function getActiveEditingRunbook(
  editingRunbook: RunbookRecord | null,
  activeId: string | null,
): RunbookRecord | null {
  if (editingRunbook === null || activeId === null) {
    return null;
  }

  if (editingRunbook.id !== activeId) {
    return null;
  }

  return editingRunbook;
}

export function applyRunbookMetaPatch(
  runbook: RunbookRecord,
  patch: RunbookMetaPatch,
): Pick<RunbookRecord, "title" | "description" | "idleTimeout"> {
  let idleTimeout = runbook.idleTimeout;
  if (Object.prototype.hasOwnProperty.call(patch, "idleTimeout")) {
    idleTimeout = patch.idleTimeout;
  }

  return {
    title: patch.title ?? runbook.title,
    description: patch.description ?? runbook.description,
    idleTimeout,
  };
}

export function hasRunbookMetaChanged(
  runbook: RunbookRecord,
  next: Pick<RunbookRecord, "title" | "description" | "idleTimeout">,
): boolean {
  return (
    next.title !== runbook.title ||
    next.description !== runbook.description ||
    next.idleTimeout !== runbook.idleTimeout
  );
}

export function summarizeRunbookForTelemetry(runbook: RunbookRecord) {
  let idleTimeout: number | undefined;
  if (typeof runbook.idleTimeout === "number") {
    idleTimeout = runbook.idleTimeout;
  }

  return {
    runbook_id: runbook.id,
    runbook_action_count: runbook.actions.length,
    runbook_has_description: runbook.description.trim().length > 0,
    runbook_idle_timeout_minutes: idleTimeout,
  };
}

export function summarizeRunbookActionForTelemetry(action: RunbookActionRecord) {
  let method: RunbookHttpMethod | undefined;
  if ("method" in action) {
    method = action.method;
  }

  let provider: RunbookLlmProviderKey | undefined;
  if ("llmProviderKey" in action) {
    provider = action.llmProviderKey;
  }

  let sourceConnected: boolean | undefined;
  if ("sourceId" in action) {
    sourceConnected = action.sourceId !== undefined && action.sourceId.length > 0;
  }

  return {
    runbook_action_id: action.id,
    runbook_action_type: action.type,
    runbook_action_method: method,
    runbook_action_provider: provider,
    runbook_action_source_connected: sourceConnected,
    runbook_action_parameter_count: action.parameters?.length ?? 0,
    runbook_action_has_log_filter: action.logFilter !== undefined,
  };
}
