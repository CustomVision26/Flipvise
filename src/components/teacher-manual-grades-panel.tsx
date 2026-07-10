"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTeacherManualGradeAction,
  deleteTeacherManualGradeAction,
  updateTeacherManualGradeAction,
} from "@/actions/teacher-manual-grades";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import type { TeacherRegisteredStudentWithClass } from "@/db/queries/teacher-registered-students";
import type { SavedHomeworkAssignmentOption } from "@/db/queries/saved-homework";
import type { TeacherManualGradeQuizOption } from "@/db/queries/teacher-manual-grades";
import type { TeacherManualGradeRow } from "@/db/schema";
import type { TeacherStudentProgressRow } from "@/db/queries/teacher-student-progress";
import {
  teacherClassDisplayTitle,
  teacherClassSubjectLabel,
  buildTeacherClassDeckHref,
  formatRegisteredStudentWithClassLabel,
  formatQuizResultOptionTitle,
  quizTitleForTeacherClass,
  registeredStudentClassDisplayTitle,
  resolveRegisteredStudentClass,
  resolveRegisteredStudentClassDeckId,
} from "@/lib/teacher-class-links";
import {
  buildTeacherHomeworkPath,
  buildTeacherPageCanonicalPath,
  buildTeacherQuizzesPath,
} from "@/lib/teacher-url";
import { cn } from "@/lib/utils";

const STUDENT_NONE = "__none__";
const ASSIGNMENT_NONE = "__none__";
const QUIZ_NONE = "__none__";

type GradeEntryType = "assignment" | "quiz";

type TeacherManualGradesPanelProps = {
  grades: TeacherManualGradeRow[];
  teamId: number | null;
  teamMemberId: number | null;
  isPersonalEducation?: boolean;
  isEducationTeamWorkspace?: boolean;
  registeredStudents?: TeacherRegisteredStudentWithClass[];
  personalClasses?: TeacherClassWithDeck[];
  savedHomeworkAssignments?: SavedHomeworkAssignmentOption[];
  savedQuizOptions?: TeacherManualGradeQuizOption[];
  quizResultRows?: TeacherStudentProgressRow[];
  variant?: "full" | "embedded";
  showForm?: boolean;
  onShowFormChange?: (open: boolean) => void;
  onDeletingIdChange?: (id: number | null) => void;
};

export type TeacherManualGradesPanelHandle = {
  openEditDialog: (grade: TeacherManualGradeRow) => void;
  deleteGrade: (gradeId: number) => Promise<void>;
};

const EMPTY_FORM = {
  studentName: "",
  studentEmail: "",
  assignmentTitle: "",
  grade: "",
  maxGrade: "",
  subject: "",
  academicYear: "",
  termSemester: "",
  period: "",
  notes: "",
};

function resolveHomeworkDeckId(homework: SavedHomeworkAssignmentOption): number | null {
  return homework.deckId ?? homework.inputDeckId;
}

function assignmentDisplayName(homework: SavedHomeworkAssignmentOption): string {
  return homework.assignmentTitle.trim() || homework.label.trim();
}

function assignmentOptionsForStudentId(
  studentId: string,
  registeredStudents: TeacherRegisteredStudentWithClass[],
  personalClasses: TeacherClassWithDeck[],
  savedHomeworkAssignments: SavedHomeworkAssignmentOption[],
): SavedHomeworkAssignmentOption[] {
  if (studentId === STUDENT_NONE) return [];

  const student = registeredStudents.find((item) => String(item.id) === studentId);
  if (student?.classId == null) return [];

  const cls = personalClasses.find((item) => item.id === student.classId);
  if (!cls) return [];

  const classSubject = teacherClassSubjectLabel(cls).trim().toLowerCase();

  return savedHomeworkAssignments.filter((homework) => {
    const homeworkDeckId = resolveHomeworkDeckId(homework);
    if (homeworkDeckId === cls.deckId) return true;
    if (
      homeworkDeckId == null &&
      classSubject !== "—" &&
      homework.subject.trim().toLowerCase() === classSubject
    ) {
      return true;
    }
    return false;
  });
}

function quizResultsForRegisteredStudent(
  student: TeacherRegisteredStudentWithClass,
  deckId: number | null,
  quizResultRows: TeacherStudentProgressRow[],
): TeacherStudentProgressRow[] {
  if (deckId == null) return [];

  const email = student.email.trim().toLowerCase();
  const name = student.fullName.trim().toLowerCase();

  return quizResultRows
    .filter((row) => {
      if (row.deckId !== deckId) return false;

      const rowEmail = (row.memberEmail ?? "").trim().toLowerCase();
      if (email && rowEmail) return rowEmail === email;

      const rowName = (row.memberName ?? "").trim().toLowerCase();
      return name !== "" && rowName === name;
    })
    .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}

