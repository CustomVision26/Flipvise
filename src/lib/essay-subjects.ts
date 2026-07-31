/** Catalog subjects for AI Essay / Writing Studio (grouped for the subject dropdown). */
export type EssaySubjectGroup = {
  category: string;
  /** When empty, the category label itself is the selectable subject. */
  subjects: readonly string[];
};

/**
 * Required dropdown shape — keep in sync with `.cursor/rules/ai-essay-writing-studio.mdc`.
 * Categories with children use the group label as a non-selectable header.
 */
export const ESSAY_SUBJECT_GROUPS: readonly EssaySubjectGroup[] = [
  {
    category: "Language Arts",
    subjects: ["English Language", "English Literature"],
  },
  {
    category: "Mathematics",
    subjects: [],
  },
  {
    category: "Science",
    subjects: [
      "General Science",
      "Biology",
      "Chemistry",
      "Physics",
      "Environmental Science",
    ],
  },
  {
    category: "Social Studies",
    subjects: ["Geography", "History", "Civics"],
  },
  {
    category: "Business",
    subjects: [
      "Business Studies",
      "Economics",
      "Accounting",
      "Entrepreneurship",
    ],
  },
  {
    category: "Technology",
    subjects: ["Information Technology", "Computer Science"],
  },
  {
    category: "Health",
    subjects: [],
  },
  {
    category: "Religious Education",
    subjects: [],
  },
  {
    category: "Arts",
    subjects: ["Music", "Drama", "Visual Arts"],
  },
  {
    category: "World Languages",
    subjects: ["Spanish", "French", "Portuguese", "German", "Mandarin"],
  },
  {
    category: "Career & Technical Education",
    subjects: [
      "Hospitality",
      "Tourism",
      "Agriculture",
      "Food & Nutrition",
      "Home Economics",
    ],
  },
  {
    category: "College & University",
    subjects: [
      "Psychology",
      "Sociology",
      "Nursing",
      "Education",
      "Criminal Justice",
      "Law",
      "Marketing",
      "Finance",
      "Political Science",
      "Philosophy",
    ],
  },
  {
    category: "Professional Development",
    subjects: [
      "Leadership",
      "Human Resources",
      "Project Management",
      "Customer Service",
      "Workplace Safety",
    ],
  },
  {
    category: "Other",
    subjects: [],
  },
] as const;

/** Flat list of selectable catalog values (excludes group labels that only group children). */
export const ESSAY_CATALOG_SUBJECTS: readonly string[] =
  ESSAY_SUBJECT_GROUPS.flatMap((group) =>
    group.subjects.length > 0 ? [...group.subjects] : [group.category],
  );
