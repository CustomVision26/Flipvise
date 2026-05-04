"use client";

import * as React from "react";
import { useTransition } from "react";
import { Settings, Moon, Sun, Mic } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setProUiThemeAction } from "@/actions/pro-ui-theme";
import {
  PRO_UI_THEME_OPTIONS,
  type ProUiThemeId,
} from "@/lib/pro-ui-theme";
import {
  FREE_UI_THEME_OPTIONS,
  type FreeUiThemeId,
} from "@/lib/free-ui-theme";
import { setFreeUiThemeAction } from "@/actions/free-ui-theme";
import { cn } from "@/lib/utils";
import { MicrophoneSettingsDialog } from "@/components/microphone-settings-dialog";

interface SettingsMenuProps {
  currentProTheme?: ProUiThemeId;
  currentFreeTheme?: FreeUiThemeId;
  isPro?: boolean;
  hasCustomColors?: boolean;
}

export function SettingsMenu({
  currentProTheme = "neutral",
  currentFreeTheme = "neutral",
  isPro = false,
  hasCustomColors = false,
}: SettingsMenuProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [micDialogOpen, setMicDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button
              {...props}
              variant="outline"
              size="icon"
              title="Settings"
              className={cn("shrink-0", props.className)}
              aria-label="Settings"
            >
              <Settings className="size-4" aria-hidden />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" className="min-w-[240px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-foreground">
              Theme Mode
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={
                mounted && (theme === "light" || theme === "dark")
                  ? theme
                  : "dark"
              }
              onValueChange={setTheme}
            >
              <DropdownMenuRadioItem value="light" className="gap-2">
                <Sun className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-foreground">Light</span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2">
                <Moon className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-foreground">Dark</span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>

          {isPro && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-foreground">
                  Interface Background
                  {hasCustomColors && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (12 colors)
                    </span>
                  )}
                </DropdownMenuLabel>
                <div className="px-2 py-1.5">
                  <Select
                    value={currentProTheme}
                    disabled={isPending}
                    onValueChange={(value) => {
                      startTransition(async () => {
                        await setProUiThemeAction({ theme: value as ProUiThemeId });
                        router.refresh();
                      });
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full"
                      aria-label="Interface background"
                    >
                      <SelectValue placeholder="Choose a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRO_UI_THEME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DropdownMenuGroup>
            </>
          )}

          {!isPro && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-foreground">
                  Interface Color
                </DropdownMenuLabel>
                <div className="px-2 py-1.5">
                  <Select
                    value={currentFreeTheme}
                    disabled={isPending}
                    onValueChange={(value) => {
                      startTransition(async () => {
                        await setFreeUiThemeAction({ theme: value as FreeUiThemeId });
                        router.refresh();
                      });
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="w-full"
                      aria-label="Interface color"
                    >
                      <SelectValue placeholder="Choose a color" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREE_UI_THEME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DropdownMenuGroup>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-foreground">Device</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setMicDialogOpen(true)}
              className="cursor-pointer gap-2"
            >
              <Mic className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-foreground">Microphone</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <MicrophoneSettingsDialog
        open={micDialogOpen}
        onOpenChange={setMicDialogOpen}
      />
    </>
  );
}
