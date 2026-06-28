import { cn } from "../lib/utils";
import { useTranslation } from "@bitsentry-ce/i18n";

interface ContextIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  contextTokens?: number;
  contextLimit?: number;
  usageUnavailable?: boolean;
  className?: string;
}

function formatK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${String(Math.round(n / 1_000))}k`;
  return String(n);
}

function formatVerbose(n: number): string {
  return n.toLocaleString();
}

export function ContextIndicator({
  inputTokens,
  outputTokens,
  contextTokens,
  contextLimit,
  usageUnavailable = false,
  className,
}: ContextIndicatorProps) {
  const { t } = useTranslation();
  const requestTotal = inputTokens + outputTokens;
  const total = contextTokens ?? requestTotal;
  if (total === 0 && requestTotal === 0 && contextLimit === undefined) return null;

  let usageRatio: number | null = null;
  if (!usageUnavailable && contextLimit !== undefined && contextLimit > 0) {
    usageRatio = total / contextLimit;
  }
  const isNearLimit = usageRatio !== null && usageRatio > 0.8;
  const isOverLimit = usageRatio !== null && usageRatio > 1;
  let percentage = 0;
  if (usageRatio !== null) {
    percentage = Math.min(usageRatio, 1) * 100;
  }
  let displayValue = formatK(total);
  if (usageUnavailable && contextLimit !== undefined) {
    displayValue = "?";
  } else if (usageRatio !== null) {
    displayValue = String(Math.round(usageRatio * 100));
  }
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  let ringClass = "stroke-muted-foreground/60";
  if (isNearLimit) {
    ringClass = "stroke-amber-500";
  }
  if (isOverLimit) {
    ringClass = "stroke-destructive";
  }

  let textClass = "text-muted-foreground/70";
  if (isNearLimit) {
    textClass = "text-amber-600 dark:text-amber-400";
  }
  if (isOverLimit) {
    textClass = "text-destructive";
  }

  let contextPercentage = 0;
  if (contextLimit !== undefined && contextLimit > 0) {
    contextPercentage = Math.round((total / contextLimit) * 100);
  }

  let progressCircle: React.ReactNode = null;
  if (contextLimit !== undefined) {
    progressCircle = (
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className={cn("transition-[stroke-dashoffset] duration-300", ringClass)}
      />
    );
  }

  let title = t("common.contextIndicator.inputOutput", {
    input: formatVerbose(inputTokens),
    output: formatVerbose(outputTokens),
  });

  if (contextLimit !== undefined && usageUnavailable) {
    title = t("common.contextIndicator.contextLimitUsageUnavailable", {
      limit: formatVerbose(contextLimit),
    });
  } else if (contextLimit !== undefined && contextTokens !== undefined) {
    title = t("common.contextIndicator.contextWithRequest", {
      total: formatVerbose(total),
      limit: formatVerbose(contextLimit),
      percentage: contextPercentage,
      input: formatVerbose(inputTokens),
      output: formatVerbose(outputTokens),
    });
  } else if (contextLimit !== undefined) {
    title = t("common.contextIndicator.contextWithInputOutput", {
      total: formatVerbose(total),
      limit: formatVerbose(contextLimit),
      percentage: contextPercentage,
      input: formatVerbose(inputTokens),
      output: formatVerbose(outputTokens),
    });
  }

  return (
    <div
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center rounded-full",
        "bg-background/70 backdrop-blur-sm",
        textClass,
        className,
      )}
      title={title}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/25"
        />
        {progressCircle}
      </svg>
      <span className="absolute font-mono text-[13px] font-medium tabular-nums leading-none">
        {displayValue}
      </span>
    </div>
  );
}
