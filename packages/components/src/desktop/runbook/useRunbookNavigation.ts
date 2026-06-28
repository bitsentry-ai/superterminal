import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function useRunbookNavigation() {
  const navigate = useNavigate();

  const openRunbook = useCallback(
    (runbookId: string) => {
      void navigate(`/runbooks?id=${runbookId}`);
    },
    [navigate],
  );

  const openRunbooks = useCallback(() => {
    void navigate("/runbooks");
  }, [navigate]);

  const openRunbookResults = useCallback(
    (runbookId: string) => {
      void navigate(`/results?runbook=${runbookId}`);
    },
    [navigate],
  );

  const openResult = useCallback(
    (resultId: string) => {
      void navigate(`/results?id=${resultId}`);
    },
    [navigate],
  );

  return {
    openResult,
    openRunbook,
    openRunbookResults,
    openRunbooks,
  };
}
