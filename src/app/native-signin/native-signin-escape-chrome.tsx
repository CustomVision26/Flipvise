"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigateToOfflineShellFast } from "@/lib/offline/is-flipvise-native-app";

const NATIVE_BTN_CLASS =
  "min-h-11 w-full touch-manipulation active:scale-[0.98] transition-transform";

export function NativeSignInEscapeChrome() {
  return (
    <>
      <div
        className="fixed left-0 top-0 z-[200] p-3 pt-[calc(0.75rem+var(--flipvise-safe-top,48px))]"
        aria-label="Sign-in recovery"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 border-border/50 bg-background/90 touch-manipulation transition-transform active:scale-[0.98]"
                  aria-label="Try again"
                  onClick={() => {
                    window.location.href = "/api/auth/clear-stale-session";
                  }}
                />
              }
            >
              <RefreshCw className="size-5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Clear a stuck session and try signing in again</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <nav
        id="native-signin-escape"
        aria-label="Return to offline study"
        className="fixed inset-x-0 bottom-0 z-[200] border-t border-border/40 bg-background/95 p-4 pb-[calc(1rem+var(--flipvise-safe-bottom,16px))]"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={`${NATIVE_BTN_CLASS} border-border/50 bg-background/30`}
                  onClick={() => {
                    navigateToOfflineShellFast();
                  }}
                />
              }
            >
              Back to offline study
            </TooltipTrigger>
            <TooltipContent>Leave sign-in and return to offline study</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </nav>
    </>
  );
}
