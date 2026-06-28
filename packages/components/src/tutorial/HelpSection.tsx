import React, { useCallback, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { getTours, type TourId } from "./tour-definitions";
import { useTour, resetTourProgress, isTourCompleted } from "./useTour";
import { useTranslation } from "@bitsentry-ce/i18n";

interface TourRowProps {
  tourId: TourId;
  navigate?: (path: string) => void;
  onStarted: () => void;
}

const TourRow: React.FC<TourRowProps> = ({ tourId, navigate, onStarted }) => {
  const { t } = useTranslation();
  const { start } = useTour(tourId);
  const tour = getTours(t)[tourId];
  const completed = isTourCompleted(tourId);

  const handleClick = useCallback(() => {
    if (completed) {
      resetTourProgress(tourId);
    }
    onStarted();
    // start() handles: onBeforeStart → navigate → delay → drive
    void start({ force: true, navigate });
  }, [completed, tourId, navigate, start, onStarted]);

  let actionIcon = <Play size={14} />;
  let actionLabel = t("common.helpSection.start");
  if (completed) {
    actionIcon = <RotateCcw size={14} />;
    actionLabel = t("common.helpSection.replay");
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <h3 className="text-sm font-medium text-foreground">{tour.label}</h3>
        <p className="text-xs text-muted-foreground">{tour.description}</p>
      </div>

      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        {actionIcon}
        {actionLabel}
      </button>
    </div>
  );
};

interface HelpSectionProps {
  /** Router navigate function — needed for page-specific tours. */
  navigate?: (path: string) => void;
  excludedTourIds?: TourId[];
}

// Display order is decoupled from the tours record so reordering this list
// doesn't require touching tour-definitions, and adding a new tour doesn't
// silently slot it in wherever Object.keys happens to put it.
const TOUR_ORDER: readonly TourId[] = [
  "main",
  "settings",
  "incidents",
  "runbooks",
  "runbookCreation",
  "dataSources",
  "results",
  "dashboard",
];

export const HelpSection: React.FC<HelpSectionProps> = ({
  navigate,
  excludedTourIds = [],
}) => {
  const [, forceRender] = useState(0);
  const excludedTourIdSet = new Set(excludedTourIds);

  const handleStarted = useCallback(() => {
    // Re-render to update completed state after a brief delay
    window.setTimeout(() => { forceRender((n) => n + 1); }, 800);
  }, []);

  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {TOUR_ORDER.filter((tourId) => !excludedTourIdSet.has(tourId)).map(
        (tourId) => (
        <TourRow
          key={tourId}
          tourId={tourId}
          navigate={navigate}
          onStarted={handleStarted}
        />
        ),
      )}
    </div>
  );
};
