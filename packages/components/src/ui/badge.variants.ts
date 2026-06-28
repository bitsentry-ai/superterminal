import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "bg-muted text-muted-foreground border-border",
        destructive:
          "border-[hsl(var(--destructive)/0.2)] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]",
        outline: "border-input bg-transparent text-foreground",
        accent:
          "border-[hsl(var(--brand-emphasis-border))] bg-[hsl(var(--brand-emphasis-surface))] text-[hsl(var(--brand-emphasis))]",
        success:
          "border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
        critical:
          "border-transparent bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
        info: "border-transparent bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
