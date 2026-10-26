import { z } from "zod";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { HomeAuthActions } from "@/components/home-auth-actions";
import { HomeBackground } from "@/components/home-background";
import { AppTopNav } from "@/components/app-top-nav";
import { buttonVariants } from "@/components/ui/button-variants";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeHomeSignOutGuard } from "@/components/native-home-sign-out-guard";

function parseInviteEmailFromSearchParams(inviteEmail: unknown): string | null {
  const raw =
    typeof inviteEmail === "string"
      ? inviteEmail
      : Array.isArray(inviteEmail)
        ? inviteEmail[0]
        : undefined;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = z.string().email().safeParse(raw.trim());
  return parsed.success ? parsed.data : null;
}

const FEATURES = [
  {
    artwork: "/artwork/home/ai-generation.png",
    title: "AI Generation",
    description: "Generate flashcards instantly from any topic.",
  },
  {
    artwork: "/artwork/home/smart-study.png",
    title: "Smart Study",
    description: "Flashcards, quizzes, and progress tracking.",
  },
  {
    artwork: "/artwork/home/team-learning.png",
    title: "Team Learning",
    description: "Invite members and share deck libraries.",
  },
] as const;

interface HomePageProps {
  searchParams: Promise<{ invite_email?: string | string[] }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const access = await getAccessContext();
  if (access.userId) {
    redirect(
      personalDashboardHrefWithUserPlanQuery({
        userId: access.userId,
        activeTeamPlan: access.activeTeamPlan,
        isPro: access.isPro,
        hasClerkPersonalPro: access.hasClerkPersonalPro,
        hasClerkPersonalProPlus: access.hasClerkPersonalProPlus,
      }),
    );
  }
  const sp = await searchParams;
  const inviteEmailForAuth = parseInviteEmailFromSearchParams(sp.invite_email);

  return (
    <>
      <NativeHomeSignOutGuard />
      <div className="home-page relative flex min-h-screen flex-1 flex-col">
        <div className="relative z-30">
          <div className="mx-auto flex max-w-7xl justify-center px-4 py-3 sm:px-6">
            <AppTopNav homeHref="/" />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <HomeBackground />

        <div className="relative z-20 flex w-full max-w-3xl flex-col items-center gap-8">
          <Card className="home-hero-card w-full max-w-xl shadow-none ring-0">
            <CardHeader className="w-full items-center justify-items-center gap-4 pb-0 text-center">
              <div className="flex w-full justify-center">
                <Image
                  src={LOGO_PUBLIC_URL}
                  alt="Flipvise"
                  width={200}
                  height={75}
                  className="mx-auto block h-auto w-36 object-contain sm:w-44"
                  style={{ width: "auto", height: "auto" }}
                  unoptimized
                  priority
                />
              </div>
              <div className="flex w-full flex-col items-center gap-2">
                <CardTitle className="home-hero-title text-center text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  Master Any Subject with Smart
                  <br />
                  Flashcards
                </CardTitle>
                <CardDescription className="home-hero-copy max-w-md text-center text-sm leading-relaxed sm:text-base">
                  Create, study, and collaborate — powered by AI to make learning
                  effortless.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-5 pt-6">
              <HomeAuthActions inviteEmail={inviteEmailForAuth} />

              <Link
                href="/docs"
                className={buttonVariants({
                  variant: "outline",
                  className: "home-docs-link",
                })}
              >
                <BookOpen className="size-4" aria-hidden />
                Read the user documentation
              </Link>

              <p className="home-tagline text-xs font-semibold uppercase tracking-[0.35em]">
                Flip. Learn. Master.
              </p>
            </CardContent>
          </Card>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {FEATURES.map(({ artwork, title, description }) => (
              <Card key={title} size="sm" className="home-feature-card shadow-none ring-0">
                <CardContent className="flex flex-col items-center gap-3 text-center">
                  <Image
                    src={artwork}
                    alt=""
                    width={160}
                    height={160}
                    className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                    unoptimized
                  />
                  <div className="min-w-0">
                    <p className="home-feature-title text-sm font-semibold">{title}</p>
                    <p className="home-feature-copy mt-1 text-xs leading-relaxed">
                      {description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
