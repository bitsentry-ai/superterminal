import { useCallback, useRef, useState } from "react";

import type { DesktopRpcChannel, RunbookRecord } from "../../services";

type DesktopIpcInvoke = <T>(
  channel: DesktopRpcChannel,
  payload?: unknown,
) => Promise<T>;

type CaptureDesktopAnalyticsEvent = (
  event: string,
  properties?: Record<string, unknown>,
) => void;

type UseRunbookDeleteFlowOptions = {
  activeEditingRunbook: RunbookRecord | null;
  runbooks: RunbookRecord[];
  ipcInvoke: DesktopIpcInvoke;
  captureDesktopAnalyticsEvent: CaptureDesktopAnalyticsEvent;
  summarizeRunbookForTelemetry: (runbook: RunbookRecord) => Record<string, unknown>;
  onDeleteSuccess: (nextRunbooks: RunbookRecord[], nextRunbook: RunbookRecord | null) => void;
};

export function useRunbookDeleteFlow({
  activeEditingRunbook,
  runbooks,
  ipcInvoke,
  captureDesktopAnalyticsEvent,
  summarizeRunbookForTelemetry,
  onDeleteSuccess,
}: UseRunbookDeleteFlowOptions) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingRunbook, setIsDeletingRunbook] = useState(false);
  const deleteConfirmedRef = useRef(false);
  const deleteCancellationTrackedRef = useRef(false);

  const handleOpenDeleteDialog = useCallback(() => {
    if (activeEditingRunbook === null) return;
    deleteConfirmedRef.current = false;
    deleteCancellationTrackedRef.current = false;
    setDeleteConfirmText("");
    setDeleteDialogOpen(true);
    captureDesktopAnalyticsEvent("desktop_runbook_delete_requested", {
      ...summarizeRunbookForTelemetry(activeEditingRunbook),
    });
  }, [
    activeEditingRunbook,
    captureDesktopAnalyticsEvent,
    summarizeRunbookForTelemetry,
  ]);

  const handleConfirmDeleteRunbook = useCallback(async () => {
    if (activeEditingRunbook === null) return;
    if (deleteConfirmText !== activeEditingRunbook.title) return;

    const nextRunbook =
      runbooks.find((runbook) => runbook.id !== activeEditingRunbook.id) ??
      null;

    setIsDeletingRunbook(true);
    try {
      await ipcInvoke<{ ok: true }>("runbooks:delete", {
        id: activeEditingRunbook.id,
      });
      deleteConfirmedRef.current = true;
      deleteCancellationTrackedRef.current = false;
      captureDesktopAnalyticsEvent("desktop_runbook_deleted", {
        ...summarizeRunbookForTelemetry(activeEditingRunbook),
      });

      const nextRunbooks = runbooks.filter(
        (runbook) => runbook.id !== activeEditingRunbook.id,
      );
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
      onDeleteSuccess(nextRunbooks, nextRunbook);
    } catch (error) {
      console.error("Failed to delete runbook:", error);
    } finally {
      setIsDeletingRunbook(false);
    }
  }, [
    activeEditingRunbook,
    captureDesktopAnalyticsEvent,
    deleteConfirmText,
    ipcInvoke,
    onDeleteSuccess,
    runbooks,
    summarizeRunbookForTelemetry,
  ]);

  const trackDeleteCancellation = useCallback(() => {
    if (activeEditingRunbook === null) {
      deleteConfirmedRef.current = false;
      return;
    }

    if (
      !deleteConfirmedRef.current &&
      !deleteCancellationTrackedRef.current
    ) {
      captureDesktopAnalyticsEvent("desktop_runbook_delete_cancelled", {
        ...summarizeRunbookForTelemetry(activeEditingRunbook),
      });
      deleteCancellationTrackedRef.current = true;
    }

    deleteConfirmedRef.current = false;
    setDeleteDialogOpen(false);
    setDeleteConfirmText("");
  }, [
    activeEditingRunbook,
    captureDesktopAnalyticsEvent,
    summarizeRunbookForTelemetry,
  ]);

  const handleDeleteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        trackDeleteCancellation();
      }
    },
    [trackDeleteCancellation],
  );

  return {
    deleteDialogOpen,
    deleteConfirmText,
    isDeletingRunbook,
    setDeleteConfirmText,
    handleOpenDeleteDialog,
    handleConfirmDeleteRunbook,
    handleDeleteDialogCancel: trackDeleteCancellation,
    handleDeleteDialogOpenChange,
  };
}
