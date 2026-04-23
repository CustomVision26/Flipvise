"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { acceptTeamInvitationAction } from "@/actions/teams";

function clerkTeamInviteOpenSignInProps(inviteEmail: string, token: string) {
  const postAuthReturnPath = `/invite/team/${token}?post_auth=1`;
  return {
    initialValues: { emailAddress: inviteEmail },
    forceRedirectUrl: postAuthReturnPath,
    signUpForceRedirectUrl: postAuthReturnPath,
    withSignUp: true,
  };
}

function inviteeEmailMatchesUser(
  user: NonNullable<ReturnType<typeof useUser>["user"]>,
  inviteEmail: string,
) {
  const want = inviteEmail.trim().toLowerCase();
  const emails = new Set<string>();
  const add = (e: string | undefined) => {
    if (e) emails.add(e.trim().toLowerCase());
  };
  add(user.primaryEmailAddress?.emailAddress);
  for (const row of user.emailAddresses ?? []) {
    add(row.emailAddress);
  }
  return emails.has(want);
}

function AcceptTeamInviteButtonInner({
  token,
  inviteEmail,
}: {
  token: string;
  inviteEmail: string;
}) {
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut, openSignIn } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const postAuthStarted = React.useRef(false);
  const reauthOpened = React.useRef(false);

  const runAcceptAndRedirect = React.useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const result = await acceptTeamInvitationAction({ token });
      router.replace(result.redirectUrl);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not accept invitation";
      if (
        /already a member/i.test(msg) ||
        /not found/i.test(msg) ||
        /expired/i.test(msg)
      ) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      postAuthStarted.current = false;
      setError(msg);
      router.replace(`/invite/team/${token}`, { scroll: false });
    } finally {
      setPending(false);
    }
  }, [router, token]);

  React.useEffect(() => {
    if (!userLoaded || !user) return;
    if (searchParams.get("post_auth") !== "1") return;
    if (postAuthStarted.current) return;
    postAuthStarted.current = true;
    void runAcceptAndRedirect();
  }, [user, userLoaded, searchParams, runAcceptAndRedirect]);

  React.useEffect(() => {
    if (!userLoaded || user) return;
    if (searchParams.get("reauth") !== "1") return;
    if (reauthOpened.current) return;
    reauthOpened.current = true;
    openSignIn(clerkTeamInviteOpenSignInProps(inviteEmail, token));
    router.replace(`/invite/team/${token}`, { scroll: false });
  }, [user, userLoaded, searchParams, openSignIn, inviteEmail, token, router]);

  async function onAcceptCorrectUser() {
    setError(null);
    await runAcceptAndRedirect();
  }

  async function onWrongUserAccept() {
    setError(null);
    setPending(true);
    try {
      const origin = window.location.origin;
      await signOut({ redirectUrl: `${origin}/invite/team/${token}?reauth=1` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out");
      setPending(false);
    }
  }

  function onOpenSignIn() {
    setError(null);
    openSignIn(clerkTeamInviteOpenSignInProps(inviteEmail, token));
  }

  if (!userLoaded) {
    return (
      <div className="w-full max-w-xs">
        <Button type="button" className="w-full" disabled>
          Loading…
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-xs space-y-2">
        <Button type="button" className="w-full" onClick={onOpenSignIn}>
          Accept and join team
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!inviteeEmailMatchesUser(user, inviteEmail)) {
    return (
      <div className="space-y-2 w-full max-w-xs">
        <Button
          type="button"
          className="w-full"
          onClick={() => void onWrongUserAccept()}
          disabled={pending}
        >
          {pending ? "Signing out…" : "Accept and join team"}
        </Button>
        <p className="text-xs text-muted-foreground">
          You are signed in as a different account. Continue to sign out and sign in with{" "}
          <span className="font-mono text-foreground">{inviteEmail}</span>.
        </p>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full max-w-xs">
      <Button
        type="button"
        className="w-full"
        onClick={() => void onAcceptCorrectUser()}
        disabled={pending}
      >
        {pending ? "Joining…" : "Accept and join team"}
      </Button>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AcceptTeamInviteButton({
  token,
  inviteEmail,
}: {
  token: string;
  inviteEmail: string;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-xs">
          <Button type="button" className="w-full" disabled>
            Loading…
          </Button>
        </div>
      }
    >
      <AcceptTeamInviteButtonInner token={token} inviteEmail={inviteEmail} />
    </Suspense>
  );
}
