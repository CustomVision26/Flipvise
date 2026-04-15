"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setFreeUiThemeAction } from "@/actions/free-ui-theme";
import {
  FREE_UI_THEME_OPTIONS,
  type FreeUiThemeId,
} from "@/lib/free-ui-theme";
import { cn } from "@/lib/utils";

interface ColorThemeSelectorProps {
  currentTheme?: FreeUiThemeId;
}

export function ColorThemeSelector({ currentTheme = "neutral" }: ColorThemeSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticTheme, setOptimisticTheme] = React.useState<FreeUiThemeId>(currentTheme);

  const handleThemeChange = (theme: FreeUiThemeId) => {
    setOptimisticTheme(theme);
    startTransition(async () => {
      try {
        await setFreeUiThemeAction({ theme });
        router.refresh();
      } catch (error) {
        setOptimisticTheme(currentTheme);
        console.error("Failed to update theme:", error);
      }
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Palette className="size-5 text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Interface Color
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Choose your preferred color theme
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {FREE_UI_THEME_OPTIONS.map((option) => {
            const isSelected = optimisticTheme === option.id;
            return (
              <Button
                key={option.id}
                variant="outline"
                disabled={isPending}
                onClick={() => handleThemeChange(option.id)}
                className={cn(
                  "relative h-auto flex flex-col items-center gap-2 p-3 transition-all",
                  isSelected && "border-primary ring-2 ring-primary/50"
                )}
              >
                <div
                  className={cn(
                    "w-full aspect-square rounded-md",
                    option.preview
                  )}
                />
                <span className="text-xs font-medium">{option.label}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                    <Check className="size-3" />
                  </div>
                )}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
