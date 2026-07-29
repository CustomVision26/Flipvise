import Link from "next/link";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import { listEssayDocumentsForUser } from "@/db/queries/essays";
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
        <CardDescription>Essays you have generated.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No essays yet.{" "}
            <Link href="/dashboard/essay/generate" className="underline">
              Generate one
            </Link>
            .
          </p>
        ) : (
          docs.map((doc) => (
            <Link
              key={doc.id}
              href={`/dashboard/essay/${doc.id}`}
              className="block rounded-md border border-border/60 px-3 py-3 text-sm hover:bg-muted/40"
            >
              <p className="font-medium">{doc.title}</p>
              <p className="text-muted-foreground">
                {doc.subject} · {doc.gradeLevel} · {doc.essayType.replace(/_/g, " ")}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
