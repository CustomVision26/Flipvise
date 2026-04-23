import { notFound } from "next/navigation";
import Link from "next/link";
import { getInvitationByToken, getTeamById } from "@/db/queries/teams";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isTeamInviteExpired } from "@/lib/team-invite-expiry";
import { auth } from "@/lib/clerk-auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { AcceptTeamInviteButton } from "@/components/accept-team-invite-button";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TeamInvitePage({ params }: PageProps) {
  const { userId } = await auth();
  const { token } = await params;
  const inv = await tryTeamQuery(() => getInvitationByToken(token), null);
  if (!inv || inv.status !== "pending") {
    notFound();
  }
  if (isTeamInviteExpired(inv.expiresAt)) {
    notFound();
  }

  const team = await getTeamById(inv.teamId);
  if (!team) notFound();

  const backHref = userId
    ? "/dashboard"
    : `/?invite_email=${encodeURIComponent(inv.email)}`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 max-w-md mx-auto text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Team invitation</h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ve been invited to join{" "}
          <span className="text-foreground font-medium">{team.name}</span> as{" "}
          <span className="text-foreground">{inv.role === "team_admin" ? "a team admin" : "a member"}</span>
          .
        </p>
        <p className="text-muted-foreground text-xs">
          Sign in with <span className="text-foreground font-mono">{inv.email}</span> to accept.
        </p>
      </div>
      <AcceptTeamInviteButton token={token} inviteEmail={inv.email} />
      <Link
        href={backHref}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Back to home
      </Link>
    </div>
  );
}
