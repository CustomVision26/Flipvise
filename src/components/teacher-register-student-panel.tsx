"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTeacherRegisteredStudentAction,
  registerTeacherStudentAction,
} from "@/actions/teacher-registered-students";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import type { TeacherRegisteredStudentWithClass } from "@/db/queries/teacher-registered-students";
import {
  teacherClassDisplayTitle,
  teacherClassSubjectLabel,
} from "@/lib/teacher-class-links";
import { cn } from "@/lib/utils";

const CLASS_NONE = "__none__";

type TeacherRegisterStudentPanelProps = {
  students: TeacherRegisteredStudentWithClass[];
  classes: TeacherClassWithDeck[];
};

function formatAssignedClass(student: TeacherRegisteredStudentWithClass): string {
  if (student.classId == null || !student.classPeriod || !student.classDeckName) {
    return "—";
  }
  return `${student.classPeriod} — ${student.classDeckName}`;
}

export function TeacherRegisterStudentPanel({
  students: initialStudents,
  classes,
}: TeacherRegisterStudentPanelProps) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [classId, setClassId] = useState(CLASS_NONE);

  const classOptions = useMemo(
    () =>
      classes.map((cls) => ({
        id: String(cls.id),
        label: teacherClassDisplayTitle(cls),
        subject: teacherClassSubjectLabel(cls),
        term: `${cls.termSemester} · ${cls.academicYear}`,
      })),
    [classes],
  );

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (classes.length > 0 && classId === CLASS_NONE) {
      toast.error("Select a class for this student.");
      return;
    }

    setIsPending(true);
    try {
      const saved = await registerTeacherStudentAction({
        fullName,
        email,
        telephone,
        ...(classId !== CLASS_NONE ? { classId: Number(classId) } : {}),
      });
      setFullName("");
      setEmail("");
      setTelephone("");
      setClassId(CLASS_NONE);
      setShowForm(false);
      toast.success("Student registered", {
        description: `${saved.fullName} was added to your roster.`,
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not register student.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(studentId: number) {
    setDeletingId(studentId);
    try {
      await deleteTeacherRegisteredStudentAction(studentId);
      setStudents((current) => current.filter((student) => student.id !== studentId));
      toast.success("Student removed from roster.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove student.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Registering a student</CardTitle>
            <CardDescription>
              Education Plus teachers maintain a personal student roster with contact
              details and a single class assignment per student.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-2"
            onClick={() => setShowForm((open) => !open)}
          >
            <UserPlus className="size-4" aria-hidden />
            {showForm ? "Hide form" : "Register student"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:grid-cols-2"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="register-student-full-name">Full name</Label>
              <Input
                id="register-student-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jordan Williams"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-student-email">Email</Label>
              <Input
                id="register-student-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@school.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-student-telephone">Telephone</Label>
              <Input
                id="register-student-telephone"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="e.g. (876) 555-0123"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="register-student-class">Class</Label>
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a class first on the{" "}
                  <Link href="/teacher/classes" className="text-primary underline-offset-4 hover:underline">
                    Classes
                  </Link>{" "}
                  page, then assign each student to one class here.
                </p>
              ) : (
                <Select
                  value={classId}
                  onValueChange={(value) => setClassId(value ?? CLASS_NONE)}
                >
                  <SelectTrigger id="register-student-class" className="w-full">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} · {option.subject} · {option.term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Each student can be assigned to only one class.
              </p>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Save student
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {students.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No registered students yet. Click <strong>Register student</strong> to add
            full name, email, telephone, and class.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Full name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telephone</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium">{student.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{student.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {student.telephone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatAssignedClass(student)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === student.id}
                        onClick={() => void handleDelete(student.id)}
                      >
                        {deletingId === student.id ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="size-4" aria-hidden />
                        )}
                        <span className="sr-only">Remove {student.fullName}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
