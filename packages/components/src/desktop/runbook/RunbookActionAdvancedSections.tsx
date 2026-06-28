import { previewRunbookLogFilter } from "@bitsentry-ce/core";

import type {
  GlobalVariable,
  RunbookActionParameter,
  RunbookActionRecord,
} from "../../services";
import { RunbookActionLogFilterSection } from "./RunbookActionLogFilterSection";
import { RunbookActionParametersSection } from "./RunbookActionParametersSection";
import type { TranslationFn } from "./types";

type RunbookActionAdvancedSectionsProps = {
  action: RunbookActionRecord;
  parameters: RunbookActionParameter[];
  parameterErrors: string[];
  globalVariables: GlobalVariable[];
  logFilterErrors: string[];
  logFilterPreview: ReturnType<typeof previewRunbookLogFilter>;
  logFilterSample: string;
  logFilterToggleText: string;
  onActionChange: (action: RunbookActionRecord) => void;
  onLogFilterSampleChange: (value: string) => void;
  t: TranslationFn;
};

export function RunbookActionAdvancedSections({
  action,
  parameters,
  parameterErrors,
  globalVariables,
  logFilterErrors,
  logFilterPreview,
  logFilterSample,
  logFilterToggleText,
  onActionChange,
  onLogFilterSampleChange,
  t,
}: RunbookActionAdvancedSectionsProps) {
  return (
    <>
      <RunbookActionParametersSection
        action={action}
        parameters={parameters}
        parameterErrors={parameterErrors}
        globalVariables={globalVariables}
        onActionChange={onActionChange}
        t={t}
      />
      <RunbookActionLogFilterSection
        action={action}
        logFilterErrors={logFilterErrors}
        logFilterPreview={logFilterPreview}
        logFilterSample={logFilterSample}
        logFilterToggleText={logFilterToggleText}
        onActionChange={onActionChange}
        onLogFilterSampleChange={onLogFilterSampleChange}
        t={t}
      />
    </>
  );
}
