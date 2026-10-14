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
import { ForceDarkTheme } from "@/components/force-dark-theme";
import { NativeHomeSignOutGuard } from "@/components/native-home-sign-out-guard";
import { Brain, Sparkles, Users } from "lucide-react";

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
    icon: Sparkles,
    title: "AI Generation",
    description: "Generate flashcards instantly from any topic",
  },
  {
    icon: Brain,
    title: "Smart Study",
    description: "Flashcards, quizzes, and progress tracking",
  },
  {
    icon: Users,
    title: "Team Learning",
    description: "Invite members and share deck libraries",
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
    <ForceDarkTheme>
      <NativeHomeSignOutGuard />
      <div className="relative flex min-h-screen flex-1 flex-col">
        <div className="relative z-30 border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl justify-center px-4 py-3 sm:px-6">
            <AppTopNav homeHref="/" />
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <HomeBackground />

        <div className="relative z-20 flex w-full max-w-2xl flex-col items-center gap-8">
          <Card className="w-full max-w-lg border border-white/15 bg-transparent shadow-none ring-0 backdrop-blur-md">
            <CardHeader className="w-full items-center justify-items-center gap-4 pb-0 text-center">
              <div className="flex w-full justify-center">
                <Image
                  src={LOGO_PUBLIC_URL}
                  alt="Flipvise"
                  width={200}
                  height={75}
                  className="mx-auto block h-auto w-36 object-contain sm:w-44"
                  style={{ height: "auto" }}
                  unoptimized
                  priority
                />
              </div>
              <div className="flex w-full flex-col items-center gap-2">
                <CardTitle className="text-center text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                  Master Any Subject with Smart
                  <br />
                  Flashcards
                </CardTitle>
                <CardDescription className="max-w-sm text-center text-sm leading-relaxed sm:text-base">
                  Create, study, and collaborate — powered by AI to make learning
                  effortless.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-6 pt-6">
              <HomeAuthActions inviteEmail={inviteEmailForAuth} />

              <Link
                href="/docs"
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className:
                    "gap-1.5 border-white/20 bg-white/5 text-foreground hover:bg-white/10",
                })}
              >
                <BookOpen className="size-3.5" aria-hidden />
                Read the user documentation
              </Link>

              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Flip. Learn. Master.
              </p>
            </CardContent>
          </Card>

          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                size="sm"
                className="border border-white/10 bg-transparent shadow-none ring-0 backdrop-blur-sm"
              >
                <CardContent className="flex flex-row items-start gap-3 sm:flex-col sm:items-center sm:text-center">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
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
    </ForceDarkTheme>
  );
}
