import type { ComponentProps } from "react";

import { RunbookImportDialog } from "../../runbook/RunbookImportDialog";
import { RunbookLibraryView } from "./RunbookLibraryView";

type RunbookLibraryScreenProps = {
  libraryProps: ComponentProps<typeof RunbookLibraryView>;
  importDialogProps: ComponentProps<typeof RunbookImportDialog>;
};

export function RunbookLibraryScreen({
  libraryProps,
  importDialogProps,
}: RunbookLibraryScreenProps) {
  return (
    <>
      <RunbookLibraryView {...libraryProps} />
      <RunbookImportDialog {...importDialogProps} />
    </>
  );
}
