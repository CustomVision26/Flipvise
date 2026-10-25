import { useId } from "react";
import { cn } from "@/lib/utils";
import {
  SUBJECT_PALETTES,
  type SubjectKey,
} from "@/lib/illustrated-appearance";

/** Vector subject artwork. Decorative — titles stay in HTML. */
export function SubjectArt({
  subject,
  className,
}: {
  subject: SubjectKey;
  className?: string;
}) {
  const palette = SUBJECT_PALETTES[subject];
  const gradientId = `sky-${subject}-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 320 180"
      className={cn("h-full w-full", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={palette.from} />
          <stop offset="1" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <rect width="320" height="180" rx="18" fill={`url(#${gradientId})`} />
      <ellipse cx="250" cy="36" rx="28" ry="16" fill="#fff" opacity="0.55" />
      <ellipse cx="270" cy="40" rx="18" ry="12" fill="#fff" opacity="0.4" />
      <ellipse cx="70" cy="28" rx="22" ry="12" fill="#fff" opacity="0.35" />
      {subject === "history" ? <HistoryScene /> : null}
      {subject === "science" ? <ScienceScene /> : null}
      {subject === "mathematics" ? <MathScene /> : null}
      {subject === "english" ? <EnglishScene /> : null}
      {subject === "geography" ? <GeographyScene /> : null}
      {subject === "technology" ? <TechnologyScene /> : null}
      {subject === "general" ? <GeneralScene /> : null}
    </svg>
  );
}

function HistoryScene() {
  return (
    <g>
      <rect x="36" y="92" width="70" height="58" rx="4" fill="#7c3aed" />
      <polygon points="28,92 71,48 114,92" fill="#5b21b6" />
      <rect x="58" y="112" width="18" height="38" rx="2" fill="#f5c16c" />
      <rect x="150" y="70" width="18" height="80" fill="#6d28d9" />
      <rect x="168" y="58" width="18" height="92" fill="#5b21b6" />
      <circle cx="177" cy="52" r="10" fill="#f8fafc" />
      <rect x="210" y="78" width="78" height="52" rx="6" fill="#f8f1dc" />
      <path d="M218 96h62M218 108h48" stroke="#a16207" strokeWidth="2" opacity="0.45" />
      <circle cx="262" cy="118" r="12" fill="#dc2626" />
      <path d="M262 110l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" fill="#fbbf24" />
    </g>
  );
}

function ScienceScene() {
  return (
    <g>
      <circle cx="86" cy="96" r="36" fill="#0ea5e9" />
      <path d="M70 88c10 8 22 8 34-2" fill="#22c55e" />
      <path d="M64 104c16 10 30 6 42-6" fill="#16a34a" />
      <rect x="150" y="108" width="46" height="36" rx="4" fill="#334155" />
      <rect x="158" y="86" width="10" height="24" fill="#64748b" />
      <rect x="176" y="78" width="10" height="32" fill="#94a3b8" />
      <ellipse cx="230" cy="120" rx="40" ry="16" fill="#bbf7d0" />
      <circle cx="214" cy="104" r="16" fill="#22c55e" />
      <circle cx="236" cy="98" r="12" fill="#4ade80" />
    </g>
  );
}

function MathScene() {
  return (
    <g>
      <rect x="48" y="78" width="42" height="42" rx="8" fill="#fb7185" transform="rotate(-8 69 99)" />
      <rect x="96" y="70" width="42" height="42" rx="8" fill="#fdba74" />
      <polygon points="168,128 196,68 224,128" fill="#f97316" />
      <circle cx="250" cy="96" r="26" fill="#fb7185" />
      <rect x="236" y="92" width="28" height="8" rx="2" fill="#fff7ed" />
    </g>
  );
}

function EnglishScene() {
  return (
    <g>
      <rect x="48" y="70" width="36" height="70" rx="3" fill="#312e81" />
      <rect x="88" y="62" width="36" height="78" rx="3" fill="#6366f1" />
      <rect x="128" y="74" width="36" height="66" rx="3" fill="#a5b4fc" />
      <path d="M200 120c20-40 48-40 68 0" fill="none" stroke="#e0e7ff" strokeWidth="6" />
      <path d="M248 78c8 10 8 18 0 28" fill="none" stroke="#f8fafc" strokeWidth="4" />
      <ellipse cx="236" cy="128" rx="28" ry="8" fill="#1e1b4b" opacity="0.35" />
    </g>
  );
}

function GeographyScene() {
  return (
    <g>
      <circle cx="150" cy="96" r="48" fill="#38bdf8" />
      <path d="M122 80c12 6 18 20 10 34-12 4-22-8-18-20 2-8 6-12 8-14z" fill="#22c55e" />
      <path d="M156 70c18 4 28 18 22 32-10 8-24 2-28-10-2-8 0-16 6-22z" fill="#16a34a" />
      <path d="M40 132c30-24 50-20 70-6 20 10 40 8 70-12 24-16 50-10 80 8v28H40z" fill="#166534" opacity="0.85" />
    </g>
  );
}

function TechnologyScene() {
  return (
    <g>
      <rect x="70" y="64" width="120" height="78" rx="12" fill="#1e3a8a" />
      <rect x="82" y="76" width="96" height="46" rx="6" fill="#67e8f9" />
      <circle cx="230" cy="96" r="28" fill="#0ea5e9" />
      <circle cx="230" cy="96" r="10" fill="#ecfeff" />
      <rect x="118" y="142" width="28" height="8" rx="2" fill="#1e3a8a" />
    </g>
  );
}

function GeneralScene() {
  return (
    <g>
      <rect x="78" y="78" width="120" height="72" rx="12" fill="#ddd6fe" transform="rotate(-8 138 114)" />
      <rect x="98" y="70" width="120" height="72" rx="12" fill="#c4b5fd" transform="rotate(4 158 106)" />
      <rect x="112" y="64" width="120" height="72" rx="12" fill="#f8fafc" />
      <circle cx="230" cy="52" r="8" fill="#fde68a" />
    </g>
  );
}

export function QuizStopwatchArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 90" className={className} aria-hidden focusable="false">
      <rect x="32" y="4" width="16" height="10" rx="3" fill="#7c3aed" />
      <circle cx="40" cy="50" r="30" fill="#a78bfa" />
      <circle cx="40" cy="50" r="22" fill="#f5f3ff" />
      <path d="M40 50V34" stroke="#6d28d9" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 50l10 6" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function QuizPencilArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 90" className={className} aria-hidden focusable="false">
      <g transform="rotate(28 40 45)">
        <rect x="30" y="16" width="18" height="48" rx="2" fill="#facc15" />
        <polygon points="30,64 48,64 39,82" fill="#fdba74" />
        <rect x="30" y="16" width="18" height="10" fill="#f472b6" />
      </g>
    </svg>
  );
}
