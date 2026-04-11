"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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

interface ProUiThemeSelectProps {
  currentTheme: ProUiThemeId;
}

export function ProUiThemeSelect({ currentTheme }: ProUiThemeSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <Select
        value={currentTheme}
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
  );
}
