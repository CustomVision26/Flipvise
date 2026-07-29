import Link from "next/link";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import { listEssayDraftsForUser } from "@/db/queries/essays";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function EssayDraftsPage() {
  const access = await requireEssayAddonAccess("page");
  const drafts = await listEssayDraftsForUser(access.userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drafts</CardTitle>
        <CardDescription>Continue unfinished essays.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open drafts.</p>
        ) : (
          drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/dashboard/essay/${draft.documentId}`}
              className="block rounded-md border border-border/60 px-3 py-3 text-sm hover:bg-muted/40"
            >
              <p className="font-medium">{draft.documentTitle}</p>
              <p className="text-muted-foreground">{draft.wordCount} words</p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
