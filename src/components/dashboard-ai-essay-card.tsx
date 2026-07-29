"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, PenLine } from "lucide-react";
import { EssayUnlockDialog } from "@/components/essay-unlock-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type DashboardAiEssayCardProps = {
  unlocked: boolean;
  canPurchase: boolean;
  signedIn: boolean;
};

export function DashboardAiEssayCard({
  unlocked,
  canPurchase,
  signedIn,
}: DashboardAiEssayCardProps) {
  const [unlockOpen, setUnlockOpen] = React.useState(false);

  if (unlocked) {
    return (
      <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PenLine className="size-4 text-primary" />
            <CardTitle className="text-base">AI Essay</CardTitle>
            <Badge variant="secondary" className="text-[10px] uppercase">
              Add-on
            </Badge>
          </div>
          <CardDescription>Create Essay · My Essays · Drafts · Assignments</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/essay/generate"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Create Essay
          </Link>
          <Link
            href="/dashboard/essay/my-essays"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            My Essays
          </Link>
          <Link
            href="/dashboard/essay/drafts"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Drafts
          </Link>
          <Link
            href="/dashboard/essay/assignments"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Assignments
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className="cursor-pointer border-border/70 bg-card/80 backdrop-blur-sm transition-colors hover:border-primary/40"
        onClick={() => setUnlockOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setUnlockOpen(true);
          }
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PenLine className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">AI Essay</CardTitle>
          </div>
          <CardDescription>Generate AI Essay Activities</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" />
            Premium Add-on
          </Badge>
          <Button
            size="sm"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUnlockOpen(true);
            }}
          >
            Unlock Feature
          </Button>
        </CardContent>
      </Card>
      <EssayUnlockDialog
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        canPurchase={canPurchase}
        signedIn={signedIn}
      />
    </>
  );
}
