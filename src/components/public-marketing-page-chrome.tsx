"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppTopNav } from "@/components/app-top-nav";
import { ForceDarkTheme } from "@/components/force-dark-theme";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type PublicMarketingPageChromeProps = {
  homeHref: string;
  isSignedIn: boolean;
  children: React.ReactNode;
};

export function PublicMarketingPageChrome({
  homeHref,
  isSignedIn,
  children,
}: PublicMarketingPageChromeProps) {
  return (
    <ForceDarkTheme>
      <div className="min-h-screen bg-gradient-to-b from-muted/10 via-background to-background">
        <header className="border-b border-border/50 bg-card/20 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 justify-start sm:justify-center">
              {!isSignedIn ? (
                <AppTopNav homeHref={homeHref} />
              ) : (
                <p className="text-sm font-medium text-muted-foreground">Flipvise Help</p>
              )}
            </div>
            <Link
              href={homeHref}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "shrink-0 gap-1.5 text-muted-foreground hover:text-foreground",
              )}
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">
                {isSignedIn ? "Back to Dashboard" : "Back to Home"}
              </span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          {children}
        </main>
      </div>
    </ForceDarkTheme>
  );
}
