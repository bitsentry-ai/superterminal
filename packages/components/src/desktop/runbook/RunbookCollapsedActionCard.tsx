import type { ReactNode } from "react";

import { GripVertical, Trash2 } from "../../icons";
import { cn } from "../../lib/utils";
import type { RunbookActionType } from "../../services";

type RunbookCollapsedActionCardProps = {
  index: number;
  collapsedActionTitle: ReactNode;
  actionType: RunbookActionType;
  summary: string;
  isDragging: boolean;
  isDragSource: boolean;
  isDropTarget: boolean;
  onClick: () => void;
  onDelete: () => void;
  deleteTitle: string;
  renderTypeBadge: (type: RunbookActionType) => ReactNode;
};

export function RunbookCollapsedActionCard({
  index,
  collapsedActionTitle,
  actionType,
  summary,
  isDragging,
  isDragSource,
  isDropTarget,
  onClick,
  onDelete,
  deleteTitle,
  renderTypeBadge,
}: RunbookCollapsedActionCardProps) {
  let dataTour: string | undefined;
  if (index === 0) {
    dataTour = "runbooks-first-action";
  }

  return (
    <div
      data-tour={dataTour}
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer select-none items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-border/80 hover:bg-card/80",
        isDragging && "opacity-70",
        isDragSource && "border-primary/30 bg-primary/5 shadow-sm",
        isDropTarget &&
          !isDragSource &&
          "border-primary/50 ring-2 ring-primary/15 shadow-md",
      )}
    >
      <span className="shrink-0 cursor-grab text-muted-foreground/20 transition-colors group-hover:text-muted-foreground/40 active:cursor-grabbing">
        <GripVertical size={14} />
      </span>
      <span className="w-4 shrink-0 text-center text-[10px] font-mono tabular-nums text-muted-foreground/40">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {collapsedActionTitle}
          </span>
          {renderTypeBadge(actionType)}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {summary}
        </p>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title={deleteTitle}
        className="shrink-0 rounded p-1.5 text-muted-foreground/70 opacity-60 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
