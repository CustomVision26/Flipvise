"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Something went wrong</h1>
        <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto">
          An unexpected error occurred. We&apos;ve been notified and are working on a fix.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-1">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
          <Home className="h-4 w-4" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
