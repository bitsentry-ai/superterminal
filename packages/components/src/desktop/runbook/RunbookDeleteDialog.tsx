import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import type { TranslationFn } from "./types";

type RunbookDeleteDialogProps = {
  open: boolean;
  runbookTitle: string;
  confirmText: string;
  isDeleting: boolean;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  t: TranslationFn;
};

export function RunbookDeleteDialog({
  open,
  runbookTitle,
  confirmText,
  isDeleting,
  onConfirmTextChange,
  onCancel,
  onConfirm,
  onOpenChange,
  t,
}: RunbookDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("runbooks.runbook.deleteRunbook_2")}</DialogTitle>
          <DialogDescription>
            {t("runbooks.runbook.thisActionCannotBeUndone")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("runbooks.runbook.toDeleteThisRunbookType")}{" "}
            <span className="font-medium text-foreground">{runbookTitle}</span>{" "}
            {t("runbooks.runbook.inTheBoxBelow")}
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(event) => {
              onConfirmTextChange(event.target.value);
            }}
            placeholder={runbookTitle}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-[hsl(var(--destructive)/0.5)]"
            autoFocus
            disabled={isDeleting}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t("common.actions.cancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onConfirm}
            disabled={isDeleting || confirmText !== runbookTitle}
          >
            {isDeleting && t("runbooks.runbook.deleting")}
            {!isDeleting && t("runbooks.runbook.deleteRunbook_3")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
