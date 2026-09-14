import { z } from "zod";

export const WORKSPACE_KINDS = [
  "corporation_government",
  "education_institution",
  "teacher_tutor",
  "parent_guardian",
  "student_study_group",
] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const EDUCATION_LEVELS = [
  "early_childhood",
  "primary",
  "secondary",
  "tertiary",
  "vocational",
  "adult",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const WORKSPACE_KIND_OPTIONS: {
  value: WorkspaceKind;
  label: string;
  description: string;
}[] = [
  {
    value: "corporation_government",
    label: "Corporation or Government",
    description: "A ministry, agency, or corporate training workspace.",
  },
  {
    value: "education_institution",
    label: "Education Institution",
    description: "A school, college, or campus department workspace.",
  },
  {
    value: "teacher_tutor",
    label: "Teacher or Tutor",
    description: "A class or tutoring group you teach.",
  },
  {
    value: "parent_guardian",
    label: "Parent or Guardian",
    description: "A workspace for your child’s class or study.",
  },
  {
    value: "student_study_group",
    label: "Student or Study Group",
    description: "A class or peer study group you belong to.",
  },
];

export const EDUCATION_LEVEL_OPTIONS: {
  value: EducationLevel;
  label: string;
}[] = [
  { value: "early_childhood", label: "Early childhood" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "tertiary", label: "Tertiary" },
  { value: "vocational", label: "Vocational / technical" },
  { value: "adult", label: "Adult / continuing education" },
];

const trimmedField = z.string().trim().min(1).max(80);

export const workspaceCreateProfileSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("corporation_government"),
    region: trimmedField,
    educationLevel: z.enum(EDUCATION_LEVELS),
    schoolName: trimmedField,
    department: trimmedField,
    className: trimmedField,
  }),
  z.object({
    kind: z.literal("education_institution"),
    educationLevel: z.enum(EDUCATION_LEVELS),
    schoolName: trimmedField,
    department: trimmedField,
    className: trimmedField,
  }),
  z.object({
    kind: z.literal("teacher_tutor"),
    educationLevel: z.enum(EDUCATION_LEVELS),
    schoolName: trimmedField,
    className: trimmedField,
  }),
  z.object({
    kind: z.literal("parent_guardian"),
    educationLevel: z.enum(EDUCATION_LEVELS),
    schoolOrChildName: trimmedField,
    className: trimmedField,
  }),
  z.object({
    kind: z.literal("student_study_group"),
    educationLevel: z.enum(EDUCATION_LEVELS),
    className: trimmedField,
  }),
]);

export type WorkspaceCreateProfile = z.infer<typeof workspaceCreateProfileSchema>;

export type WorkspaceCreateDraft = {
  kind: WorkspaceKind | "";
  region: string;
  educationLevel: EducationLevel | "";
  schoolName: string;
  schoolOrChildName: string;
  department: string;
  className: string;
};

export const EMPTY_WORKSPACE_CREATE_DRAFT: WorkspaceCreateDraft = {
  kind: "",
  region: "",
  educationLevel: "",
  schoolName: "",
  schoolOrChildName: "",
  department: "",
  className: "",
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "or",
  "the",
  "to",
]);

const EDUCATION_LEVEL_ABBREV: Record<EducationLevel, string> = {
  early_childhood: "EC",
  primary: "Pri",
  secondary: "Sec",
  tertiary: "Ter",
  vocational: "Voc",
  adult: "Adult",
};

