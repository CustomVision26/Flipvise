"use client";

import { useEffect, useState } from "react";
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
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherRegisteredStudentRow } from "@/db/schema";
import { cn } from "@/lib/utils";

type TeacherRegisterStudentPanelProps = {
  students: TeacherRegisteredStudentRow[];
};

export function TeacherRegisterStudentPanel({
  students: initialStudents,
}: TeacherRegisterStudentPanelProps) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");

  useEffect(() => {
    setStudents(initialStudents);
  }, [initialStudents]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsPending(true);
    try {
      const saved = await registerTeacherStudentAction({ fullName, email, telephone });
      setFullName("");
      setEmail("");
      setTelephone("");
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
              details for classroom follow-up.
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
            full name, email, and telephone.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Full name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Telephone</th>
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
