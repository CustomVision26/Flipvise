import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingReminderState } from "@/lib/billing-reminder-state";

export function BillingReminderBanner({
  reminder,
  className,
}: {
  reminder: BillingReminderState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b px-4 py-3 sm:px-6",
        reminder.urgent
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-primary/20 bg-primary/5",
        className,
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              reminder.urgent ? "text-amber-400" : "text-primary",
            )}
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-foreground">{reminder.title}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {reminder.description}
            </p>
          </div>
        </div>
        <Link
          href={reminder.ctaHref}
          className={cn(
            buttonVariants({
              size: "sm",
              variant: reminder.urgent ? "default" : "outline",
            }),
            "shrink-0",
          )}
        >
          {reminder.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
