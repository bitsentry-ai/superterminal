import { useCallback, useEffect, useState } from "react";

import { toast as showToast } from "../../hooks/use-toast";
import type {
  DesktopRpcChannel,
  RunbookExportArtifactV1,
  RunbookImportOptions,
  RunbookImportSummary,
  RunbookRecord,
} from "../../services";
import { getDesktopApi } from "../../services/desktop-api";
import type { TranslationFn } from "./types";
import type { RunbookImportConflictPolicy } from "../../runbook/RunbookImportDialog";
import { RUNBOOK_ARTIFACT_FILE_FILTERS, summarizeImportResult } from "./storageHelpers";

type DesktopIpcInvoke = <T>(
  channel: DesktopRpcChannel,
  payload?: unknown,
) => Promise<T>;

type CaptureDesktopAnalyticsEvent = (
  event: string,
  properties?: Record<string, unknown>,
) => void;

type UseRunbookImportFlowOptions = {
  ipcInvoke: DesktopIpcInvoke;
  refreshRunbooks: () => Promise<RunbookRecord[]>;
  captureDesktopAnalyticsEvent: CaptureDesktopAnalyticsEvent;
  t: TranslationFn;
  toast: typeof showToast;
};

export function useRunbookImportFlow({
  ipcInvoke,
  refreshRunbooks,
  captureDesktopAnalyticsEvent,
  t,
  toast,
}: UseRunbookImportFlowOptions) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importArtifact, setImportArtifact] =
    useState<RunbookExportArtifactV1 | null>(null);
  const [importConflictPolicy, setImportConflictPolicy] =
    useState<RunbookImportConflictPolicy>("duplicate");
  const [importPreviewSummary, setImportPreviewSummary] =
    useState<RunbookImportSummary | null>(null);
  const [importResultSummary, setImportResultSummary] =
    useState<RunbookImportSummary | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(
    null,
  );
  const [includeGlobalsOnImport, setIncludeGlobalsOnImport] = useState(true);

  const handleCloseImportDialog = useCallback(() => {
    if (importArtifact !== null && importResultSummary === null) {
      captureDesktopAnalyticsEvent("desktop_runbook_import_cancelled", {
        import_conflict_policy: importConflictPolicy,
        include_globals: includeGlobalsOnImport,
      });
    }
    setImportDialogOpen(false);
    setImportArtifact(null);
    setImportConflictPolicy("duplicate");
    setImportPreviewSummary(null);
    setImportResultSummary(null);
    setImportErrorMessage(null);
    setImportPreviewLoading(false);
    setImportSubmitting(false);
    setIncludeGlobalsOnImport(true);
  }, [
    captureDesktopAnalyticsEvent,
    importArtifact,
    importConflictPolicy,
    importResultSummary,
    includeGlobalsOnImport,
  ]);

  const handleOpenImportDialog = useCallback(async () => {
    try {
      const desktopApi = getDesktopApi();
      if (desktopApi?.dialog === undefined) {
        throw new Error("Desktop API bridge unavailable");
      }

      const { filePaths, canceled } = await desktopApi.dialog.showOpenDialog({
        filters: RUNBOOK_ARTIFACT_FILE_FILTERS,
        properties: ["openFile"],
        trustScope: "runbooks-import",
      });

      if (canceled || filePaths.length === 0) {
        return;
      }

      const selectedFilePath = filePaths[0];
      const artifact = await ipcInvoke<RunbookExportArtifactV1>(
        "runbooks:readImportArtifact",
        {
          filePath: selectedFilePath,
        },
      );

      captureDesktopAnalyticsEvent("desktop_runbook_import_flow_started", {
        import_file_selected: true,
        import_runbook_count: artifact.runbooks.length,
      });
      setImportArtifact(artifact);
      setImportConflictPolicy("duplicate");
      setImportPreviewSummary(null);
      setImportResultSummary(null);
      setImportErrorMessage(null);
      setImportDialogOpen(true);
    } catch (error) {
      const message = toErrorMessage(error);
      console.error("Failed to open runbook import artifact:", error);
      toast({
        variant: "destructive",
        title: t("runbooks.runbook.importFailed"),
        description: message,
      });
    }
  }, [captureDesktopAnalyticsEvent, ipcInvoke, t, toast]);

  const handleConfirmImport = useCallback(async () => {
    if (importArtifact === null) {
      return;
    }

    setImportSubmitting(true);
    setImportErrorMessage(null);

    try {
      const summary = await ipcInvoke<RunbookImportSummary>("runbooks:import", {
        artifact: importArtifact,
        options: {
          conflictPolicy: importConflictPolicy,
          dryRun: false,
          includeGlobals: includeGlobalsOnImport,
        } satisfies RunbookImportOptions,
      });

      setImportResultSummary(summary);
      toast({
        title: t("runbooks.runbook.importComplete"),
        description: summarizeImportResult(summary),
      });

      try {
        await refreshRunbooks();
      } catch (error) {
        console.error(
          "Imported runbooks but failed to refresh the runbook list:",
          error,
        );
        toast({
          variant: "destructive",
          title: t("runbooks.runbook.importCompletedRefreshFailed"),
          description: toErrorMessage(error),
        });
      }
    } catch (error) {
      const message = toErrorMessage(error);
      console.error("Failed to import runbooks:", error);
      setImportErrorMessage(message);
      toast({
        variant: "destructive",
        title: t("runbooks.runbook.importFailed"),
        description: message,
      });
    } finally {
      setImportSubmitting(false);
    }
  }, [
    importArtifact,
    importConflictPolicy,
    includeGlobalsOnImport,
    ipcInvoke,
    refreshRunbooks,
    t,
    toast,
  ]);

  useEffect(() => {
    if (
      !importDialogOpen ||
      importArtifact === null ||
      importResultSummary !== null
    ) {
      return;
    }

    let cancelled = false;

    const previewImport = async () => {
      setImportPreviewLoading(true);
      setImportErrorMessage(null);

      try {
        const summary = await ipcInvoke<RunbookImportSummary>(
          "runbooks:import",
          {
            artifact: importArtifact,
            options: {
              conflictPolicy: importConflictPolicy,
              dryRun: true,
              includeGlobals: includeGlobalsOnImport,
            } satisfies RunbookImportOptions,
          },
        );

        if (!cancelled) {
          setImportPreviewSummary(summary);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to preview runbook import:", error);
          setImportPreviewSummary(null);
          setImportErrorMessage(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setImportPreviewLoading(false);
        }
      }
    };

    void previewImport();

    return () => {
      cancelled = true;
    };
  }, [
    importArtifact,
    importConflictPolicy,
    importDialogOpen,
    importResultSummary,
    includeGlobalsOnImport,
    ipcInvoke,
  ]);

  return {
    importDialogOpen,
    importArtifact,
    importConflictPolicy,
    importPreviewSummary,
    importResultSummary,
    importPreviewLoading,
    importSubmitting,
    importErrorMessage,
    includeGlobalsOnImport,
    setImportConflictPolicy,
    setIncludeGlobalsOnImport,
    handleCloseImportDialog,
    handleOpenImportDialog,
    handleConfirmImport,
  };
}

function toErrorMessage(error: unknown): string {
  let message = "";
  if (error instanceof Error) {
    message = error.message.trim();
  }

  if (message.length > 0) {
    return message;
  }

  return "Unknown error";
}
