"use client";

import * as React from "react";
import { useTransition } from "react";
import { Mic, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { setProUiThemeAction } from "@/actions/pro-ui-theme";
import {
  PRO_INTERFACE_BACKGROUND_COLOR_COUNT,
  PRO_PLUS_INTERFACE_BACKGROUND_COLOR_COUNT,
  proUiThemeOptionsForTier,
  type ProUiThemeId,
} from "@/lib/pro-ui-theme";
import {
  FREE_INTERFACE_BACKGROUND_COLOR_COUNT,
  FREE_UI_THEME_OPTIONS,
  type FreeUiThemeId,
} from "@/lib/free-ui-theme";
import { setFreeUiThemeAction } from "@/actions/free-ui-theme";
import { MicrophoneSettingsDialog } from "@/components/microphone-settings-dialog";

export interface UserAppearanceSettingsPageProps {
  currentProTheme?: ProUiThemeId;
  currentFreeTheme?: FreeUiThemeId;
  isPro?: boolean;
  /**
   * When true (Pro Plus, team tier, admin), full Pro palette (12 presets).
   * When false with `isPro`, Pro tier subset (8 presets).
   */
  hasProPlusInterfacePalette?: boolean;
}

export function UserAppearanceSettingsPage({
  currentProTheme = "neutral",
  currentFreeTheme = "neutral",
  isPro = false,
  hasProPlusInterfacePalette = false,
}: UserAppearanceSettingsPageProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const [micDialogOpen, setMicDialogOpen] = React.useState(false);

  const proInterfaceOptions = React.useMemo(
    () => proUiThemeOptionsForTier(hasProPlusInterfacePalette),
    [hasProPlusInterfacePalette],
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme =
    mounted && (theme === "light" || theme === "dark") ? theme : "dark";

  return (
    <div className="space-y-4 px-1 pb-4">
      <Card size="sm">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base">Theme mode</CardTitle>
          <CardDescription>
            Light or dark base theme for the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={activeTheme === "light" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setTheme("light")}
            >
              <Sun className="size-4 text-muted-foreground" aria-hidden />
              Light
            </Button>
            <Button
              type="button"
              variant={activeTheme === "dark" ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setTheme("dark")}
            >
              <Moon className="size-4 text-muted-foreground" aria-hidden />
              Dark
            </Button>
          </div>
        </CardContent>
      </Card>

      {isPro && (
        <Card size="sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">Interface background</CardTitle>
            <CardDescription>
              Accent for headers and surfaces (Pro).
              <span className="block text-xs text-muted-foreground mt-1">
                {hasProPlusInterfacePalette
                  ? `${PRO_PLUS_INTERFACE_BACKGROUND_COLOR_COUNT} interface color options on your plan (Pro Plus or higher).`
                  : `${PRO_INTERFACE_BACKGROUND_COLOR_COUNT} interface color options on your plan (Pro). Upgrade to Pro Plus for ${PRO_PLUS_INTERFACE_BACKGROUND_COLOR_COUNT}.`}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <Label htmlFor="pro-ui-theme" className="sr-only">
              Interface background
            </Label>
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
                id="pro-ui-theme"
                size="default"
                className="w-full max-w-sm"
                aria-label="Interface background"
              >
                <SelectValue placeholder="Choose a color" />
              </SelectTrigger>
              <SelectContent nestedInModal>
                {proInterfaceOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {!isPro && (
        <Card size="sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base">Interface color</CardTitle>
            <CardDescription>
              Accent tailored for the free tier ({FREE_INTERFACE_BACKGROUND_COLOR_COUNT} options). Pro
              and Pro Plus unlock more colors in Account → Appearance after you upgrade.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            <Label htmlFor="free-ui-theme" className="sr-only">
              Interface color
            </Label>
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
                id="free-ui-theme"
                size="default"
                className="w-full max-w-sm"
                aria-label="Interface color"
              >
                <SelectValue placeholder="Choose a color" />
              </SelectTrigger>
              <SelectContent nestedInModal>
                {FREE_UI_THEME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card size="sm">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base">Device</CardTitle>
          <CardDescription>
            Microphone access for study features (e.g. voice input).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setMicDialogOpen(true)}
          >
            <Mic className="size-4 text-muted-foreground" aria-hidden />
            Microphone settings
          </Button>
        </CardContent>
      </Card>

      <Separator className="opacity-60" />

      <MicrophoneSettingsDialog
        open={micDialogOpen}
        onOpenChange={setMicDialogOpen}
        nestedModal
      />
    </div>
  );
}