function quizOptionsForStudentId(
  studentId: string,
  registeredStudents: TeacherRegisteredStudentWithClass[],
  personalClasses: TeacherClassWithDeck[],
  savedQuizOptions: TeacherManualGradeQuizOption[],
  quizResultRows: TeacherStudentProgressRow[],
): TeacherManualGradeQuizOption[] {
  if (studentId === STUDENT_NONE) return [];

  const student = registeredStudents.find((item) => String(item.id) === studentId);
  if (!student) return [];
  if (student.classId == null && student.classDeckId == null) return [];

  const cls = resolveRegisteredStudentClass(student, personalClasses);
  const deckId = resolveRegisteredStudentClassDeckId(student, personalClasses);
  if (deckId == null) return [];

  const studentResults = quizResultsForRegisteredStudent(student, deckId, quizResultRows);
  if (studentResults.length > 0) {
    const classLabel = cls
      ? null
      : registeredStudentClassDisplayTitle(student, personalClasses);

    return studentResults.map((row) => {
      const when = row.savedAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const title = cls
        ? formatQuizResultOptionTitle(cls, row.percent, row.savedAt)
        : classLabel
          ? `${classLabel} — ${row.percent}% (${when})`
          : `Quiz — ${row.percent}% (${when})`;

      return {
        key: `result-${row.resultId}`,
        title,
        deckId,
        resultId: row.resultId,
        percent: row.percent,
        savedAt: row.savedAt,
      };
    });
  }

  if (!cls) return [];

  const deckQuizzes = savedQuizOptions
    .filter((quiz) => quiz.deckId === cls.deckId)
    .map((quiz) => ({
      ...quiz,
      title: quizTitleForTeacherClass(cls, quiz.title),
    }));
  if (deckQuizzes.length > 0) return deckQuizzes;

  return [
    {
      key: `deck-${cls.deckId}`,
      title: quizTitleForTeacherClass(cls),
      deckId: cls.deckId,
    },
  ];
}

function findRegisteredStudentIdForGrade(
  grade: TeacherManualGradeRow,
  registeredStudents: TeacherRegisteredStudentWithClass[],
): string {
  const match = registeredStudents.find(
    (student) =>
      student.fullName === grade.studentName &&
      (!grade.studentEmail || student.email === grade.studentEmail),
  );

  return match ? String(match.id) : STUDENT_NONE;
}

export const TeacherManualGradesPanel = forwardRef<
  TeacherManualGradesPanelHandle,
  TeacherManualGradesPanelProps
