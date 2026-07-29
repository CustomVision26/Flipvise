import Link from "next/link";
import { requireEssayAddonAccess } from "@/lib/essay-access";
import { listEssayAssignmentsForUser } from "@/db/queries/essays";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function EssayAssignmentsPage() {
  const access = await requireEssayAddonAccess("page");
  const assignments = await listEssayAssignmentsForUser(access.userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Assigned Essays</CardTitle>
        <CardDescription>
          Assignments created by your Team Admin. Classroom workflows can expand later
          without changing this architecture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned essays yet.</p>
        ) : (
          assignments.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/essay/${a.documentId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-3 text-sm hover:bg-muted/40"
            >
              <div>
                <p className="font-medium">{a.documentTitle}</p>
                <p className="text-muted-foreground">{a.subject}</p>
              </div>
              <Badge variant="outline">{a.status}</Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
