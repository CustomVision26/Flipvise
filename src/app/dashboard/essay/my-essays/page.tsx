import { requireEssayAddonAccess } from "@/lib/essay-access";
import { listEssayDocumentsForUser } from "@/db/queries/essays";
import { EssayDocumentsList } from "@/components/essay-documents-list";
import { toClientJson } from "@/lib/to-client-json";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function MyEssaysPage() {
  const access = await requireEssayAddonAccess("page");
  const docs = await listEssayDocumentsForUser(access.userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Essays</CardTitle>
        <CardDescription>
          Your generated essays. Apply citation formatting under Citation &amp;
          Formatting, then manage finished papers on Formatted papers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EssayDocumentsList
          documents={toClientJson(
            docs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              subject: doc.subject,
              gradeLevel: doc.gradeLevel,
              essayType: doc.essayType,
            })),
          )}
        />
      </CardContent>
    </Card>
  );
}
