"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTeacherRegisteredStudentAction,
  registerTeacherStudentAction,
  registerWorkspaceInviteeStudentAction,
  updateTeacherRegisteredStudentAction,
} from "@/actions/teacher-registered-students";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { WorkspaceStudentInvitee } from "@/db/queries/teacher-workspace-student-invitees";
import {
  teacherClassDisplayTitle,
  teacherClassSubjectLabel,
  buildTeacherClassDisplayTitle,
} from "@/lib/teacher-class-links";
import { cn } from "@/lib/utils";

const CLASS_NONE = "__none__";
const INVITEE_NONE = "__none__";

type TeacherRegisterStudentPanelProps = {
  students: TeacherRegisteredStudentWithClass[];
  classes: TeacherClassWithDeck[];
  teamId: number | null;
  isEducationTeamWorkspace: boolean;
  workspaceInvitees: WorkspaceStudentInvitee[];
};

function formatClassOptionLabel(option: {
  label: string;
  subject: string;
  term: string;
}): string {
  return option.label;
}

function formatInviteeDisplayLabel(invitee: WorkspaceStudentInvitee): string {
  const email = invitee.email.trim();
  return email ? `${invitee.label} · ${email}` : invitee.label;
}

function formatAssignedClass(
  student: TeacherRegisteredStudentWithClass,
  classes: TeacherClassWithDeck[],
): string {
  if (student.classId == null) return "—";

  const cls = classes.find((item) => item.id === student.classId);
  if (cls) return teacherClassDisplayTitle(cls);

  if (student.classTermSemester && student.classWeek && student.classDeckName) {
    return buildTeacherClassDisplayTitle(
      student.classTermSemester,
      student.classWeek,
      student.classDeckName,
    );
  }

  return "—";
}

