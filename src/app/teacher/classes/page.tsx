import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";

const PLACEHOLDER_CLASSES = [
  {
    name: "Period 1 — Algebra I",
    subject: "Math",
    gradeLevel: "9th",
    students: 28,
  },
  {
    name: "Period 3 — US History",
    subject: "Social Studies",
    gradeLevel: "8th",
    students: 24,
  },
  {
    name: "Period 5 — Biology",
    subject: "Science",
    gradeLevel: "10th",
    students: 26,
  },
];

type TeacherClassesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherClassesPage({
  searchParams,
}: TeacherClassesPageProps) {
  const params = await searchParams;
  const { backHref } = await loadTeacherPageContext("/teacher/classes", params);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
            <p className="text-sm text-muted-foreground">
              Decks linked to classes used for lesson plan generation.
            </p>
          </div>
        </div>
        <Button>Create class</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLACEHOLDER_CLASSES.map((cls) => (
          <Card key={cls.name} className="border-border/80 bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">{cls.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>Subject: {cls.subject}</p>
              <p>Grade level: {cls.gradeLevel}</p>
              <p>Students: {cls.students}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
