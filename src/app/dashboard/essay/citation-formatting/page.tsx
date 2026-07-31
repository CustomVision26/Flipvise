import { requireEssayAddonAccess } from "@/lib/essay-access";
import {
  listCitationFormattedEssaysForUser,
  listEssaysForCitationFormattingPool,
} from "@/db/queries/essays";
import { EssayCitationFormattingTabs } from "@/components/essay-citation-formatting-tabs";
import { toSubmittedEssayPoolItem } from "@/lib/essay-citation-formatting-pool";
import { normalizeDocumentStudioMeta } from "@/lib/document-generation-studio";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toClientJson } from "@/lib/to-client-json";

type CitationFormattingPageProps = {
  searchParams: Promise<{
    essayId?: string;
    edit?: string;
    tab?: string;
  }>;
};

export default async function EssayCitationFormattingPage({
  searchParams,
}: CitationFormattingPageProps) {
  const access = await requireEssayAddonAccess("page");
  const params = await searchParams;
  const rows = await listEssaysForCitationFormattingPool(access.userId);
  const essays = toClientJson(rows.map(toSubmittedEssayPoolItem));
  const formattedDocs = await listCitationFormattedEssaysForUser(access.userId);

  const submittedDocuments = toClientJson(
    formattedDocs.map((doc) => {
      const input = (doc.input ?? {}) as {
        documentStudio?: unknown;
        citationStyle?: "none" | "apa" | "mla" | "chicago" | "harvard";
      };
      const studio = normalizeDocumentStudioMeta(
        input.documentStudio,
        input.citationStyle ?? "none",
      );
      const style = studio.essayFormatting.citationStyle;
      return {
        id: doc.id,
        title: doc.title,
        subject: doc.subject,
        gradeLevel: doc.gradeLevel,
        essayType: doc.essayType,
        citationStyle: (style === "none" ? "apa" : style) as
          | "apa"
          | "mla"
          | "chicago"
          | "harvard",
        savedAt:
          studio.essayFormatting.formattedEssayPreview?.savedAt ??
          studio.essayFormatting.citationFormattedSavedAt,
      };
    }),
  );

  const parsedEssayId = Number(params.essayId);
  const initialEssayId =
    Number.isFinite(parsedEssayId) &&
    parsedEssayId > 0 &&
    essays.some((essay) => essay.documentId === parsedEssayId)
      ? parsedEssayId
      : null;
  const initialEditMode =
    initialEssayId != null &&
    (params.edit === "1" || params.edit === "true");

  const defaultTab =
    params.tab === "formatted" ||
    params.tab === "submit" ||
    params.tab === "citation-formatted"
      ? "formatted"
      : "format";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citation &amp; Formatting</CardTitle>
        <CardDescription>
          Use Format essay to apply citations, then manage finished papers under
          Formatted papers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EssayCitationFormattingTabs
          essays={essays}
          submittedDocuments={submittedDocuments}
          defaultTab={defaultTab}
          initialEssayId={initialEssayId}
          initialEditMode={initialEditMode}
        />
      </CardContent>
    </Card>
  );
}
