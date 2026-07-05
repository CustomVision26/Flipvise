import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";

const PLACEHOLDER_STUDENTS = [
  {
    name: "Ava Martinez",
    className: "Period 1 — Algebra I",
    averageQuizScore: 88,
    completedAssignments: 12,
    weakTopics: ["Factoring"],
    lastActivity: "2 hours ago",
  },
  {
    name: "Jordan Lee",
    className: "Period 3 — US History",
    averageQuizScore: 76,
    completedAssignments: 9,
    weakTopics: ["Reconstruction", "Primary sources"],
    lastActivity: "Yesterday",
  },
  {
    name: "Sam Patel",
    className: "Period 5 — Biology",
    averageQuizScore: 92,
    completedAssignments: 14,
    weakTopics: ["Cell division"],
    lastActivity: "Today",
  },
];

type TeacherStudentsPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherStudentsPage({
  searchParams,
}: TeacherStudentsPageProps) {
  const params = await searchParams;
  const { backHref } = await loadTeacherPageContext("/teacher/students", params);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Progress</h1>
          <p className="text-sm text-muted-foreground">
            Track quiz performance, assignments, and topics needing support.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PLACEHOLDER_STUDENTS.map((student) => (
          <Card key={student.name} className="border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{student.name}</CardTitle>
                <Badge variant="secondary">{student.lastActivity}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{student.className}</p>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                <span className="font-medium text-foreground">Avg quiz score: </span>
                {student.averageQuizScore}%
              </p>
              <p>
                <span className="font-medium text-foreground">Completed assignments: </span>
                {student.completedAssignments}
              </p>
              <p className="sm:col-span-2">
                <span className="font-medium text-foreground">Weak topics: </span>
                {student.weakTopics.join(", ")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
