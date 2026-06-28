import type { ComponentProps } from "react";

import DashboardLayout from "../../layout/DashboardLayout";
import { RunbookDeleteDialog } from "./RunbookDeleteDialog";
import { RunbookEditorView } from "./RunbookEditorView";

type RunbookEditorScreenProps = {
  loading: boolean;
  loadingLabel: string;
  editorProps: ComponentProps<typeof RunbookEditorView>;
  deleteDialogProps: ComponentProps<typeof RunbookDeleteDialog>;
};

export function RunbookEditorScreen({
  loading,
  loadingLabel,
  editorProps,
  deleteDialogProps,
}: RunbookEditorScreenProps) {
  return (
    <DashboardLayout mainClassName="flex overflow-hidden p-0">
      {loading && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loadingLabel}
        </div>
      )}
      {!loading && <RunbookEditorView {...editorProps} />}
      <RunbookDeleteDialog {...deleteDialogProps} />
    </DashboardLayout>
  );
}
