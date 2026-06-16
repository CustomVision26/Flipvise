import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContactUsThreadPageAction } from "@/actions/contact-us";
import { UserContactUsThreadPanel } from "@/components/user-contact-us-thread-panel";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resolvePublicPageHomeContext } from "@/lib/public-page-home-context";

export const metadata: Metadata = {
  title: "Contact conversation",
  description: "Continue your Contact Us conversation with the Flipvise support team.",
};

type PageProps = {
  params: Promise<{ messageId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ContactUsThreadPage({ params, searchParams }: PageProps) {
  const [{ messageId: messageIdRaw }, sp, { homeHref, isSignedIn }] = await Promise.all([
    params,
    searchParams,
    resolvePublicPageHomeContext(),
  ]);

  const messageId = Number(messageIdRaw);
  if (!Number.isFinite(messageId) || messageId <= 0) notFound();

  const tokenRaw = sp.token;
  const token =
    typeof tokenRaw === "string"
      ? tokenRaw
      : Array.isArray(tokenRaw)
        ? tokenRaw[0]
        : undefined;

  const thread = await loadContactUsThreadPageAction({ messageId, token });
  if (!thread) notFound();

  return (
    <PublicMarketingPageChrome homeHref={homeHref} isSignedIn={isSignedIn}>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Card className="border-border/60 bg-card/40 shadow-none ring-1 ring-border/30">
          <CardHeader className="gap-2 border-b border-border/40 pb-4">
            <CardTitle className="text-xl font-semibold">Contact conversation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Chat with the Flipvise team about <span className="text-foreground">{thread.subject}</span>.
              New replies appear automatically every few seconds.
            </p>
          </CardHeader>
          <CardContent className="pt-5">
            <UserContactUsThreadPanel
              messageId={messageId}
              accessToken={token}
              initialThread={thread}
            />
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link href="/contact" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to Contact Us
          </Link>
        </div>
      </div>
    </PublicMarketingPageChrome>
  );
}
