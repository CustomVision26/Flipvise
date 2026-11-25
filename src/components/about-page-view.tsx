import Image from "next/image";
import Link from "next/link";
import {
  Accessibility,
  BookOpen,
  Brain,
  Building2,
  FileText,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Lightbulb,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AboutFaqList, AboutReleaseNotesDialog } from "@/components/about-page-interactive";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import {
  ABOUT_FEATURE_LABELS,
  publicAboutFeatures,
  publicAboutLeaders,
  publishedReleaseNotes,
  type AboutPageContent,
} from "@/lib/about-page-content";
import type { AppReleaseMetadata } from "@/lib/app-release-metadata";
import { cn } from "@/lib/utils";

const VALUE_ICONS: Record<string, LucideIcon> = {
  innovation: Lightbulb,
  accessibility: Accessibility,
  collaboration: Handshake,
  integrity: ShieldCheck,
  "continuous-improvement": Sparkles,
  "user-focused": HeartHandshake,
};

const FEATURE_ICONS: Record<string, LucideIcon> = {
  "smart-flashcards": BookOpen,
  "ai-content": Sparkles,
  "standard-review": BookOpen,
  "ai-recall": Brain,
  quizzes: GraduationCap,
  "exam-mode": ShieldCheck,
  "teacher-studio": FileText,
  "student-progress": Users,
  "team-workspaces": Building2,
  "live-classroom": Users,
  "document-studio": FileText,
  "cross-platform": MonitorSmartphone,
};

const AUDIENCE_ICONS: Record<string, LucideIcon> = {
  students: GraduationCap,
  teachers: BookOpen,
  parents: HeartHandshake,
  institutions: Building2,
  organizations: Building2,
  independent: Lightbulb,
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}

