import type { LucideIcon } from "lucide-react";
import { LegalLinks } from "@/components/legal-links";
import { PublicPageIntro } from "@/components/public-page-intro";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  cyan: {
    card: "border-cyan-400/30 ring-cyan-400/20",
    rule: "border-cyan-400/20",
    mark: "border-cyan-400/45 bg-cyan-500/15 text-cyan-800 shadow-cyan-400/25 dark:text-cyan-200",
  },
  teal: {
    card: "border-teal-400/30 ring-teal-400/20",
    rule: "border-teal-400/20",
    mark: "border-teal-400/45 bg-teal-500/15 text-teal-800 shadow-teal-400/25 dark:text-teal-200",
  },
  violet: {
    card: "border-violet-400/30 ring-violet-400/20",
    rule: "border-violet-400/20",
    mark: "border-violet-400/45 bg-violet-500/15 text-violet-800 shadow-violet-400/25 dark:text-violet-200",
  },
} as const;

export type LegalSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  body: React.ReactNode;
};

type LegalDocumentProps = {
  badge: string;
  title: string;
  description: string;
  sections: LegalSection[];
};

function sectionHref(id: string) {
  return `#${id}`;
}

export function LegalDocument({ badge, title, description, sections }: LegalDocumentProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PublicPageIntro badge={badge} title={title} description={description} />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={sectionHref(section.id)}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "border-cyan-400/30 bg-card/50 hover:bg-cyan-500/10",
            })}
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div className="grid gap-4">
        {sections.map((section, index) => {
          const tone = TONES[section.tone];
          const Icon = section.icon;
          return (
            <Card
              key={section.id}
              id={section.id}
              style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
              className={cn(
                "scroll-mt-24 overflow-hidden bg-card/70 shadow-none ring-1",
                "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500",
                tone.card,
              )}
            >
              <CardHeader className={cn("gap-3 border-b pb-4", tone.rule)}>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_16px]",
                      tone.mark,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <CardTitle>
                    <h2 className="font-heading text-base font-semibold">{section.title}</h2>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-foreground">
                {section.body}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LegalLinks className="justify-start border-t border-cyan-400/20 pt-4" />
    </div>
  );
}
