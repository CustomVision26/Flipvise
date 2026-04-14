"use client";

import * as React from "react";
import { useTransition } from "react";
import { Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import { cn } from "@/lib/utils";

interface SettingsMenuProps {
  currentUiTheme?: ProUiThemeId;
}

export function SettingsMenu({ currentUiTheme = "neutral" }: SettingsMenuProps) {
  const { theme, setTheme } = useTheme();
  const { has } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  const isPaidPro = has?.({ plan: "pro" }) ?? false;
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const adminGranted = meta?.adminGranted === true;
  const isAdmin = meta?.role === "admin";
  const isPro = isPaidPro || adminGranted || isAdmin;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="icon"
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
              </DropdownMenuLabel>
              <div className="px-2 py-1.5">
                <Select
                  value={currentUiTheme}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
