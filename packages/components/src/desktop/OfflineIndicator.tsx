import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@bitsentry-ce/components/ui/alert";
import { useTranslation } from "@bitsentry-ce/i18n";

const CONNECTION_EVENT_NAME = "bitsentry:connection-status";

export interface OfflineIndicatorProps {
  getDesktopConnectionStatus: () => boolean;
}

export default function OfflineIndicator({
  getDesktopConnectionStatus,
}: OfflineIndicatorProps) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    getDesktopConnectionStatus(),
  );

  useEffect(() => {
    const update = () => {
      setIsOnline(getDesktopConnectionStatus());
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener(CONNECTION_EVENT_NAME, update);

    const timer = window.setInterval(update, 10_000);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener(CONNECTION_EVENT_NAME, update);
      window.clearInterval(timer);
    };
  }, [getDesktopConnectionStatus]);

  if (isOnline) {
    return null;
  }

  return (
    <Alert
      variant="destructive"
      className="fixed bottom-4 right-4 z-50 w-auto max-w-sm"
    >
      <AlertDescription>
        {t("common.offlineIndicator.youAreOfflineLocalData")}
      </AlertDescription>
    </Alert>
  );
}
