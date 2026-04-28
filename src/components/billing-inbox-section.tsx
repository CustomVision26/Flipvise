import { createClerkClient } from "@clerk/backend";
import { listBillingInvoicesForUser } from "@/db/queries/billing";
import { upsertBillingInvoicesFromSubscription } from "@/db/queries/billing";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { billingActivePlanSlug } from "@/lib/plan-metadata-billing-resolution";
import { ManageBillingButton } from "@/components/manage-billing-button";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const normalizedCurrency = (currency ?? "USD").toUpperCase();
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${normalizedCurrency}`;
  }
}

export async function BillingInboxSection({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string | null;
}) {
  try {
    const subscription = await clerkClient.billing.getUserBillingSubscription(userId);
    const subscriptionAny = subscription as unknown as Record<string, unknown>;
    const rawInvoices = Array.isArray(subscriptionAny.invoices)
      ? subscriptionAny.invoices
      : [];
    await upsertBillingInvoicesFromSubscription(
      userId,
      userEmail,
      billingActivePlanSlug(subscription) ?? null,
      rawInvoices as Parameters<typeof upsertBillingInvoicesFromSubscription>[3],
    );
  } catch {
    // Best effort: keep inbox working even when billing API sync is unavailable.
  }

  const [rows, activeSub] = await Promise.all([
    listBillingInvoicesForUser(userId, userEmail),
    getActiveStripeSubscription(userId),
  ]);

  const hasActiveSubscription = activeSub !== null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Billing receipts</CardTitle>
            <CardDescription>
              Payment confirmations and invoice history for your plan upgrades.
            </CardDescription>
          </div>
          {hasActiveSubscription && (
            <ManageBillingButton
              label="Manage subscription"
              variant="outline"
              size="sm"
              className="shrink-0"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No billing receipts yet.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.externalId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {row.invoiceNumber ?? row.externalId}
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {row.status}
                  </Badge>
                </div>
                {/* Subtotal + tax breakdown */}
                {row.taxAmountCents != null && row.taxAmountCents > 0 ? (
                  <div className="space-y-0.5">
                    <p className="text-sm text-muted-foreground">
                      Subtotal: {formatAmount(row.subtotalCents, row.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tax: {formatAmount(row.taxAmountCents, row.currency)}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      Total: {formatAmount(row.amountCents, row.currency)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {formatAmount(row.amountCents, row.currency)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDate(row.paidAt ?? row.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.hostedInvoiceUrl ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={row.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        >
                          Open
                        </a>
                      }
                    />
                    <TooltipContent>View invoice in your browser</TooltipContent>
                  </Tooltip>
                ) : null}
                {row.invoicePdfUrl ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <a
                          href={row.invoicePdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(buttonVariants({ size: "sm" }))}
                        >
                          PDF
                        </a>
                      }
                    />
                    <TooltipContent>Download invoice as PDF</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
