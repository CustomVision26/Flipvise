"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

function StudyGuideReadOnly({ result }: { result: StudyGuideResult }) {
  return (
    <div className="space-y-4 text-foreground">
      <p>{result.summary}</p>
      <div>
        <p className="font-medium text-foreground">Key Vocabulary</p>
        <ul className="list-disc pl-5">
          {result.keyVocabulary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Important Points</p>
        <ul className="list-disc pl-5">
          {result.importantPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Worked Examples</p>
        <ul className="list-disc pl-5">
          {result.workedExamples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Sample Problems</p>
        <ul className="list-disc pl-5">
          {result.sampleProblems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Practice Questions</p>
        <ul className="list-disc pl-5">
          {result.practiceQuestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-medium text-foreground">Study Tips</p>
        <ul className="list-disc pl-5">
          {result.studyTips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StudyGuideEditable({
  draft,
  onChange,
}: {
  draft: StudyGuideResult;
  onChange: (next: StudyGuideResult) => void;
}) {
  function patch(partial: Partial<StudyGuideResult>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-4 text-foreground">
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
}: {
  result: StudyGuideResult;
  isEditing: boolean;
  editDraft: StudyGuideResult | null;
  onEditDraftChange: (next: StudyGuideResult) => void;
}) {
  if (isEditing && editDraft) {
    return <StudyGuideEditable draft={editDraft} onChange={onEditDraftChange} />;
  }
  return <StudyGuideReadOnly result={result} />;
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
