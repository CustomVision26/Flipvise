import Link from "next/link";
import { FileText, Lock, Sparkles } from "lucide-react";
import { getAccessContext, canAccessAddon } from "@/lib/access";
import {
  DOCUMENT_STUDIO_TITLE,
  DOCUMENT_STUDIO_TYPES,
} from "@/lib/document-generation-studio";
import { AI_ESSAY_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { canAccessAiEssayInStudio } from "@/lib/ai-document-studio-access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function AiDocumentStudioHubPage() {
  const access = await getAccessContext();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Premium add-on
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {DOCUMENT_STUDIO_TITLE}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Write and edit academic documents with AI. Each document type is its
            own add-on — unlock more types as they become available.
          </p>
        </div>
        <Badge variant="secondary">Studio</Badge>
      </header>

      <section className="space-y-3" aria-labelledby="ai-doc-types">
        <h2
          id="ai-doc-types"
          className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          Document types
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_STUDIO_TYPES.map((type) => {
            const entitled =
              type.addonKey != null &&
              (type.addonKey === AI_ESSAY_ADDON_KEY
                ? canAccessAiEssayInStudio(access)
                : canAccessAddon(access, type.addonKey));
            const openHref =
              type.enabled && entitled && type.href
                ? type.id === "essay"
                  ? AI_ESSAY_STUDIO_BASE
                  : type.href
                : null;

            return (
              <li key={type.id}>
                <Card
                  className={cn(
                    "h-full border-border/70 bg-card/80",
                    !type.enabled && "opacity-75",
                  )}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      {type.enabled && entitled ? (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <Sparkles className="size-3" aria-hidden />
                          Open
                        </Badge>
                      ) : type.enabled ? (
                        <Badge variant="outline" className="shrink-0 gap-1">
                          <Lock className="size-3" aria-hidden />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{type.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {openHref ? (
                      <Link
                        href={openHref}
                        className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                      >
                        <FileText className="size-3.5" aria-hidden />
                        Open {type.label}
                      </Link>
                    ) : type.enabled ? (
                      <Link
                        href="/pricing/add-ons"
                        className={cn(
                          buttonVariants({ size: "sm", variant: "outline" }),
                        )}
                      >
                        Unlock add-on
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This document type will unlock as a separate add-on.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
