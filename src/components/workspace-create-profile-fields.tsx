"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  allocateUniqueWorkspaceName,
  EDUCATION_LEVEL_OPTIONS,
  previewWorkspaceName,
  WORKSPACE_DISPLAY_NAME_MAX,
  WORKSPACE_KIND_OPTIONS,
  WORKSPACE_NAME_EXAMPLES,
  type EducationLevel,
  type WorkspaceCreateDraft,
  type WorkspaceKind,
} from "@/lib/workspace-creation-profile";

type WorkspaceCreateProfileFieldsProps = {
  idPrefix: string;
  draft: WorkspaceCreateDraft;
  onChange: (next: WorkspaceCreateDraft) => void;
  disabled?: boolean;
  existingWorkspaceNames?: string[];
  nestedInModal?: boolean;
};

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

export function WorkspaceCreateProfileFields({
  idPrefix,
  draft,
  onChange,
  disabled = false,
  existingWorkspaceNames = [],
  nestedInModal = false,
}: WorkspaceCreateProfileFieldsProps) {
  const kind = draft.kind;
  const [pickingKind, setPickingKind] = useState(kind === "");
  const [nameEdited, setNameEdited] = useState(false);

  useEffect(() => {
    if (kind === "") {
      setPickingKind(true);
      return;
    }
    setPickingKind(false);
  }, [kind]);

  useEffect(() => {
    setNameEdited(false);
  }, [kind]);

  const example =
    kind === "" ? WORKSPACE_NAME_EXAMPLES.corporation_government : WORKSPACE_NAME_EXAMPLES[kind];
  const previewBase = previewWorkspaceName(draft);
  const previewName =
    previewBase.length > 0
      ? allocateUniqueWorkspaceName(previewBase, existingWorkspaceNames)
      : "";
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (nameEdited) return;
    if (draftRef.current.workspaceName === previewName) return;
    onChange({ ...draftRef.current, workspaceName: previewName });
  }, [nameEdited, onChange, previewName]);

  function patch(partial: Partial<WorkspaceCreateDraft>) {
    onChange({ ...draft, ...partial });
  }

  const showRegion = kind === "corporation_government";
  const showSchool =
    kind === "corporation_government" ||
    kind === "education_institution" ||
    kind === "teacher_tutor";
  const showSchoolOrChild = kind === "parent_guardian";
  const showDepartment =
    kind === "corporation_government" || kind === "education_institution";
  const showClass = kind !== "";
  const showLevel = kind !== "";
  const showAllKinds = pickingKind || kind === "";
  const visibleKindOptions = showAllKinds
    ? WORKSPACE_KIND_OPTIONS
    : WORKSPACE_KIND_OPTIONS.filter((option) => option.value === kind);
  const selectedKindOption = WORKSPACE_KIND_OPTIONS.find((option) => option.value === kind);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label id={`${idPrefix}-kind-label`}>Who is this workspace for?</Label>
        <RadioGroup
          aria-labelledby={`${idPrefix}-kind-label`}
          value={kind}
          disabled={disabled}
          onValueChange={(value) => {
            if (
              value === "corporation_government" ||
              value === "education_institution" ||
              value === "teacher_tutor" ||
              value === "parent_guardian" ||
              value === "student_study_group"
            ) {
              patch({ kind: value satisfies WorkspaceKind });
            }
          }}
          className="grid gap-2"
        >
          {visibleKindOptions.map((option) => (
            <div
              key={option.value}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-3",
                kind === option.value && "border-primary bg-muted/40",
              )}
            >
              <label
                className={cn(
                  "flex min-w-0 items-start gap-3",
                  showAllKinds && "flex-1 cursor-pointer",
                  !showAllKinds && "cursor-default",
                  disabled && "cursor-not-allowed opacity-50",
                )}
                onClick={() => {
                  if (showAllKinds && option.value === kind) {
                    setPickingKind(false);
                  }
                }}
              >
                <RadioGroupItem value={option.value} className="mt-0.5" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </span>
              </label>
              {kind === option.value && !showAllKinds ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={disabled}
                  onClick={() => setPickingKind(true)}
                >
                  Change
                </Button>
              ) : null}
            </div>
          ))}
        </RadioGroup>
        {kind !== "" && showAllKinds && selectedKindOption ? (
          <p className="text-xs text-muted-foreground">
            Choose a different option, or keep {selectedKindOption.label}.
          </p>
        ) : null}
      </div>

      {kind !== "" && !showAllKinds ? (
        <>
          <Alert>
            <AlertTitle>Example workspace name</AlertTitle>
            <AlertDescription>
              {example.fields} becomes{" "}
              <span className="font-medium text-foreground">{example.name}</span>
            </AlertDescription>
          </Alert>

          {showLevel ? (
            <Field htmlFor={`${idPrefix}-level`} label="Level of education">
              <Select
                value={draft.educationLevel || null}
                disabled={disabled}
                onValueChange={(value) => {
                  if (
                    value === "early_childhood" ||
                    value === "primary" ||
                    value === "secondary" ||
                    value === "tertiary" ||
                    value === "vocational" ||
                    value === "adult"
                  ) {
                    patch({ educationLevel: value satisfies EducationLevel });
                  }
                }}
              >
                <SelectTrigger
                  id={`${idPrefix}-level`}
                  className="w-full"
                  aria-label="Level of education"
                >
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent nestedInModal={nestedInModal}>
                  {EDUCATION_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {showRegion ? (
            <Field
              htmlFor={`${idPrefix}-region`}
              label="Region of institution"
              hint="The zone or territory where this institution is based."
            >
              <Input
                id={`${idPrefix}-region`}
                value={draft.region}
                onChange={(e) => patch({ region: e.target.value })}
                placeholder="e.g. Caribbean"
                disabled={disabled}
                maxLength={80}
              />
            </Field>
          ) : null}

          {showSchool ? (
            <Field htmlFor={`${idPrefix}-school`} label="School name">
              <Input
                id={`${idPrefix}-school`}
                value={draft.schoolName}
                onChange={(e) => patch({ schoolName: e.target.value })}
                placeholder="e.g. Kingston High School"
                disabled={disabled}
                maxLength={80}
              />
            </Field>
          ) : null}

          {showSchoolOrChild ? (
            <Field htmlFor={`${idPrefix}-child`} label="School / child name">
              <Input
                id={`${idPrefix}-child`}
                value={draft.schoolOrChildName}
                onChange={(e) => patch({ schoolOrChildName: e.target.value })}
                placeholder="e.g. Maya Thompson"
                disabled={disabled}
                maxLength={80}
              />
            </Field>
          ) : null}

          {showDepartment ? (
            <Field htmlFor={`${idPrefix}-department`} label="Department / faculty">
              <Input
                id={`${idPrefix}-department`}
                value={draft.department}
                onChange={(e) => patch({ department: e.target.value })}
                placeholder="e.g. Science"
                disabled={disabled}
                maxLength={80}
              />
            </Field>
          ) : null}

          {showClass ? (
            <Field htmlFor={`${idPrefix}-class`} label="Class name">
              <Input
                id={`${idPrefix}-class`}
                value={draft.className}
                onChange={(e) => patch({ className: e.target.value })}
                placeholder="e.g. Form 4B"
                disabled={disabled}
                maxLength={80}
              />
            </Field>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Workspace name</CardTitle>
              <CardDescription>
                Suggested from abbreviations of your details. You can edit it before
                creating the workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor={`${idPrefix}-workspace-name`} className="sr-only">
                Workspace name
              </Label>
              <Input
                id={`${idPrefix}-workspace-name`}
                value={draft.workspaceName}
                onChange={(e) => {
                  setNameEdited(true);
                  patch({ workspaceName: e.target.value });
                }}
                placeholder={
                  previewName
                    ? previewName
                    : "Fill in the fields above to preview the workspace name."
                }
                disabled={disabled || (!previewName && !nameEdited)}
                maxLength={WORKSPACE_DISPLAY_NAME_MAX}
                autoComplete="off"
              />
              {previewName && nameEdited && draft.workspaceName.trim() !== previewName ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-xs text-muted-foreground"
                  disabled={disabled}
                  onClick={() => {
                    setNameEdited(false);
                    patch({ workspaceName: previewName });
                  }}
                >
                  Use suggested name ({previewName})
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