export function AboutPageView({
  content,
  release,
  signedIn,
  dashboardHref,
  previewing,
}: {
  content: AboutPageContent;
  release: AppReleaseMetadata;
  signedIn: boolean;
  dashboardHref: string;
  previewing: boolean;
}) {
  const features = publicAboutFeatures(content);
  const leaders = publicAboutLeaders(content);
  const notes = publishedReleaseNotes(content);

  return (
    <div className="flex flex-col gap-16 motion-reduce:transition-none sm:gap-20">
      {previewing ? (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground" role="status">
          Draft preview. Visitors see the published page until you publish this version.
        </p>
      ) : null}

      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {content.heroEyebrow}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            {content.heroHeading}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            {content.heroDescription}
          </p>
          <p className="text-sm font-medium text-foreground">{content.heroSlogan}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/docs" className={buttonVariants()}>
              Explore Flipvise
            </Link>
            <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
              View Plans
            </Link>
            <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
              Contact Us
            </Link>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4">
          <Image
            src={LOGO_PUBLIC_URL}
            alt="Flipvise logo"
            width={160}
            height={156}
            className="h-auto w-28 bg-transparent object-contain sm:w-36"
            priority
          />
          <Image
            src="/artwork/home/docs-owl.png"
            alt="Flipvise owl mascot"
            width={220}
            height={220}
            className="h-auto w-36 object-contain sm:w-44"
          />
        </div>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{content.whoHeading}</h2>
        {content.whoParagraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: content.missionTitle, body: content.missionBody, icon: Target },
            { title: content.visionTitle, body: content.visionBody, icon: Sparkles },
            { title: content.commitmentTitle, body: content.commitmentBody, icon: HeartHandshake },
          ].map((item) => (
            <Card key={item.title} className="bg-card text-card-foreground">
              <CardHeader>
                <item.icon className="size-5 text-primary" aria-hidden />
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {content.values.map((value) => {
            const Icon = VALUE_ICONS[value.id] ?? Sparkles;
            return (
              <Card key={value.id} className="bg-card text-card-foreground">
                <CardHeader className="pb-2">
                  <Icon className="size-4 text-primary" aria-hidden />
                  <CardTitle className="text-base">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{value.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{content.storyHeading}</h2>
        {content.storyParagraphs.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {paragraph}
          </p>
        ))}
      </section>

      {leaders.length > 0 ? (
      <section className="flex flex-col gap-6">
        <SectionHeading
          title="Meet Our Leadership Team"
          description="Behind Flipvise is a leadership team focused on innovation, technology, operational development and the continuous improvement of the educational experience."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {leaders.map((leader) => (
            <Card key={leader.id} className="bg-card text-card-foreground">
              <CardHeader className="items-center text-center">
                {leader.photoUrl ? (
                  <Image
                    src={leader.photoUrl}
                    alt={`Portrait of ${leader.name}`}
                    width={96}
                    height={96}
                    className="size-24 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-24 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground"
                    aria-hidden
                  >
                    {leader.initials}
                  </span>
                )}
                <CardTitle>{leader.name}</CardTitle>
                <CardDescription>{leader.position}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-center">
                <p className="text-sm leading-relaxed text-muted-foreground">{leader.bio}</p>
                <div className="flex flex-wrap justify-center gap-3 text-sm">
                  {leader.linkedInUrl ? (
                    <a
                      href={leader.linkedInUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      LinkedIn
                    </a>
                  ) : null}
                  {leader.contactUrl ? (
                    <a
                      href={leader.contactUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Contact
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      ) : null}

      <section className="flex flex-col gap-6">
        <SectionHeading title={content.featuresHeading} description={content.featuresDescription} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = FEATURE_ICONS[feature.id] ?? Sparkles;
            return (
              <Card key={feature.id} className="bg-card text-card-foreground">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <Badge variant={feature.availability === "available" ? "secondary" : "outline"}>
                      {ABOUT_FEATURE_LABELS[feature.availability]}
                    </Badge>
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title={content.audiencesHeading} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.audiences.map((audience) => {
            const Icon = AUDIENCE_ICONS[audience.id] ?? Users;
            return (
              <Card key={audience.id} className="bg-card text-card-foreground">
                <CardHeader>
                  <Icon className="size-5 text-primary" aria-hidden />
                  <CardTitle className="text-base">{audience.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{audience.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">{content.aiHeading}</h2>
          {content.aiParagraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {paragraph}
            </p>
          ))}
          <p className="flex flex-wrap gap-3 text-sm">
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            <Link href="/ai" className="text-primary underline-offset-4 hover:underline">
              AI data handling
            </Link>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {content.aiCards.map((card) => (
            <Card key={card.id} className="bg-card text-card-foreground">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading
          title="Flipvise Version & Release Information"
          description="Stay informed about the current Flipvise application release, platform improvements and newly introduced capabilities."
        />
        <Card className="bg-card text-card-foreground">
          <CardHeader>
            <CardTitle>{release.name}</CardTitle>
            <CardDescription>Publisher: {release.publisher}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              {release.platforms.map((platform) => (
                <div key={platform.platform} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-semibold text-foreground">{platform.platform}</p>
                  {platform.version ? (
                    <p className="mt-1 text-sm text-muted-foreground">Version {platform.version}</p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Version unavailable</p>
                  )}
                  {platform.build ? (
                    <p className="text-sm text-muted-foreground">Build {platform.build}</p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{platform.availability}</p>
                  {platform.storeUrl ? (
                    <a
                      href={platform.storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm text-primary underline-offset-4 hover:underline"
                    >
                      View store listing
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            <AboutReleaseNotesDialog notes={notes} />
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Release information will be available as new updates are published.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title="Frequently Asked Questions" />
        <AboutFaqList faqs={content.faqs} />
      </section>

      <section className="flex flex-col gap-6">
        <SectionHeading title={content.connectHeading} description={content.connectBody} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {content.contactActions.map((action) => (
            <Link key={action.id} href={action.href} className="block">
              <Card className="h-full bg-card text-card-foreground transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-card-foreground">
        <h2 className="text-2xl font-bold tracking-tight">{content.ctaHeading}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {content.ctaDescription}
        </p>
        <div className={cn("mt-6 flex flex-wrap justify-center gap-2")}>
          <Link href={signedIn ? dashboardHref : "/"} className={buttonVariants()}>
            {signedIn ? "Go to Dashboard" : "Get Started"}
          </Link>
          <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
            Explore Subscription Plans
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
            Contact Our Team
          </Link>
        </div>
      </section>
    </div>
  );
}