>(function TeacherManualGradesPanel(
  {
    grades: initialGrades,
    teamId,
    teamMemberId,
    isPersonalEducation = false,
    isEducationTeamWorkspace = false,
    registeredStudents = [],
    personalClasses = [],
    savedHomeworkAssignments = [],
    savedQuizOptions = [],
    quizResultRows = [],
    variant = "full",
    showForm: controlledShowForm,
    onShowFormChange,
    onDeletingIdChange,
  },
  ref,
) {
  const router = useRouter();
  const [grades, setGrades] = useState(initialGrades);
  const [internalShowForm, setInternalShowForm] = useState(false);
  const showForm = controlledShowForm ?? internalShowForm;
  const setShowForm = onShowFormChange ?? setInternalShowForm;
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingGrade, setEditingGrade] = useState<TeacherManualGradeRow | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [selectedStudentId, setSelectedStudentId] = useState(STUDENT_NONE);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(ASSIGNMENT_NONE);
  const [selectedQuizKey, setSelectedQuizKey] = useState(QUIZ_NONE);
  const [gradeEntryType, setGradeEntryType] = useState<GradeEntryType>("assignment");
  const [editSelectedStudentId, setEditSelectedStudentId] = useState(STUDENT_NONE);
  const [editSelectedAssignmentId, setEditSelectedAssignmentId] = useState(ASSIGNMENT_NONE);
  const [editSelectedQuizKey, setEditSelectedQuizKey] = useState(QUIZ_NONE);
  const [editGradeEntryType, setEditGradeEntryType] = useState<GradeEntryType>("assignment");

  const useRegisteredStudentFlow =
    registeredStudents.length > 0 && (isPersonalEducation || isEducationTeamWorkspace);

  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  const distinctYears = useMemo(
    () => [...new Set(grades.map((grade) => grade.academicYear))],
    [grades],
  );

  const assignmentOptions = useMemo(
    () =>
      assignmentOptionsForStudentId(
        selectedStudentId,
        registeredStudents,
        personalClasses,
        savedHomeworkAssignments,
      ),
    [selectedStudentId, registeredStudents, personalClasses, savedHomeworkAssignments],
  );

  const quizOptions = useMemo(
    () =>
      quizOptionsForStudentId(
        selectedStudentId,
        registeredStudents,
        personalClasses,
        savedQuizOptions,
        quizResultRows,
      ),
    [selectedStudentId, registeredStudents, personalClasses, savedQuizOptions, quizResultRows],
  );

  const editAssignmentOptions = useMemo(
    () =>
      assignmentOptionsForStudentId(
        editSelectedStudentId,
        registeredStudents,
        personalClasses,
        savedHomeworkAssignments,
      ),
    [editSelectedStudentId, registeredStudents, personalClasses, savedHomeworkAssignments],
  );

  const editQuizOptions = useMemo(
    () =>
      quizOptionsForStudentId(
        editSelectedStudentId,
        registeredStudents,
        personalClasses,
        savedQuizOptions,
        quizResultRows,
      ),
    [editSelectedStudentId, registeredStudents, personalClasses, savedQuizOptions, quizResultRows],
  );

  const useAssignmentPicker =
    useRegisteredStudentFlow && assignmentOptions.length > 0;
  const useQuizPicker = useRegisteredStudentFlow && quizOptions.length > 0;
  const useEditAssignmentPicker =
    useRegisteredStudentFlow && editAssignmentOptions.length > 0;
  const useEditQuizPicker = useRegisteredStudentFlow && editQuizOptions.length > 0;

  const selectedAssignment = useMemo(
    () => assignmentOptions.find((item) => String(item.id) === selectedAssignmentId),
    [assignmentOptions, selectedAssignmentId],
  );

  const selectedStudent = useMemo(
    () => registeredStudents.find((student) => String(student.id) === selectedStudentId),
    [registeredStudents, selectedStudentId],
  );

  const selectedClass = useMemo(() => {
    if (!selectedStudent) return null;
    return resolveRegisteredStudentClass(selectedStudent, personalClasses);
  }, [personalClasses, selectedStudent]);

  const selectedQuiz = useMemo(
    () => quizOptions.find((item) => item.key === selectedQuizKey),
    [quizOptions, selectedQuizKey],
  );

  const editSelectedStudent = useMemo(
    () => registeredStudents.find((student) => String(student.id) === editSelectedStudentId),
    [registeredStudents, editSelectedStudentId],
  );

  const editSelectedClass = useMemo(() => {
    if (!editSelectedStudent) return null;
    return resolveRegisteredStudentClass(editSelectedStudent, personalClasses);
  }, [personalClasses, editSelectedStudent]);

  const editSelectedAssignment = useMemo(
    () => editAssignmentOptions.find((item) => String(item.id) === editSelectedAssignmentId),
    [editAssignmentOptions, editSelectedAssignmentId],
  );

  const editSelectedQuiz = useMemo(
    () => editQuizOptions.find((item) => item.key === editSelectedQuizKey),
    [editQuizOptions, editSelectedQuizKey],
  );

  const resourcesHomeworkHref = buildTeacherPageCanonicalPath(
    "/teacher/resources",
    teamId,
    teamMemberId,
    new URLSearchParams({ section: "homework" }),
  );

  const resourcesQuizHref = buildTeacherPageCanonicalPath(
    "/teacher/resources",
    teamId,
    teamMemberId,
    new URLSearchParams({ section: "quizzes" }),
  );

  function homeworkResourceHref(homeworkId: number) {
    return buildTeacherPageCanonicalPath(
      "/teacher/resources",
      teamId,
      teamMemberId,
      new URLSearchParams({ section: "homework", homeworkId: String(homeworkId) }),
    );
  }

  function classDeckHref(deckId: number) {
    return buildTeacherClassDeckHref(deckId);
  }

  function classQuizGeneratorHref(deckId: number) {
    return buildTeacherQuizzesPath(
      teamId,
      teamMemberId,
      new URLSearchParams({ deckId: String(deckId) }),
    );
  }

  function classHomeworkGeneratorHref(deckId: number, homeworkId?: number) {
    const params = new URLSearchParams();
    if (homeworkId != null) {
      params.set("homeworkId", String(homeworkId));
    }
    return buildTeacherHomeworkPath(teamId, teamMemberId, params);
  }

  function resetStudentSelection() {
    setSelectedStudentId(STUDENT_NONE);
    setSelectedAssignmentId(ASSIGNMENT_NONE);
    setSelectedQuizKey(QUIZ_NONE);
    setGradeEntryType("assignment");
    setForm(EMPTY_FORM);
  }

  function applyStudentSelection(studentId: string) {
    setSelectedStudentId(studentId);

    if (studentId === STUDENT_NONE) {
      setSelectedAssignmentId(ASSIGNMENT_NONE);
      setForm(EMPTY_FORM);
      return;
    }

    const student = registeredStudents.find((item) => String(item.id) === studentId);
    if (!student) return;

    const cls = resolveRegisteredStudentClass(student, personalClasses);

    setSelectedAssignmentId(ASSIGNMENT_NONE);
    setSelectedQuizKey(QUIZ_NONE);
    setForm((current) => ({
      ...current,
      studentName: student.fullName,
      studentEmail: student.email,
      subject: cls ? teacherClassSubjectLabel(cls) : "",
      academicYear: cls?.academicYear ?? student.classAcademicYear ?? "",
      termSemester: cls?.termSemester ?? student.classTermSemester ?? "",
      period: cls?.week ?? student.classWeek ?? "",
      assignmentTitle: "",
    }));
  }

  function applyAssignmentSelection(assignmentId: string) {
    setSelectedAssignmentId(assignmentId);

    if (assignmentId === ASSIGNMENT_NONE) {
      setForm((current) => ({ ...current, assignmentTitle: "" }));
      return;
    }

    const assignment = assignmentOptions.find((item) => String(item.id) === assignmentId);
    if (!assignment) return;

    setForm((current) => ({
      ...current,
      assignmentTitle: assignmentDisplayName(assignment),
      subject: current.subject || assignment.subject,
    }));
  }

  function applyQuizSelection(quizKey: string) {
    setSelectedQuizKey(quizKey);

    if (quizKey === QUIZ_NONE) {
      setForm((current) => ({ ...current, assignmentTitle: "", maxGrade: "" }));
      return;
    }

    const quiz = quizOptions.find((item) => item.key === quizKey);
    if (!quiz) return;

    setForm((current) => ({
      ...current,
      assignmentTitle: quiz.title,
      maxGrade: "",
      grade: quiz.percent != null ? String(quiz.percent) : current.grade,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isPersonalEducation && teamId == null) {
      toast.error("Open Student Progress from an education workspace to add grades.");
      return;
    }

    if (useRegisteredStudentFlow && selectedStudentId === STUDENT_NONE) {
      toast.error("Select a registered student.");
      return;
    }

    if (gradeEntryType === "assignment") {
      if (useAssignmentPicker && selectedAssignmentId === ASSIGNMENT_NONE) {
        toast.error("Select an assignment for this student.");
        return;
      }
      if (!form.assignmentTitle.trim()) {
        toast.error("Enter an assignment title.");
        return;
      }
    } else if (useQuizPicker && selectedQuizKey === QUIZ_NONE) {
      toast.error("Select a quiz for this student.");
      return;
    } else if (!form.assignmentTitle.trim()) {
      toast.error("Enter a quiz title.");
      return;
    }

    setIsPending(true);
    try {
      await createTeacherManualGradeAction({
        ...form,
        gradeType: gradeEntryType,
        ...(gradeEntryType === "quiz" ? { maxGrade: "" } : {}),
        ...(teamId != null ? { teamId } : {}),
      });
      resetStudentSelection();
      setShowForm(false);
      toast.success("Manual grade saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save grade.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(gradeId: number) {
    setDeletingId(gradeId);
    onDeletingIdChange?.(gradeId);
    try {
      await deleteTeacherManualGradeAction(gradeId);
      setGrades((current) => current.filter((grade) => grade.id !== gradeId));
      toast.success("Grade removed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove grade.");
    } finally {
      setDeletingId(null);
      onDeletingIdChange?.(null);
    }
  }

  function closeEditDialog() {
    if (isEditPending) return;
    setEditingGrade(null);
    setEditForm(EMPTY_FORM);
    setEditSelectedStudentId(STUDENT_NONE);
    setEditSelectedAssignmentId(ASSIGNMENT_NONE);
    setEditSelectedQuizKey(QUIZ_NONE);
    setEditGradeEntryType("assignment");
  }

  function openEditDialog(grade: TeacherManualGradeRow) {
    const studentId = findRegisteredStudentIdForGrade(grade, registeredStudents);
    const assignmentOptionsForEdit = assignmentOptionsForStudentId(
      studentId,
      registeredStudents,
      personalClasses,
      savedHomeworkAssignments,
    );
    const quizOptionsForEdit = quizOptionsForStudentId(
      studentId,
      registeredStudents,
      personalClasses,
      savedQuizOptions,
      quizResultRows,
    );
    const assignmentMatch = assignmentOptionsForEdit.find(
      (item) => assignmentDisplayName(item) === grade.assignmentTitle,
    );
    const quizMatch = quizOptionsForEdit.find((item) => item.title === grade.assignmentTitle);
    const entryType: GradeEntryType = grade.gradeType === "quiz" ? "quiz" : "assignment";

    setEditingGrade(grade);
    setEditGradeEntryType(entryType);
    setEditForm({
      studentName: grade.studentName,
      studentEmail: grade.studentEmail ?? "",
      assignmentTitle: grade.assignmentTitle,
      grade: grade.grade,
      maxGrade: grade.maxGrade ?? "",
      subject: grade.subject ?? "",
      academicYear: grade.academicYear,
      termSemester: grade.termSemester,
      period: grade.period ?? "",
      notes: grade.notes ?? "",
    });
    setEditSelectedStudentId(studentId);
    setEditSelectedAssignmentId(assignmentMatch ? String(assignmentMatch.id) : ASSIGNMENT_NONE);
    setEditSelectedQuizKey(quizMatch?.key ?? QUIZ_NONE);
  }

  function applyEditStudentSelection(studentId: string) {
    setEditSelectedStudentId(studentId);

    if (studentId === STUDENT_NONE) {
      setEditSelectedAssignmentId(ASSIGNMENT_NONE);
      setEditForm((current) => ({
        ...current,
        studentName: "",
        studentEmail: "",
        subject: "",
        academicYear: "",
        termSemester: "",
        period: "",
        assignmentTitle: "",
      }));
      return;
    }

    const student = registeredStudents.find((item) => String(item.id) === studentId);
    if (!student) return;

    const cls = resolveRegisteredStudentClass(student, personalClasses);

    setEditSelectedAssignmentId(ASSIGNMENT_NONE);
    setEditSelectedQuizKey(QUIZ_NONE);
    setEditForm((current) => ({
      ...current,
      studentName: student.fullName,
      studentEmail: student.email,
      subject: cls ? teacherClassSubjectLabel(cls) : current.subject,
      academicYear: cls?.academicYear ?? student.classAcademicYear ?? current.academicYear,
      termSemester: cls?.termSemester ?? student.classTermSemester ?? current.termSemester,
      period: cls?.week ?? student.classWeek ?? current.period,
      assignmentTitle: "",
    }));
  }

  function applyEditAssignmentSelection(assignmentId: string) {
    setEditSelectedAssignmentId(assignmentId);

    if (assignmentId === ASSIGNMENT_NONE) {
      setEditForm((current) => ({ ...current, assignmentTitle: "" }));
      return;
    }

    const assignment = editAssignmentOptions.find((item) => String(item.id) === assignmentId);
    if (!assignment) return;

    setEditForm((current) => ({
      ...current,
      assignmentTitle: assignmentDisplayName(assignment),
      subject: current.subject || assignment.subject,
    }));
  }

  function applyEditQuizSelection(quizKey: string) {
    setEditSelectedQuizKey(quizKey);

    if (quizKey === QUIZ_NONE) {
      setEditForm((current) => ({ ...current, assignmentTitle: "", maxGrade: "" }));
      return;
    }

    const quiz = editQuizOptions.find((item) => item.key === quizKey);
    if (!quiz) return;

    setEditForm((current) => ({
      ...current,
      assignmentTitle: quiz.title,
      maxGrade: "",
      grade: quiz.percent != null ? String(quiz.percent) : current.grade,
    }));
  }

  async function handleEditSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!editingGrade) return;

    if (useRegisteredStudentFlow && editSelectedStudentId === STUDENT_NONE) {
      toast.error("Select a registered student.");
      return;
    }

    if (editGradeEntryType === "assignment") {
      if (useEditAssignmentPicker && editSelectedAssignmentId === ASSIGNMENT_NONE) {
        toast.error("Select an assignment for this student.");
        return;
      }
      if (!editForm.assignmentTitle.trim()) {
        toast.error("Enter an assignment title.");
        return;
      }
    } else if (useEditQuizPicker && editSelectedQuizKey === QUIZ_NONE) {
      toast.error("Select a quiz for this student.");
      return;
    } else if (!editForm.assignmentTitle.trim()) {
      toast.error("Enter a quiz title.");
      return;
    }

    setIsEditPending(true);
    try {
      const saved = await updateTeacherManualGradeAction({
        gradeId: editingGrade.id,
        ...editForm,
        gradeType: editGradeEntryType,
        ...(editGradeEntryType === "quiz" ? { maxGrade: "" } : {}),
        ...(teamId != null ? { teamId } : {}),
      });
      setGrades((current) =>
        current.map((grade) =>
          grade.id === saved.id
            ? {
                ...grade,
                studentName: editForm.studentName,
                studentEmail: editForm.studentEmail || null,
                assignmentTitle: editForm.assignmentTitle,
                grade: editForm.grade,
                maxGrade: editGradeEntryType === "quiz" ? null : editForm.maxGrade || null,
                subject: editForm.subject || null,
                academicYear: editForm.academicYear,
                termSemester: editForm.termSemester,
                period: editForm.period || null,
                notes: editForm.notes || null,
                gradeType: editGradeEntryType,
              }
            : grade,
        ),
      );
      closeEditDialog();
      toast.success("Grade updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update grade.");
    } finally {
      setIsEditPending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    openEditDialog,
    deleteGrade: handleDelete,
  }));

  const addGradeForm = showForm ? (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:grid-cols-2"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-student-name">Student name</Label>
              {isPersonalEducation && registeredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Register students on the{" "}
                  <span className="font-medium text-foreground">Registering a student</span> tab
                  first, then return here to record grades.
                </p>
              ) : isEducationTeamWorkspace && registeredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Register workspace students on the{" "}
                  <span className="font-medium text-foreground">Registering a student</span> tab
                  first, then return here to record grades.
                </p>
              ) : useRegisteredStudentFlow ? (
                <Select
                  value={selectedStudentId}
                  onValueChange={(value) => applyStudentSelection(value ?? STUDENT_NONE)}
                >
                  <SelectTrigger id="manual-grade-student-name" className="w-full">
                    <SelectValue placeholder="Select a registered student">
                      {selectedStudent
                        ? formatRegisteredStudentWithClassLabel(selectedStudent, personalClasses)
                        : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STUDENT_NONE} disabled>
                      Select a registered student
                    </SelectItem>
                    {registeredStudents.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {formatRegisteredStudentWithClassLabel(student, personalClasses)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="manual-grade-student-name"
                  value={form.studentName}
                  onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-student-email">Student email (optional)</Label>
              <Input
                id="manual-grade-student-email"
                type="email"
                value={form.studentEmail}
                onChange={(e) => setForm((f) => ({ ...f, studentEmail: e.target.value }))}
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-subject">Subject (optional)</Label>
              <Input
                id="manual-grade-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-4 sm:col-span-2">
              {useRegisteredStudentFlow && selectedClass ? (
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Class deck</p>
                  <p className="mt-1 text-muted-foreground">
                    Quizzes use the flashcards in this class deck.
                  </p>
                  <Link
                    href={classDeckHref(selectedClass.deckId)}
                    className="mt-2 inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open deck cards — {teacherClassDisplayTitle(selectedClass)}
                  </Link>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Record type</Label>
                <ToggleGroup
                  value={[gradeEntryType]}
                  onValueChange={(value) => {
                    const next = (value[0] as GradeEntryType | undefined) ?? "assignment";
                    setGradeEntryType(next);
                    setSelectedAssignmentId(ASSIGNMENT_NONE);
                    setSelectedQuizKey(QUIZ_NONE);
                    setForm((current) => ({
                      ...current,
                      assignmentTitle: "",
                      grade: "",
                      maxGrade: "",
                    }));
                  }}
                  className="grid w-full grid-cols-2 gap-2"
                >
                  <ToggleGroupItem value="assignment" className="h-10 px-3">
                    Assignment grade
                  </ToggleGroupItem>
                  <ToggleGroupItem value="quiz" className="h-10 px-3">
                    Quiz result
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {gradeEntryType === "assignment" ? (
                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="manual-grade-assignment">Assignment</Label>
                    {useRegisteredStudentFlow ? (
                      <>
                        {selectedStudentId === STUDENT_NONE ? (
                          <p className="text-sm text-muted-foreground">
                            Select a student first to load assignments from their class.
                          </p>
                        ) : useAssignmentPicker ? (
                          <Select
                            value={selectedAssignmentId}
                            onValueChange={(value) =>
                              applyAssignmentSelection(value ?? ASSIGNMENT_NONE)
                            }
                          >
                            <SelectTrigger id="manual-grade-assignment" className="w-full">
                              <SelectValue placeholder="Select an assignment">
                                {selectedAssignment
                                  ? assignmentDisplayName(selectedAssignment)
                                  : null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ASSIGNMENT_NONE} disabled>
                                Select an assignment
                              </SelectItem>
                              {assignmentOptions.map((assignment) => (
                                <SelectItem key={assignment.id} value={String(assignment.id)}>
                                  {assignmentDisplayName(assignment)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="manual-grade-assignment"
                            value={form.assignmentTitle}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, assignmentTitle: e.target.value }))
                            }
                            placeholder="Assignment title"
                            required
                          />
                        )}
                        {selectedAssignment ? (
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {selectedAssignment.pdfUrl ? (
                              <a
                                href={selectedAssignment.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                                Open assignment PDF
                              </a>
                            ) : null}
                            <Link
                              href={classHomeworkGeneratorHref(
                                selectedClass?.deckId ?? 0,
                                selectedAssignment.id,
                              )}
                              className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              Open in Homework Generator
                            </Link>
                            <Link
                              href={homeworkResourceHref(selectedAssignment.id)}
                              className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              View in Resource Library
                            </Link>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <Input
                        id="manual-grade-assignment"
                        value={form.assignmentTitle}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, assignmentTitle: e.target.value }))
                        }
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-grade-grade">Grade</Label>
                    <Input
                      id="manual-grade-grade"
                      value={form.grade}
                      onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                      placeholder="e.g. 88 or B+"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-grade-max">Out of (optional)</Label>
                    <Input
                      id="manual-grade-max"
                      value={form.maxGrade}
                      onChange={(e) => setForm((f) => ({ ...f, maxGrade: e.target.value }))}
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="manual-grade-quiz">Quiz</Label>
                    {useRegisteredStudentFlow ? (
                      <>
                        {selectedStudentId === STUDENT_NONE ? (
                          <p className="text-sm text-muted-foreground">
                            Select a student first to load quizzes from their class.
                          </p>
                        ) : useQuizPicker ? (
                          <Select
                            value={selectedQuizKey}
                            onValueChange={(value) => applyQuizSelection(value ?? QUIZ_NONE)}
                          >
                            <SelectTrigger id="manual-grade-quiz" className="w-full">
                              <SelectValue placeholder="Select a quiz">
                                {selectedQuiz ? selectedQuiz.title : null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={QUIZ_NONE} disabled>
                                Select a quiz
                              </SelectItem>
                              {quizOptions.map((quiz) => (
                                <SelectItem key={quiz.key} value={quiz.key}>
                                  {quiz.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="manual-grade-quiz"
                            value={form.assignmentTitle}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, assignmentTitle: e.target.value }))
                            }
                            placeholder="Quiz title"
                            required
                          />
                        )}
                        {useRegisteredStudentFlow && selectedClass ? (
                          <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm">
                            <p className="font-medium text-foreground">Class deck</p>
                            <p className="mt-1 text-muted-foreground">
                              Quiz results use the flashcards in this class deck.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <Link
                                href={classDeckHref(selectedClass.deckId)}
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                                Open deck cards — {teacherClassDisplayTitle(selectedClass)}
                              </Link>
                              <Link
                                href={classQuizGeneratorHref(selectedClass.deckId)}
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                              >
                                <ExternalLink className="size-3.5" aria-hidden />
                                Open in Quiz Generator
                              </Link>
                            </div>
                          </div>
                        ) : null}
                        {selectedQuiz ? (
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <Link
                              href={resourcesQuizHref}
                              className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              View in Resource Library
                            </Link>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <Input
                        id="manual-grade-quiz"
                        value={form.assignmentTitle}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, assignmentTitle: e.target.value }))
                        }
                        placeholder="Quiz title"
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="manual-grade-quiz-score">Score (%)</Label>
                    <Input
                      id="manual-grade-quiz-score"
                      value={form.grade}
                      onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                      placeholder="e.g. 88"
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-year">Academic year</Label>
              <Input
                id="manual-grade-year"
                value={form.academicYear}
                onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
                placeholder="e.g. 2025–2026"
                required
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-grade-term">Term / semester</Label>
              <Input
                id="manual-grade-term"
                value={form.termSemester}
                onChange={(e) => setForm((f) => ({ ...f, termSemester: e.target.value }))}
                placeholder="e.g. Fall 2025"
                required
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-week">
                {useRegisteredStudentFlow ? "Week" : "Period (optional)"}
              </Label>
              <Input
                id="manual-grade-week"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="manual-grade-notes">Notes (optional)</Label>
              <Textarea
                id="manual-grade-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Save grade
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  resetStudentSelection();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
  ) : null;

  const editGradeDialog = (
      <Dialog open={editingGrade != null} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit grade</DialogTitle>
            <DialogDescription>
              Update the student, assignment, grade, or class details for this record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-manual-grade-student-name">Student name</Label>
              {useRegisteredStudentFlow ? (
                <Select
                  value={editSelectedStudentId}
                  onValueChange={(value) => applyEditStudentSelection(value ?? STUDENT_NONE)}
                >
                  <SelectTrigger id="edit-manual-grade-student-name" className="w-full">
                    <SelectValue placeholder="Select a registered student">
                      {editSelectedStudent
                        ? formatRegisteredStudentWithClassLabel(editSelectedStudent, personalClasses)
                        : editForm.studentName || null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STUDENT_NONE} disabled>
                      Select a registered student
                    </SelectItem>
                    {registeredStudents.map((student) => (
                      <SelectItem key={student.id} value={String(student.id)}>
                        {formatRegisteredStudentWithClassLabel(student, personalClasses)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="edit-manual-grade-student-name"
                  value={editForm.studentName}
                  onChange={(e) =>
                    setEditForm((current) => ({ ...current, studentName: e.target.value }))
                  }
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manual-grade-student-email">Student email (optional)</Label>
              <Input
                id="edit-manual-grade-student-email"
                type="email"
                value={editForm.studentEmail}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, studentEmail: e.target.value }))
                }
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manual-grade-subject">Subject (optional)</Label>
              <Input
                id="edit-manual-grade-subject"
                value={editForm.subject}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, subject: e.target.value }))
                }
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-4 sm:col-span-2">
              {useRegisteredStudentFlow && editSelectedClass ? (
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">Class deck</p>
                  <p className="mt-1 text-muted-foreground">
                    Quizzes use the flashcards in this class deck.
                  </p>
                  <Link
                    href={classDeckHref(editSelectedClass.deckId)}
                    className="mt-2 inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    Open deck cards — {teacherClassDisplayTitle(editSelectedClass)}
                  </Link>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Record type</Label>
                <ToggleGroup
                  value={[editGradeEntryType]}
                  onValueChange={(value) => {
                    const next = (value[0] as GradeEntryType | undefined) ?? "assignment";
                    setEditGradeEntryType(next);
                    setEditSelectedAssignmentId(ASSIGNMENT_NONE);
                    setEditSelectedQuizKey(QUIZ_NONE);
                    setEditForm((current) => ({
                      ...current,
                      assignmentTitle: "",
                      grade: "",
                      maxGrade: "",
                    }));
                  }}
                  className="grid w-full grid-cols-2 gap-2"
                >
                  <ToggleGroupItem value="assignment" className="h-10 px-3">
                    Assignment grade
                  </ToggleGroupItem>
                  <ToggleGroupItem value="quiz" className="h-10 px-3">
                    Quiz result
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {editGradeEntryType === "assignment" ? (
                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-manual-grade-assignment">Assignment</Label>
                    {useRegisteredStudentFlow ? (
                      <>
                        {editSelectedStudentId === STUDENT_NONE ? (
                          <p className="text-sm text-muted-foreground">
                            Select a student first to load assignments from their class.
                          </p>
                        ) : useEditAssignmentPicker ? (
                          <Select
                            value={editSelectedAssignmentId}
                            onValueChange={(value) =>
                              applyEditAssignmentSelection(value ?? ASSIGNMENT_NONE)
                            }
                          >
                            <SelectTrigger id="edit-manual-grade-assignment" className="w-full">
                              <SelectValue placeholder="Select an assignment">
                                {editSelectedAssignment
                                  ? assignmentDisplayName(editSelectedAssignment)
                                  : editForm.assignmentTitle || null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ASSIGNMENT_NONE} disabled>
                                Select an assignment
                              </SelectItem>
                              {editAssignmentOptions.map((assignment) => (
                                <SelectItem key={assignment.id} value={String(assignment.id)}>
                                  {assignmentDisplayName(assignment)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="edit-manual-grade-assignment"
                            value={editForm.assignmentTitle}
                            onChange={(e) =>
                              setEditForm((current) => ({
                                ...current,
                                assignmentTitle: e.target.value,
                              }))
                            }
                            placeholder="Assignment title"
                            required
                          />
                        )}
                      </>
                    ) : (
                      <Input
                        id="edit-manual-grade-assignment"
                        value={editForm.assignmentTitle}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            assignmentTitle: e.target.value,
                          }))
                        }
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-manual-grade-grade">Grade</Label>
                    <Input
                      id="edit-manual-grade-grade"
                      value={editForm.grade}
                      onChange={(e) =>
                        setEditForm((current) => ({ ...current, grade: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-manual-grade-max">Out of (optional)</Label>
                    <Input
                      id="edit-manual-grade-max"
                      value={editForm.maxGrade}
                      onChange={(e) =>
                        setEditForm((current) => ({ ...current, maxGrade: e.target.value }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/10 p-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-manual-grade-quiz">Quiz</Label>
                    {useRegisteredStudentFlow ? (
                      <>
                        {editSelectedStudentId === STUDENT_NONE ? (
                          <p className="text-sm text-muted-foreground">
                            Select a student first to load quizzes from their class.
                          </p>
                        ) : useEditQuizPicker ? (
                          <Select
                            value={editSelectedQuizKey}
                            onValueChange={(value) =>
                              applyEditQuizSelection(value ?? QUIZ_NONE)
                            }
                          >
                            <SelectTrigger id="edit-manual-grade-quiz" className="w-full">
                              <SelectValue placeholder="Select a quiz">
                                {editSelectedQuiz
                                  ? editSelectedQuiz.title
                                  : editForm.assignmentTitle || null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={QUIZ_NONE} disabled>
                                Select a quiz
                              </SelectItem>
                              {editQuizOptions.map((quiz) => (
                                <SelectItem key={quiz.key} value={quiz.key}>
                                  {quiz.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="edit-manual-grade-quiz"
                            value={editForm.assignmentTitle}
                            onChange={(e) =>
                              setEditForm((current) => ({
                                ...current,
                                assignmentTitle: e.target.value,
                              }))
                            }
                            placeholder="Quiz title"
                            required
                          />
                        )}
                      </>
                    ) : (
                      <Input
                        id="edit-manual-grade-quiz"
                        value={editForm.assignmentTitle}
                        onChange={(e) =>
                          setEditForm((current) => ({
                            ...current,
                            assignmentTitle: e.target.value,
                          }))
                        }
                        required
                      />
                    )}
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="edit-manual-grade-quiz-score">Score (%)</Label>
                    <Input
                      id="edit-manual-grade-quiz-score"
                      value={editForm.grade}
                      onChange={(e) =>
                        setEditForm((current) => ({ ...current, grade: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manual-grade-year">Academic year</Label>
              <Input
                id="edit-manual-grade-year"
                value={editForm.academicYear}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, academicYear: e.target.value }))
                }
                required
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manual-grade-term">Term / semester</Label>
              <Input
                id="edit-manual-grade-term"
                value={editForm.termSemester}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, termSemester: e.target.value }))
                }
                required
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-manual-grade-week">
                {useRegisteredStudentFlow ? "Week" : "Period (optional)"}
              </Label>
              <Input
                id="edit-manual-grade-week"
                value={editForm.period}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, period: e.target.value }))
                }
                readOnly={useRegisteredStudentFlow}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-manual-grade-notes">Notes (optional)</Label>
              <Textarea
                id="edit-manual-grade-notes"
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((current) => ({ ...current, notes: e.target.value }))
                }
                rows={3}
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
  );

  if (variant === "embedded") {
    return (
      <>
        {addGradeForm}
        {editGradeDialog}
      </>
    );
  }

  return (
    <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Manual grades</CardTitle>
            <CardDescription>
              {isPersonalEducation
                ? "Record assignment grades for your registered students when results are entered outside Flipvise quizzes."
                : "Record assignment grades for workspace students when results are entered outside Flipvise quizzes."}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-2"
            onClick={() => {
              if (showForm) {
                resetStudentSelection();
              }
              setShowForm(!showForm);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {showForm ? "Hide form" : "Add grade"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {addGradeForm}
        {grades.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No manual grades yet.
            {distinctYears.length > 0
              ? ` Academic years on file: ${distinctYears.join(", ")}.`
              : " Click Add grade to record assignment results."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/20 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade) => {
                  const isQuiz = grade.gradeType === "quiz";
                  return (
                  <tr key={grade.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{grade.studentName}</div>
                      {grade.studentEmail ? (
                        <div className="text-xs text-muted-foreground">{grade.studentEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {isQuiz ? "Quiz" : "Assignment"}
                    </td>
                    <td className="px-4 py-3">
                      <div>{grade.assignmentTitle}</div>
                      {grade.subject ? (
                        <div className="text-xs text-muted-foreground">{grade.subject}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {isQuiz
                        ? `${grade.grade}%`
                        : `${grade.grade}${grade.maxGrade ? ` / ${grade.maxGrade}` : ""}`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {grade.termSemester}
                      {grade.period ? ` · ${grade.period}` : ""}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{grade.academicYear}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === grade.id || isEditPending}
                          onClick={() => openEditDialog(grade)}
                        >
                          <Pencil className="size-4" aria-hidden />
                          <span className="sr-only">Edit grade for {grade.studentName}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === grade.id || isEditPending}
                          onClick={() => void handleDelete(grade.id)}
                        >
                          {deletingId === grade.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                          <span className="sr-only">Remove grade</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {editGradeDialog}
    </Card>
  );
});
