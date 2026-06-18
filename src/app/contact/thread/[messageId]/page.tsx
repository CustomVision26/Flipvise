import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadContactUsThreadPageAction } from "@/actions/contact-us";
import { ContactUsThreadCloseButton } from "@/components/contact-us-thread-close-button";
import { UserContactUsThreadPanel } from "@/components/user-contact-us-thread-panel";
import { PublicMarketingPageChrome } from "@/components/public-marketing-page-chrome";
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <CardTitle className="text-xl font-semibold">Contact conversation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Chat with the Flipvise team about{" "}
                  <span className="text-foreground">{thread.subject}</span>. New replies appear
                  automatically every few seconds.
                </p>
              </div>
              <ContactUsThreadCloseButton
                messageId={messageId}
                accessToken={token}
                iconOnly
                className="mt-0.5"
              />
            </div>
          </CardHeader>
          <CardContent className="flex max-h-[min(70dvh,640px)] min-h-[280px] flex-col overflow-hidden pt-5">
            <UserContactUsThreadPanel
              messageId={messageId}
              accessToken={token}
              initialThread={thread}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-2">
          <ContactUsThreadCloseButton messageId={messageId} accessToken={token} />
          <p className="text-center text-xs text-muted-foreground">
            Closing marks this issue as resolved. Support can reopen it if you need more help.
          </p>
        </div>
      </div>
    </PublicMarketingPageChrome>
  );
}
