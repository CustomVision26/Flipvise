import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getAffiliateByToken } from "@/db/queries/affiliates";
import { acceptAffiliateInviteAction } from "@/actions/affiliates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Megaphone } from "lucide-react";

function planLabel(slug: string): string {
  if (slug === "pro") return "Pro";
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AffiliateAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  // No token provided
  if (!token) {
    return <Result icon="error" title="Invalid Link" message="This affiliate invite link is missing a token. Please use the link from your email or inbox." />;
  }

  const affiliate = await getAffiliateByToken(token);

  // Token not found
  if (!affiliate) {
    return <Result icon="error" title="Invite Not Found" message="This invite link is invalid or has already been used. Please contact your affiliate manager." />;
  }

  // Already accepted
  if (affiliate.status === "active") {
    return (
      <Result
        icon="success"
        title="Already Accepted"
        message={`This affiliate invite was already accepted${affiliate.inviteAcceptedAt ? " on " + formatDate(affiliate.inviteAcceptedAt) : ""}. Your ${planLabel(affiliate.planAssigned)} plan access is active.`}
        action={<Link href="/dashboard" className={buttonVariants()}>Go to Dashboard</Link>}
      />
    );
  }

  // Revoked or cancelled
  if (affiliate.status === "revoked") {
    return <Result icon="error" title="Invite Cancelled" message="This affiliate invite has been cancelled or revoked. Please contact your affiliate manager for assistance." />;
  }

  // Invite has expired
  if (new Date(affiliate.endsAt) < new Date()) {
    return <Result icon="error" title="Invite Expired" message="This affiliate invite has passed its end date. Please request a new invite." />;
  }

  // Check authentication
  const { userId } = await auth();

  if (!userId) {
    // Redirect to sign-in then back here
    const returnUrl = `/affiliate/accept?token=${token}`;
    redirect(`/?redirect_url=${encodeURIComponent(returnUrl)}`);
  }

  // Attempt acceptance server-side
  let acceptError: string | null = null;
  try {
    await acceptAffiliateInviteAction({ token });
  } catch (err) {
    acceptError = err instanceof Error ? err.message : "Failed to accept invite";
  }

  if (acceptError) {
    // Wrong email mismatch — tell the user
    const isEmailMismatch = acceptError.includes("different email");
    const session = await currentUser();
    const signedInEmail = session?.primaryEmailAddress?.emailAddress ?? "";

    return (
      <Result
        icon="error"
        title={isEmailMismatch ? "Wrong Account" : "Could Not Accept"}
        message={
          isEmailMismatch
            ? `You're signed in as ${signedInEmail}, but this invite was sent to ${affiliate.invitedEmail}. Please sign in with the correct account.`
            : acceptError
        }
        action={
          isEmailMismatch ? (
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Sign in with a different account
            </Link>
          ) : undefined
        }
      />
    );
  }

  // ✅ Success
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome, Affiliate!</CardTitle>
          <CardDescription>
            You have successfully joined the Flipvise affiliate programme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{affiliate.affiliateName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan activated</span>
              <Badge variant="secondary">{planLabel(affiliate.planAssigned)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valid until</span>
              <span className="font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(affiliate.endsAt)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Your plan has been activated on your account. You can start using all
            its features right away.
          </p>
          <Link href="/dashboard" className={buttonVariants() + " w-full justify-center"}>
            Go to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shared result card ──────────────────────────────────────────────────────────

function Result({
  icon,
  title,
  message,
  action,
}: {
  icon: "success" | "error" | "pending";
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const Icon =
    icon === "success" ? CheckCircle2 : icon === "error" ? XCircle : Megaphone;
  const iconColor =
    icon === "success"
      ? "text-emerald-500"
      : icon === "error"
        ? "text-destructive"
        : "text-primary";
  const bgColor =
    icon === "success"
      ? "bg-emerald-500/10"
      : icon === "error"
        ? "bg-destructive/10"
        : "bg-primary/10";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className={`rounded-full p-4 ${bgColor}`}>
              <Icon className={`h-10 w-10 ${iconColor}`} />
            </div>
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {action && (
          <CardContent className="flex justify-center">{action}</CardContent>
        )}
      </Card>
    </div>
  );
}
