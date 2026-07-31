import { requireEssayAddonAccess } from "@/lib/essay-access";
import { listEssayDocumentsForUser } from "@/db/queries/essays";
import { EssayCitedFormattedPool } from "@/components/essay-cited-formatted-pool";
import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import { normalizeDocumentStudioMeta } from "@/lib/document-generation-studio";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toClientJson } from "@/lib/to-client-json";

export default async function EssayAcademicIntegrityPage() {
  const access = await requireEssayAddonAccess("page");
  const docs = await listEssayDocumentsForUser(access.userId);

  const essays = toClientJson(
    docs
      .map((doc) => {
        const input = (doc.input ?? {}) as {
          documentStudio?: unknown;
          citationStyle?: EssayCitationStyle;
        };
        const studio = normalizeDocumentStudioMeta(
          input.documentStudio,
          input.citationStyle ?? "none",
        );
        const style = studio.essayFormatting.citationStyle;
        if (style === "none") return null;
        return {
          documentId: doc.id,
          title: doc.title,
          subject: doc.subject,
          gradeLevel: doc.gradeLevel,
          essayType: doc.essayType,
          citationStyle: style,
          updatedAt: doc.updatedAt.toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Academic Integrity</CardTitle>
        <CardDescription>
          Pool of saved essays that have been cited and formatted. Review before
          submission and verify originality against your institution’s policies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Plagiarism reminder</p>
          <p>
            This document should be reviewed before submission. Users are
            responsible for verifying originality and complying with
            institutional academic integrity policies.
          </p>
        </div>
        <EssayCitedFormattedPool essays={essays} />
      </CardContent>
    </Card>
  );
}
