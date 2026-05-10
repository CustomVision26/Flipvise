import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getAffiliateByArrangementChangeToken,
  getAffiliateById,
} from "@/db/queries/affiliates";
import { acceptAffiliateArrangementChangeAction } from "@/actions/affiliates";
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
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";

function planLabel(slug: string): string {
  return displayNameForBillingPlanSlug(slug);
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

export default async function AffiliateConfirmArrangementPage({
  searchParams,
}: Props) {
  const now = new Date();
  const { token } = await searchParams;

  if (!token) {
    return (
      <Result
        icon="error"
        title="Invalid Link"
        message="This confirmation link is missing a token. Please use the link from your email or inbox."
      />
    );
  }

  const affiliate = await getAffiliateByArrangementChangeToken(token);

  if (!affiliate) {
    return (
      <Result
        icon="error"
        title="Link Invalid"
        message="This confirmation link is invalid or was already used. Open your inbox or ask your affiliate contact for help."
      />
    );
  }

  if (
    affiliate.status !== "active" ||
    !affiliate.pendingPlanAssigned ||
    !affiliate.pendingEndsAt ||
    !affiliate.arrangementChangeExpiresAt
  ) {
    return (
      <Result
        icon="error"
        title="Nothing To Confirm"
        message="There is no pending arrangement change for this link."
      />
    );
  }

  if (affiliate.arrangementChangeExpiresAt.getTime() < now.getTime()) {
    return (
      <Result
        icon="error"
        title="Link Expired"
        message={`Confirmation links expire for security (this one ended ${formatDate(affiliate.arrangementChangeExpiresAt)}). Ask your affiliate manager for an updated arrangement proposal.`}
      />
    );
  }

  const { userId } = await auth();

  if (!userId) {
    const returnUrl = `/affiliate/confirm-arrangement?token=${token}`;
    redirect(`/?redirect_url=${encodeURIComponent(returnUrl)}`);
  }

  let confirmError: string | null = null;
  try {
    await acceptAffiliateArrangementChangeAction({ token });
  } catch (err) {
    confirmError =
      err instanceof Error ? err.message : "Could not confirm this arrangement";
  }

  if (confirmError) {
    const isEmailMismatch = confirmError.includes("different email");
    const session = await currentUser();
    const signedInEmail = session?.primaryEmailAddress?.emailAddress ?? "";

    return (
      <Result
        icon="error"
        title={isEmailMismatch ? "Wrong Account" : "Could Not Confirm"}
        message={
          isEmailMismatch
            ? `You're signed in as ${signedInEmail}, but this update was addressed to ${affiliate.invitedEmail}. Please switch accounts.`
            : confirmError
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

  const refreshed = await getAffiliateById(affiliate.id);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="rounded-full bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Arrangement Updated</CardTitle>
          <CardDescription>
            Your marketing affiliate plan and end date are now updated on your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium text-right">{affiliate.affiliateName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Plan</span>
              <Badge variant="secondary">{planLabel(refreshed?.planAssigned ?? affiliate.pendingPlanAssigned)}</Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Access until</span>
              <span className="font-medium flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {formatDate(refreshed?.endsAt ?? affiliate.pendingEndsAt)}
              </span>
            </div>
          </div>
          <Link href="/dashboard/inbox" className={buttonVariants({ variant: "outline" }) + " w-full justify-center"}>
            Back to inbox
          </Link>
          <Link href="/dashboard" className={buttonVariants() + " w-full justify-center"}>
            Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

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
