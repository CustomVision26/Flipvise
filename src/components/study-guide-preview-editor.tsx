"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeacherPreviewSection } from "@/components/teacher-tool-page-shell";
import type { StudyGuideResult } from "@/lib/teacher-generators";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function arrayToLines(items: string[]): string {
  return items.join("\n");
}

function StudyGuideReadOnly({
  result,
  sourceTitle,
}: {
  result: StudyGuideResult;
  sourceTitle?: string | null;
}) {
  return (
    <div className="space-y-3 text-foreground">
      {sourceTitle?.trim() ? (
        <TeacherPreviewSection title="Source" accent="cyan">
          <p className="font-medium">{sourceTitle.trim()}</p>
        </TeacherPreviewSection>
      ) : null}
      <TeacherPreviewSection title="Summary" accent="sky">
        <p>{result.summary}</p>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Key Vocabulary" accent="violet">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-violet-300">
          {result.keyVocabulary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Important Points" accent="emerald">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-emerald-300">
          {result.importantPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Worked Examples" accent="amber">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-amber-300">
          {result.workedExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Sample Problems" accent="rose">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-rose-300">
          {result.sampleProblems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Practice Questions" accent="cyan">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-cyan-300">
          {result.practiceQuestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Study Tips" accent="sky">
        <ul className="list-disc space-y-1.5 pl-5 marker:text-sky-300">
          {result.studyTips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </TeacherPreviewSection>
    </div>
  );
}

function StudyGuideEditable({
  draft,
  onChange,
  sourceTitle,
}: {
  draft: StudyGuideResult;
  onChange: (next: StudyGuideResult) => void;
  sourceTitle?: string | null;
}) {
  function patch(partial: Partial<StudyGuideResult>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-4 text-foreground">
      {sourceTitle?.trim() ? (
        <p className="text-sm font-semibold leading-snug text-foreground">
          {sourceTitle.trim()}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-summary">Summary</Label>
        <Textarea
          id="edit-study-guide-summary"
          value={draft.summary}
          onChange={(event) => patch({ summary: event.target.value })}
          rows={5}
          className="bg-background text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-vocabulary">Key vocabulary</Label>
        <Textarea
          id="edit-study-guide-vocabulary"
          value={arrayToLines(draft.keyVocabulary)}
          onChange={(event) => patch({ keyVocabulary: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.keyVocabulary.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One term per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-points">Important points</Label>
        <Textarea
          id="edit-study-guide-points"
          value={arrayToLines(draft.importantPoints)}
          onChange={(event) => patch({ importantPoints: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.importantPoints.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One point per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-examples">Worked examples</Label>
        <Textarea
          id="edit-study-guide-examples"
          value={arrayToLines(draft.workedExamples)}
          onChange={(event) => patch({ workedExamples: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.workedExamples.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One example per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-problems">Sample problems</Label>
        <Textarea
          id="edit-study-guide-problems"
          value={arrayToLines(draft.sampleProblems)}
          onChange={(event) => patch({ sampleProblems: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.sampleProblems.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One problem per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-questions">Practice questions</Label>
        <Textarea
          id="edit-study-guide-questions"
          value={arrayToLines(draft.practiceQuestions)}
          onChange={(event) => patch({ practiceQuestions: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.practiceQuestions.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One question per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-study-guide-tips">Study tips</Label>
        <Textarea
          id="edit-study-guide-tips"
          value={arrayToLines(draft.studyTips)}
          onChange={(event) => patch({ studyTips: linesToArray(event.target.value) })}
          rows={Math.max(4, draft.studyTips.length + 1)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One tip per line</p>
      </div>
    </div>
  );
}

export function StudyGuidePreviewEditor({
  result,
  isEditing,
  editDraft,
  onEditDraftChange,
  sourceTitle,
}: {
  result: StudyGuideResult;
  isEditing: boolean;
  editDraft: StudyGuideResult | null;
  onEditDraftChange: (next: StudyGuideResult) => void;
  sourceTitle?: string | null;
}) {
  if (isEditing && editDraft) {
    return (
      <StudyGuideEditable
        draft={editDraft}
        onChange={onEditDraftChange}
        sourceTitle={sourceTitle}
      />
    );
  }
  return <StudyGuideReadOnly result={result} sourceTitle={sourceTitle} />;
}

export function cloneStudyGuideResult(result: StudyGuideResult): StudyGuideResult {
  return {
    ...result,
    keyVocabulary: [...result.keyVocabulary],
    importantPoints: [...result.importantPoints],
    workedExamples: [...result.workedExamples],
    sampleProblems: [...result.sampleProblems],
    practiceQuestions: [...result.practiceQuestions],
    studyTips: [...result.studyTips],
  };
}
