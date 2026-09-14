"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { TeamWorkspaceInfo } from "@/lib/workspace-creation-profile";

function DetailField({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function TeamWorkspaceInfoButton({ info }: { info: TeamWorkspaceInfo }) {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}
      >
        <Info className="size-3.5" aria-hidden />
        Info
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle>Workspace info</DialogTitle>
          <DialogDescription>
            Details for this team workspace.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-4">
          <DetailField label="Workspace name">{info.name}</DetailField>
          <DetailField label="Plan">{info.planLabel}</DetailField>
          <DetailField label="Owner">{info.ownerDisplayName}</DetailField>
          <DetailField label="Created">{info.createdAtLabel}</DetailField>
          <DetailField label="Status">{info.statusLabel}</DetailField>
          {info.extraRows.map((row) => (
            <DetailField key={row.label} label={row.label}>
              {row.value}
            </DetailField>
          ))}
          {info.setupRows.length > 0 ? (
            <>
              <Separator />
              {info.setupRows.map((row) => (
                <DetailField key={row.label} label={row.label}>
                  {row.value}
                </DetailField>
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Setup details were not saved for this workspace.
            </p>
          )}
        </dl>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
