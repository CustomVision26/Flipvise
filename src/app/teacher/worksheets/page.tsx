import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { TeacherWorksheetsForm } from "@/components/teacher-worksheets-form";

type TeacherWorksheetsPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherWorksheetsPage({
  searchParams,
}: TeacherWorksheetsPageProps) {
  const params = await searchParams;
  const { backHref } = await loadTeacherPageContext("/teacher/worksheets", params);

  return <TeacherWorksheetsForm backHref={backHref} />;
}