export function TeacherRegisterStudentPanel({
  students: initialStudents,
  classes,
  teamId,
  isEducationTeamWorkspace,
  workspaceInvitees,
}: TeacherRegisterStudentPanelProps) {
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [showForm, setShowForm] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingStudent, setEditingStudent] =
    useState<TeacherRegisteredStudentWithClass | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [classId, setClassId] = useState(CLASS_NONE);
  const [selectedInviteeKey, setSelectedInviteeKey] = useState(INVITEE_NONE);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelephone, setEditTelephone] = useState("");
  const [editClassId, setEditClassId] = useState(CLASS_NONE);

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

  const selectedInvitee = useMemo(
    () => workspaceInvitees.find((invitee) => invitee.key === selectedInviteeKey) ?? null,
    [workspaceInvitees, selectedInviteeKey],
  );

  const selectedClassOption = useMemo(
    () => classOptions.find((option) => option.id === classId) ?? null,
    [classOptions, classId],
  );

  const selectedEditClassOption = useMemo(
    () => classOptions.find((option) => option.id === editClassId) ?? null,
    [classOptions, editClassId],
  );

  const registeredInviteeKeys = useMemo(() => {
    const emails = new Set(students.map((student) => student.email.trim().toLowerCase()));
    return new Set(
      workspaceInvitees
        .filter((invitee) => emails.has(invitee.email.trim().toLowerCase()))
        .map((invitee) => invitee.key),
    );
  }, [students, workspaceInvitees]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (classes.length > 0 && classId === CLASS_NONE) {
      toast.error("Select a class for this student.");
      return;
    }

    setIsPending(true);
    try {
      if (isEducationTeamWorkspace) {
        if (teamId == null) {
          toast.error("Open Student Progress from an education workspace to register students.");
          return;
        }
        if (selectedInviteeKey === INVITEE_NONE) {
          toast.error("Select a workspace student.");
          return;
        }

        const saved = await registerWorkspaceInviteeStudentAction({
          teamId,
          inviteeKey: selectedInviteeKey,
          ...(classId !== CLASS_NONE ? { classId: Number(classId) } : {}),
        });
        setSelectedInviteeKey(INVITEE_NONE);
        setClassId(CLASS_NONE);
        setShowForm(false);
        toast.success("Student registered", {
          description: `${saved.fullName} was added to your roster.`,
        });
        router.refresh();
        return;
      }

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

  function openEditDialog(student: TeacherRegisteredStudentWithClass) {
    setEditingStudent(student);
    setEditFullName(student.fullName);
    setEditEmail(student.email);
    setEditTelephone(student.telephone ?? "");
    setEditClassId(student.classId != null ? String(student.classId) : CLASS_NONE);
  }

  function closeEditDialog() {
    if (isEditPending) return;
    setEditingStudent(null);
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!editingStudent) return;

    if (classes.length > 0 && editClassId === CLASS_NONE) {
      toast.error("Select a class for this student.");
      return;
    }

    setIsEditPending(true);
    try {
      const saved = await updateTeacherRegisteredStudentAction({
        studentId: editingStudent.id,
        fullName: editFullName,
        email: editEmail,
        telephone: editTelephone,
        ...(editClassId !== CLASS_NONE ? { classId: Number(editClassId) } : {}),
      });
      setStudents((current) =>
        current.map((student) =>
          student.id === saved.id
            ? {
                ...student,
                fullName: saved.fullName,
                email: saved.email,
                telephone: saved.telephone,
                classId: saved.classId,
              }
            : student,
        ),
      );
      setEditingStudent(null);
      toast.success("Student updated", {
        description: `${saved.fullName} was saved.`,
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update student.",
      );
    } finally {
      setIsEditPending(false);
    }
  }

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Registering a student</CardTitle>
            <CardDescription>
              {isEducationTeamWorkspace
                ? "Education Gold and Enterprise workspaces register students from members invited by the workspace owner or team admins."
                : "Education Plus teachers maintain a personal student roster with contact details and a single class assignment per student."}
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
              <Label htmlFor="register-student-class">Class</Label>
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a class first on the{" "}
                  <Link
                    href={
                      isEducationTeamWorkspace && teamId != null
                        ? `/teacher/classes?team=${teamId}`
                        : "/teacher/classes"
                    }
                    className="text-primary underline-offset-4 hover:underline"
                  >
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
                    <SelectValue placeholder="Select a class">
                      {selectedClassOption?.label ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLASS_NONE} disabled>
                      Select a class
                    </SelectItem>
                    {classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {formatClassOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Assign the student to a class so you can record grades and generate reports in the
                other tabs.
              </p>
            </div>
            {isEducationTeamWorkspace ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="register-workspace-invitee">Workspace student</Label>
                {workspaceInvitees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active workspace students yet. Members appear here after they accept
                    an invitation from the workspace owner or a team admin.
                  </p>
                ) : (
                  <Select
                    value={selectedInviteeKey}
                    onValueChange={(value) => setSelectedInviteeKey(value ?? INVITEE_NONE)}
                  >
                    <SelectTrigger id="register-workspace-invitee" className="w-full">
                      <SelectValue placeholder="Select a workspace student">
                        {selectedInvitee ? formatInviteeDisplayLabel(selectedInvitee) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={INVITEE_NONE} disabled>
                        Select a workspace student
                      </SelectItem>
                      {workspaceInvitees.map((invitee) => (
                        <SelectItem
                          key={invitee.key}
                          value={invitee.key}
                          disabled={registeredInviteeKeys.has(invitee.key)}
                        >
                          {formatInviteeDisplayLabel(invitee)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedInvitee ? (
                  <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{selectedInvitee.label}</span>
                      {selectedInvitee.email ? ` · ${selectedInvitee.email}` : null}
                    </p>
                    <p className="text-xs">
                      Invited by {selectedInvitee.invitedByLabel ?? "workspace admin"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose an active workspace member invited by the owner or a team admin.
                  </p>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
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
            {isEducationTeamWorkspace ? (
              <>
                No registered students yet. Click <strong>Register student</strong> to choose
                an invited workspace member and assign a class.
              </>
            ) : (
              <>
                No registered students yet. Click <strong>Register student</strong> to add
                full name, email, telephone, and class.
              </>
            )}
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
                      {formatAssignedClass(student, classes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === student.id || isEditPending}
                          onClick={() => openEditDialog(student)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          <span className="sr-only">Edit {student.fullName}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === student.id || isEditPending}
                          onClick={() => void handleDelete(student.id)}
                        >
                          {deletingId === student.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                          <span className="sr-only">Remove {student.fullName}</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={editingStudent != null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
            <DialogDescription>
              Update contact details or change the class assignment for this student.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-student-class">Class</Label>
              {classes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a class first on the{" "}
                  <Link
                    href={
                      isEducationTeamWorkspace && teamId != null
                        ? `/teacher/classes?team=${teamId}`
                        : "/teacher/classes"
                    }
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Classes
                  </Link>{" "}
                  page, then assign each student to one class here.
                </p>
              ) : (
                <Select
                  value={editClassId}
                  onValueChange={(value) => setEditClassId(value ?? CLASS_NONE)}
                  disabled={isEditPending}
                >
                  <SelectTrigger id="edit-student-class" className="w-full">
                    <SelectValue placeholder="Select a class">
                      {selectedEditClassOption?.label ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLASS_NONE} disabled>
                      Select a class
                    </SelectItem>
                    {classOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {formatClassOptionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-student-full-name">Full name</Label>
              <Input
                id="edit-student-full-name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
                readOnly={isEducationTeamWorkspace}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-email">Email</Label>
              <Input
                id="edit-student-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                readOnly={isEducationTeamWorkspace}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-telephone">Telephone</Label>
              <Input
                id="edit-student-telephone"
                type="tel"
                value={editTelephone}
                onChange={(e) => setEditTelephone(e.target.value)}
                disabled={isEditPending}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={isEditPending}
                onClick={closeEditDialog}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditPending} className="gap-2">
                {isEditPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Pencil className="size-4" aria-hidden />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
