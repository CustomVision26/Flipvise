"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setTeamMemberAddonAction } from "@/actions/addons";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type TeamAddonMemberRow = {
  userId: string;
  displayName: string;
  email: string | null;
  roleLabel: string;
  hasAiEssay: boolean;
  entitlementSource: "stripe" | "admin" | "team" | null;
};

type TeamAdminAddonsPanelProps = {
  teamId: number;
  members: TeamAddonMemberRow[];
};

export function TeamAdminAddonsPanel({ teamId, members }: TeamAdminAddonsPanelProps) {
  const router = useRouter();
  const [pendingUserId, setPendingUserId] = React.useState<string | null>(null);

  async function toggleAiEssay(member: TeamAddonMemberRow, enabled: boolean) {
    if (
      member.entitlementSource === "stripe" ||
      member.entitlementSource === "admin"
    ) {
      toast.error(
        "This member already has AI Essay from purchase or platform admin. You cannot change it here.",
      );
      return;
    }
    setPendingUserId(member.userId);
    try {
      await setTeamMemberAddonAction({
        teamId,
        memberUserId: member.userId,
        addonKey: AI_ESSAY_ADDON_KEY,
        enabled,
      });
      toast.success(enabled ? "AI Essay assigned" : "AI Essay removed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update add-on");
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add-ons</CardTitle>
        <CardDescription>
          Assign optional premium features to members. Future add-ons appear here without a
          separate admin system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border/60 p-3">
          <p className="mb-3 text-sm font-medium">Assigned Features</p>
          <ul className="space-y-3">
            {members.map((member) => {
              const lockedSource =
                member.entitlementSource === "stripe" ||
                member.entitlementSource === "admin";
              const pending = pendingUserId === member.userId;
              return (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.roleLabel}
                      {member.email ? ` · ${member.email}` : ""}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    <Checkbox
                      checked={member.hasAiEssay}
                      disabled={pending || lockedSource}
                      onCheckedChange={(v) =>
                        void toggleAiEssay(member, v === true)
                      }
                    />
                    AI Essay
                    {lockedSource ? (
                      <Badge variant="outline" className="text-[10px]">
                        {member.entitlementSource}
                      </Badge>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Organization add-on (purchased by the subscription owner via Pricing): Live
            Classroom™. Coming soon (same member permission model): AI Recall · Battle
            Mode · Presentation Generator · Math Diagram Generator
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
