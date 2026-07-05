"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { stripOrderedListPrefix } from "@/lib/homework-list-items";
import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => stripOrderedListPrefix(line))
    .filter(Boolean);
}

function arrayToLines(items: string[]): string {
  return items.join("\n");
}

function HomeworkReadOnly({ result }: { result: HomeworkResult }) {
  return (
    <div className="space-y-4 text-foreground">
      <p className="font-medium">{result.assignmentTitle}</p>
      <p>{result.instructions}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {result.questions.map((question, index) => (
          <li key={`${index}-${question}`}>{question}</li>
        ))}
      </ol>
      <div>
        <p className="font-medium text-foreground">Answer Key</p>
        <ol className="list-decimal space-y-1 pl-5">
          {result.answerKey.map((answer, index) => (
            <li key={`${index}-${answer}`}>{answer}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function HomeworkEditable({
  draft,
  onChange,
}: {
  draft: HomeworkResult;
  onChange: (next: HomeworkResult) => void;
}) {
  function patch(partial: Partial<HomeworkResult>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-4 text-foreground">
      <div className="space-y-2">
        <Label htmlFor="edit-homework-title">Assignment title</Label>
        <Input
          id="edit-homework-title"
          value={draft.assignmentTitle}
          onChange={(event) => patch({ assignmentTitle: event.target.value })}
          className="bg-background text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-homework-instructions">Instructions</Label>
        <Textarea
          id="edit-homework-instructions"
          value={draft.instructions}
          onChange={(event) => patch({ instructions: event.target.value })}
          rows={3}
          className="bg-background text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-homework-questions">Questions</Label>
        <Textarea
          id="edit-homework-questions"
          value={arrayToLines(draft.questions)}
          onChange={(event) => patch({ questions: linesToArray(event.target.value) })}
          rows={Math.max(6, draft.questions.length + 2)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">One question per line</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-homework-answers">Answer key</Label>
        <Textarea
          id="edit-homework-answers"
          value={arrayToLines(draft.answerKey)}
          onChange={(event) => patch({ answerKey: linesToArray(event.target.value) })}
          rows={Math.max(6, draft.answerKey.length + 2)}
          className="bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">
          One answer per line, in the same order as the questions
        </p>
      </div>
    </div>
  );
}

export function HomeworkPreviewEditor({
  result,
  isEditing,
  editDraft,
  onEditDraftChange,
}: {
  result: HomeworkResult;
  isEditing: boolean;
  editDraft: HomeworkResult | null;
  onEditDraftChange: (next: HomeworkResult) => void;
}) {
  if (isEditing && editDraft) {
    return <HomeworkEditable draft={editDraft} onChange={onEditDraftChange} />;
  }
  return <HomeworkReadOnly result={result} />;
}

export function cloneHomeworkResult(result: HomeworkResult): HomeworkResult {
  return {
    ...result,
    questions: [...result.questions],
    answerKey: [...result.answerKey],
  };
}
