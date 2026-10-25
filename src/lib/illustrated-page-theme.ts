import {
  resolveSubjectArtwork,
  type SubjectKey,
} from "@/lib/illustrated-appearance";

export type IllustratedPagePattern = "math" | "general";

export type IllustratedPageTheme = {
  subject: SubjectKey;
  /** CSS background for the page, including the quiet centre. */
  base: string;
  pattern: IllustratedPagePattern;
  /** Dedicated side artwork. Null means the gradient is the fallback. */
  left: string | null;
  right: string | null;
  leftWidth: number;
  leftHeight: number;
  rightWidth: number;
  rightHeight: number;
  transparent: boolean;
};

const NAVY =
  "radial-gradient(ellipse 42% 32% at 0% 8%, rgba(45, 212, 191, 0.2), transparent 62%), radial-gradient(ellipse 38% 30% at 100% 92%, rgba(139, 92, 246, 0.22), transparent 64%), linear-gradient(180deg, #07111f 0%, #0c1c3d 46%, #081428 100%)";

const THEMES: Record<SubjectKey, Omit<IllustratedPageTheme, "subject">> = {
  mathematics: {
    base: NAVY,
    pattern: "math",
    left: "/illustrated/backgrounds/math-left.png",
    right: "/illustrated/backgrounds/math-right.png",
    leftWidth: 864,
    leftHeight: 1152,
    rightWidth: 864,
    rightHeight: 1152,
    transparent: true,
  },
  science: {
    base: "radial-gradient(ellipse 40% 30% at 0% 10%, rgba(45, 212, 191, 0.18), transparent 60%), linear-gradient(180deg, #07111f 0%, #0c1c3d 46%, #081428 100%)",
    pattern: "general",
    left: "/illustrated/backgrounds/science-side-left.png",
    right: "/illustrated/backgrounds/science-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
  history: {
    base: NAVY,
    pattern: "general",
    left: "/illustrated/backgrounds/history-side-left.png",
    right: "/illustrated/backgrounds/history-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
  english: {
    base: NAVY,
    pattern: "general",
    left: "/illustrated/backgrounds/english-side-left.png",
    right: "/illustrated/backgrounds/english-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
  geography: {
    base: NAVY,
    pattern: "general",
    left: "/illustrated/backgrounds/geography-side-left.png",
    right: "/illustrated/backgrounds/geography-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
  technology: {
    base: NAVY,
    pattern: "general",
    left: "/illustrated/backgrounds/technology-side-left.png",
    right: "/illustrated/backgrounds/technology-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
  general: {
    base: NAVY,
    pattern: "general",
    left: "/illustrated/backgrounds/general-side-left.png",
    right: "/illustrated/backgrounds/general-side-right.png",
    leftWidth: 720,
    leftHeight: 1280,
    rightWidth: 720,
    rightHeight: 1280,
    transparent: true,
  },
};

/** Page background for the subject already chosen by the shared artwork resolver. */
export function resolveIllustratedPageTheme(input: {
  name?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
}): IllustratedPageTheme {
  const art = resolveSubjectArtwork(input);
  const theme: IllustratedPageTheme = { subject: art.subject, ...THEMES[art.subject] };
  if (art.subject === "mathematics") {
    const text = [input.name, input.description, input.gradeLevel].filter(Boolean).join(" ");
    if (!/\bstatistics?\b/i.test(text)) {
      theme.left = "/illustrated/backgrounds/geometry-left.png";
      theme.right = "/illustrated/backgrounds/geometry-right.png";
      theme.leftWidth = 720;
      theme.leftHeight = 1280;
      theme.rightWidth = 720;
      theme.rightHeight = 1280;
    }
  }
  return theme;
}