function tokenize(value: string): string[] {
  return value
    .trim()
    .split(/[\s/_.,-]+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((part) => part.length > 0 && !STOP_WORDS.has(part.toLowerCase()));
}

/** Short token from a school, class, region, or department name. */
export function abbreviatePhrase(value: string): string {
  const words = tokenize(value);
  if (words.length === 0) return "";
  if (words.length === 1) {
    const word = words[0]!;
    if (/\d/.test(word)) return word.toUpperCase();
    if (word.length <= 4) {
      return word[0]!.toUpperCase() + word.slice(1).toLowerCase();
    }
    return word[0]!.toUpperCase() + word.slice(1, 3).toLowerCase();
  }
  return words
    .map((word) => {
      if (/\d/.test(word)) return word.toUpperCase();
      return word[0]!.toUpperCase();
    })
    .join("");
}

export function educationLevelAbbrev(level: EducationLevel): string {
  return EDUCATION_LEVEL_ABBREV[level];
}

function joinNameParts(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("-");
}

/** Unique workspace name from two or three abbreviated fields. */
export function buildWorkspaceNameFromProfile(
  profile: WorkspaceCreateProfile,
): string {
  switch (profile.kind) {
    case "corporation_government":
      return joinNameParts([
        abbreviatePhrase(profile.region),
        abbreviatePhrase(profile.schoolName),
        abbreviatePhrase(profile.className),
      ]);
    case "education_institution":
      return joinNameParts([
        abbreviatePhrase(profile.schoolName),
        abbreviatePhrase(profile.department),
        abbreviatePhrase(profile.className),
      ]);
    case "teacher_tutor":
      return joinNameParts([
        abbreviatePhrase(profile.schoolName),
        abbreviatePhrase(profile.className),
      ]);
    case "parent_guardian":
      return joinNameParts([
        abbreviatePhrase(profile.schoolOrChildName),
        abbreviatePhrase(profile.className),
      ]);
    case "student_study_group":
      return joinNameParts([
        educationLevelAbbrev(profile.educationLevel),
        abbreviatePhrase(profile.className),
      ]);
  }
}

export function previewWorkspaceName(draft: WorkspaceCreateDraft): string {
  const parsed = workspaceCreateProfileSchema.safeParse(draft);
  if (!parsed.success) return "";
  return buildWorkspaceNameFromProfile(parsed.data);
}

export function allocateUniqueWorkspaceName(
  baseName: string,
  existingNames: string[],
): string {
  const base = baseName.trim();
  if (!base) {
    throw new Error("Could not build a workspace name from those details.");
  }
  const taken = new Set(
    existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; n <= 999; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error("Could not allocate a unique workspace name.");
}

export const WORKSPACE_NAME_EXAMPLES: Record<
  WorkspaceKind,
  { fields: string; name: string }
> = {
  corporation_government: {
    fields: "Caribbean + Kingston High School + Form 4B",
    name: "Car-KHS-F4B",
  },
  education_institution: {
    fields: "Kingston High School + Science + Form 4B",
    name: "KHS-Sci-F4B",
  },
  teacher_tutor: {
    fields: "Kingston High School + Form 4B",
    name: "KHS-F4B",
  },
  parent_guardian: {
    fields: "Maya Thompson + Grade 6",
    name: "MT-G6",
  },
  student_study_group: {
    fields: "Secondary + Form 4B",
    name: "Sec-F4B",
  },
};

export function workspaceKindLabel(kind: WorkspaceKind): string {
  return WORKSPACE_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function educationLevelLabel(level: EducationLevel): string {
  return (
    EDUCATION_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? level
  );
}

export function parseStoredWorkspaceCreationProfile(
  value: unknown,
): WorkspaceCreateProfile | null {
  const parsed = workspaceCreateProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type WorkspaceDetailRow = { label: string; value: string };

export function workspaceCreationProfileDetailRows(
  profile: WorkspaceCreateProfile,
): WorkspaceDetailRow[] {
  const kind = workspaceKindLabel(profile.kind);
  const level = educationLevelLabel(profile.educationLevel);
  switch (profile.kind) {
    case "corporation_government":
      return [
        { label: "Workspace for", value: kind },
        { label: "Region of institution", value: profile.region },
        { label: "Level of education", value: level },
        { label: "School name", value: profile.schoolName },
        { label: "Department / faculty", value: profile.department },
        { label: "Class name", value: profile.className },
      ];
    case "education_institution":
      return [
        { label: "Workspace for", value: kind },
        { label: "Level of education", value: level },
        { label: "School name", value: profile.schoolName },
        { label: "Department / faculty", value: profile.department },
        { label: "Class name", value: profile.className },
      ];
    case "teacher_tutor":
      return [
        { label: "Workspace for", value: kind },
        { label: "Level of education", value: level },
        { label: "School name", value: profile.schoolName },
        { label: "Class name", value: profile.className },
      ];
    case "parent_guardian":
      return [
        { label: "Workspace for", value: kind },
        { label: "Level of education", value: level },
        { label: "School / child name", value: profile.schoolOrChildName },
        { label: "Class name", value: profile.className },
      ];
    case "student_study_group":
      return [
        { label: "Workspace for", value: kind },
        { label: "Level of education", value: level },
        { label: "Class name", value: profile.className },
      ];
  }
}

export type TeamWorkspaceInfo = {
  name: string;
  planLabel: string;
  ownerDisplayName: string;
  createdAtLabel: string;
  statusLabel: string;
  extraRows: WorkspaceDetailRow[];
  setupRows: WorkspaceDetailRow[];
};

export function buildTeamWorkspaceInfo(input: {
  name: string;
  planLabel: string;
  ownerDisplayName: string;
  createdAt: Date;
  inactiveAt: Date | null;
  creationProfile: unknown;
  extraRows?: WorkspaceDetailRow[];
}): TeamWorkspaceInfo {
  const profile = parseStoredWorkspaceCreationProfile(input.creationProfile);
  return {
    name: input.name,
    planLabel: input.planLabel,
    ownerDisplayName: input.ownerDisplayName.trim() || "Unknown",
    createdAtLabel: input.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    statusLabel: input.inactiveAt ? "Inactive" : "Active",
    extraRows: input.extraRows ?? [],
    setupRows: profile ? workspaceCreationProfileDetailRows(profile) : [],
  };
}
