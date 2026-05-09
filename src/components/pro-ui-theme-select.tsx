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
  proUiThemeOptionsForTier,
  type ProUiThemeId,
} from "@/lib/pro-ui-theme";

interface ProUiThemeSelectProps {
  currentTheme: ProUiThemeId;
  /** When false (personal Pro only), first 8 presets; when true, full 12. */
  hasProPlusInterfacePalette?: boolean;
}

export function ProUiThemeSelect({
  currentTheme,
  hasProPlusInterfacePalette = false,
}: ProUiThemeSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const options = proUiThemeOptionsForTier(hasProPlusInterfacePalette);

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
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
