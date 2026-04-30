import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, Mail, Shield, ArrowLeft } from "lucide-react";
import { getInvitationByToken, getTeamById } from "@/db/queries/teams";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isTeamInviteExpired } from "@/lib/team-invite-expiry";
import { auth } from "@/lib/clerk-auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-full max-w-sm flex flex-col items-center gap-5 rounded-2xl border bg-card shadow-md p-8">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
          <Users className="h-8 w-8 text-primary" />
        </div>

        {/* Title and details */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">You&apos;re invited!</h1>
          <p className="text-muted-foreground text-sm">
            Join{" "}
            <span className="text-foreground font-semibold">{team.name}</span>
          </p>
          <Badge
            variant="outline"
            className="gap-1.5 mt-1"
          >
            {inv.role === "team_admin" ? (
              <>
                <Shield className="h-3 w-3 text-primary" />
                Team Admin
              </>
            ) : (
              <>
                <Users className="h-3 w-3 text-muted-foreground" />
                Member
              </>
            )}
          </Badge>
        </div>

        {/* Email hint */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground w-full justify-center">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span>
            Sign in as <span className="font-mono text-foreground">{inv.email}</span> to accept
          </span>
        </div>

        <AcceptTeamInviteButton token={token} inviteEmail={inv.email} />
      </div>

      <Link
        href={backHref}
        className={buttonVariants({ variant: "ghost", size: "sm" }) + " gap-2"}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </Link>
    </div>
  );
}
