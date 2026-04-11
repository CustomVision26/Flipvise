"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const triggerIcon =
    mounted && theme === "dark" ? (
      <Moon className="size-4" aria-hidden />
    ) : (
      <Sun className="size-4" aria-hidden />
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="icon"
            className={cn("shrink-0", props.className)}
            aria-label="Color mode"
            disabled={!mounted}
          >
            {triggerIcon}
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-foreground">
            Appearance
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
