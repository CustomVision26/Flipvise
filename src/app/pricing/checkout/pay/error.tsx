"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CheckoutPayErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pricing/checkout/pay]", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment page could not load
        </h1>
        <p className="text-sm text-muted-foreground">
          The checkout session was created, but Stripe.js could not start. Confirm
          Render has <span className="font-mono">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</span>{" "}
          set to the live <span className="font-mono">pk_live_</span> key that
          matches <span className="font-mono">STRIPE_SECRET_KEY</span>, then start
          checkout again.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button type="button" className="gap-2" onClick={reset}>
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
        <Link
          href="/pricing/checkout"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to checkout
        </Link>
      </div>
    </div>
  );
}
