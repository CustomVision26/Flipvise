"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppTopNav } from "@/components/app-top-nav";
import { PublicPageAtmosphere } from "@/components/public-page-atmosphere";
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
    <div className="dark relative min-h-full w-full">
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-cyan-950/20 via-background to-background">
        <PublicPageAtmosphere />
        <header className="relative z-10 border-b border-cyan-400/20 bg-card/30 shadow-[0_8px_40px] shadow-cyan-500/5 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
            <div className="flex min-w-0 justify-start sm:justify-center">
              {!isSignedIn ? (
                <AppTopNav homeHref={homeHref} />
              ) : (
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
                  Flipvise Help
                </p>
              )}
            </div>
            <Link
              href={homeHref}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "shrink-0 gap-1.5 text-muted-foreground hover:text-cyan-300",
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

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          {children}
        </main>
      </div>
    </div>
  );
}
