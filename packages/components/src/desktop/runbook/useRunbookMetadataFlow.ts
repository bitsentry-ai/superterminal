import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";

import { collectRunbookGlobalReferences } from "@bitsentry-ce/core";

import type { GlobalVariable, RunbookRecord } from "../../services";
import type { RunbookMetaPatch } from "./runbookRecordHelpers";

type UseRunbookMetadataFlowOptions = {
  activeEditingRunbook: RunbookRecord | null;
  globalVariables: GlobalVariable[];
  setEditingRunbook: Dispatch<SetStateAction<RunbookRecord | null>>;
  commitMeta: (patch: RunbookMetaPatch) => Promise<void>;
};

export function useRunbookMetadataFlow({
  activeEditingRunbook,
  globalVariables,
  setEditingRunbook,
  commitMeta,
}: UseRunbookMetadataFlowOptions) {
  const unresolvedGlobalKeys = useMemo(() => {
    if (activeEditingRunbook === null) {
      return [];
    }

    const availableKeys = new Set(
      globalVariables.map((globalVariable) => globalVariable.key),
    );

    return collectRunbookGlobalReferences(activeEditingRunbook).filter(
      (key) => !availableKeys.has(key),
    );
  }, [activeEditingRunbook, globalVariables]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditingRunbook((prev) => {
        if (prev === null) {
          return prev;
        }

        let title = value;
        if (title.length === 0) {
          title = "Untitled Runbook";
        }

        return { ...prev, title };
      });
    },
    [setEditingRunbook],
  );

  const handleTitleBlur = useCallback(() => {
    if (activeEditingRunbook === null) {
      return;
    }

    let title = activeEditingRunbook.title;
    if (title.length === 0) {
      title = "Untitled Runbook";
    }

    void commitMeta({ title });
  }, [activeEditingRunbook, commitMeta]);

  const handleDescriptionChange = useCallback(
    (value: string) => {
      setEditingRunbook((prev) => {
        if (prev === null) {
          return prev;
        }

        return {
          ...prev,
          description: value,
        };
      });
    },
    [setEditingRunbook],
  );

  const handleDescriptionBlur = useCallback(() => {
    if (activeEditingRunbook === null) {
      return;
    }

    void commitMeta({
      description: activeEditingRunbook.description,
    });
  }, [activeEditingRunbook, commitMeta]);

  return {
    handleDescriptionBlur,
    handleDescriptionChange,
    handleTitleBlur,
    handleTitleChange,
    unresolvedGlobalKeys,
  };
}
