"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createAddonCheckoutSessionAction } from "@/actions/addons";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EssayUnlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPurchase: boolean;
  signedIn: boolean;
};

export function EssayUnlockDialog({
  open,
  onOpenChange,
  canPurchase,
  signedIn,
}: EssayUnlockDialogProps) {
  const router = useRouter();
  const [period, setPeriod] = React.useState<"monthly" | "yearly">("monthly");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handlePurchase() {
    setError(null);
    setPending(true);
    try {
      const result = await createAddonCheckoutSessionAction({
        addonKey: AI_ESSAY_ADDON_KEY,
        period,
      });
      if (result.mode === "attached") {
        onOpenChange(false);
        router.refresh();
        return;
      }
      router.push(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock AI Essay</DialogTitle>
          <DialogDescription>
            AI Essay is a premium add-on. Keep your current plan and add essay
            generation, drafts, and AI feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="essay-period">Billing period</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as "monthly" | "yearly")}
            >
              <SelectTrigger id="essay-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!signedIn ? (
            <p className="text-sm text-muted-foreground">
              Sign in from the homepage, then return to unlock this add-on.
            </p>
          ) : !canPurchase ? (
            <p className="text-sm text-muted-foreground">
              Your current plan is not eligible, or the Stripe price is not
              configured. Ask a Team Admin or platform admin for access, or
              upgrade to an eligible plan.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handlePurchase()}
            disabled={pending || !signedIn || !canPurchase}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Starting…
              </>
            ) : (
              "Unlock Feature"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
