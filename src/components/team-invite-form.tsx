"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { inviteTeamMemberAction } from "@/actions/teams";

export type TeamInviteWorkspaceOption = {
  id: number;
  name: string;
  /** True when members + pending invites are at the plan limit for this workspace. */
  atCapacity: boolean;
  /** Primary emails of accepted members (from Clerk), for the invite email picker. */
  acceptedMemberEmails: string[];
};

interface TeamInviteFormProps {
  /** Workspaces the current user may send invites for (all subscriber-owned teams, or only teams where they are co-admin). */
  workspaces: TeamInviteWorkspaceOption[];
  /**
   * When the viewer owns at least one listed workspace, the server passes every accepted member email
   * across those owned workspaces. Co-admins omit this and see only the selected workspace’s members.
   */
  aggregatedMemberEmailSuggestions?: string[];
  /** Initial workspace selection (usually matches the page “Select a team” control). */
  defaultWorkspaceId: number;
}

export function TeamInviteForm({
  workspaces,
  aggregatedMemberEmailSuggestions,
  defaultWorkspaceId,
}: TeamInviteFormProps) {
  const [teamId, setTeamId] = React.useState(String(defaultWorkspaceId));
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"team_admin" | "team_member">("team_member");
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [emailPickerOpen, setEmailPickerOpen] = React.useState(false);

  React.useEffect(() => {
    setTeamId(String(defaultWorkspaceId));
  }, [defaultWorkspaceId]);

  React.useEffect(() => {
    setEmailPickerOpen(false);
  }, [teamId]);

  const selectedWorkspace = workspaces.find((w) => w.id === Number(teamId));
  const selectedAtCapacity = selectedWorkspace?.atCapacity ?? false;
  const allAtCapacity = workspaces.length > 0 && workspaces.every((w) => w.atCapacity);
  const formDisabled = allAtCapacity || pending;
  const usesAggregatedMemberSuggestions = aggregatedMemberEmailSuggestions != null;
  const suggestionEmails = usesAggregatedMemberSuggestions
    ? aggregatedMemberEmailSuggestions
    : (selectedWorkspace?.acceptedMemberEmails ?? []);
  const emailFilter = email.trim().toLowerCase();
  const filteredMemberEmails = React.useMemo(() => {
    if (!emailFilter) return suggestionEmails;
    return suggestionEmails.filter((addr) => addr.toLowerCase().includes(emailFilter));
  }, [suggestionEmails, emailFilter]);

  const submitDisabled = formDisabled || selectedAtCapacity;
  const emailFilled = email.trim().length > 0;
  const disabledSubmitExplanation = React.useMemo(() => {
    if (!emailFilled) return null;
    if (pending) {
      return "Sending the invitation—please wait.";
    }
    if (allAtCapacity) {
      return "Every workspace you manage is at its member limit. Remove a member or cancel a pending invitation before creating another.";
    }
    if (selectedAtCapacity) {
      return "This workspace is at its member limit. Remove a member or cancel a pending invitation before sending another.";
    }
    return null;
  }, [emailFilled, pending, allAtCapacity, selectedAtCapacity]);
  const showSubmitTooltip = submitDisabled && disabledSubmitExplanation != null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    if (selectedAtCapacity) {
      setError("This workspace is at capacity. Remove a member or cancel a pending invite to send another.");
      return;
    }
    setPending(true);
    try {
      const res = await inviteTeamMemberAction({
        teamId: Number(teamId),
        email,
        role,
      });
      setInviteUrl(res.inviteUrl);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No workspaces available to send invitations from.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="team-invite-workspace">Workspace</Label>
        <Select
          value={teamId}
          onValueChange={(v) => v != null && setTeamId(v)}
          disabled={formDisabled}
          required
        >
          <SelectTrigger id="team-invite-workspace" className="w-full">
            <SelectValue placeholder="Select workspace">
              {(value) => {
                if (value == null) return "Select workspace";
                const w = workspaces.find((x) => String(x.id) === String(value));
                if (!w) return "Select workspace";
                return (
                  <span className="truncate">
                    {w.name}
                    {w.atCapacity ? " (at capacity)" : ""}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem
                key={w.id}
                value={String(w.id)}
                disabled={w.atCapacity}
              >
                <span className="truncate">
                  {w.name}
                  {w.atCapacity ? " (at capacity)" : ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-invite-email">Email</Label>
        <div className="flex max-w-md gap-2">
          <Input
            id="team-invite-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={formDisabled}
            placeholder="invitemember@gmail.com"
            className="min-w-0 flex-1"
          />
          <Popover open={emailPickerOpen} onOpenChange={setEmailPickerOpen}>
            <PopoverTrigger
              nativeButton
              render={(props) => (
                <Button
                  {...props}
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("shrink-0", props.className)}
                  disabled={formDisabled || suggestionEmails.length === 0}
                  aria-label="Choose from accepted member emails"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </Button>
              )}
            />
            <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
              <div className="border-b border-border px-2.5 py-2">
                <p className="text-muted-foreground text-xs leading-snug">
                  {usesAggregatedMemberSuggestions
                    ? "Accepted members from every workspace you own. Pick one or keep typing your own address."
                    : "Accepted members on this workspace. Pick one or keep typing your own address."}
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto p-1">
                {filteredMemberEmails.length === 0 ? (
                  <p className="text-muted-foreground px-2 py-2 text-xs">
                    {suggestionEmails.length === 0
                      ? "No member emails available yet."
                      : "No addresses match what you typed."}
                  </p>
                ) : (
                  filteredMemberEmails.map((addr) => (
                    <Button
                      key={addr}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start whitespace-normal break-all px-2 py-1.5 text-left font-normal text-sm"
                      onClick={() => {
                        setEmail(addr);
                        setEmailPickerOpen(false);
                      }}
                    >
                      {addr}
                    </Button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="team-invite-role">Role</Label>
        <Select
          value={role}
          onValueChange={(v) => setRole(v as "team_admin" | "team_member")}
          disabled={formDisabled}
          required
        >
          <SelectTrigger id="team-invite-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team_member">Member</SelectItem>
            <SelectItem value="team_admin">Team admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showSubmitTooltip ? (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex w-full max-w-md" tabIndex={0} />}>
            <Button type="submit" disabled={submitDisabled} className="w-full">
              {pending ? "Sending…" : "Create invitation"}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {disabledSubmitExplanation}
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button type="submit" disabled={submitDisabled} className="w-full max-w-md">
          {pending ? "Sending…" : "Create invitation"}
        </Button>
      )}
      {allAtCapacity && (
        <p className="text-sm text-muted-foreground">
          Every workspace you manage is at its member limit. Remove a member or cancel a pending
          invitation to send more invites.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {inviteUrl && (
        <Alert>
          <AlertTitle>Invitation link</AlertTitle>
          <AlertDescription className="break-all font-mono text-xs">
            {inviteUrl}
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
