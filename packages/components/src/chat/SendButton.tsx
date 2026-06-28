/**
 * SendButton — send arrow (idle) / stop square (streaming).
 */

import { cn } from "../lib/utils";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "@bitsentry-ce/i18n";

interface SendButtonProps {
  isProcessing: boolean;
  canSend: boolean;
  onSend: () => void;
  onCancel: () => void;
}

export function SendButton({
  isProcessing,
  canSend,
  onSend,
  onCancel,
}: SendButtonProps) {
  const { t } = useTranslation();
  let clickHandler = onSend;
  let buttonClassName = "bg-muted text-muted-foreground cursor-not-allowed opacity-30";
  let title = t("common.incidents.sendMessageEnter");
  let ariaLabel = t("common.incidents.sendMessage");
  let icon = <ArrowUp size={14} />;

  if (canSend) {
    buttonClassName = "bg-primary/90 text-primary-foreground hover:bg-primary hover:scale-105";
  }

  if (isProcessing) {
    clickHandler = onCancel;
    buttonClassName = "bg-destructive/90 text-destructive-foreground hover:bg-destructive hover:scale-105";
    title = t("common.actions.cancel");
    ariaLabel = t("common.actions.cancel");
    icon = (
      <span
        aria-hidden="true"
        className="block size-3 rounded-[2px] bg-current"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={clickHandler}
      disabled={!isProcessing && !canSend}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition-all duration-150",
        buttonClassName,
      )}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );
}
