"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TeacherPreviewSection } from "@/components/teacher-tool-page-shell";
import type { DeckWorksheetResult, WorksheetItem } from "@/lib/teacher-worksheet-schema";

function WorksheetReadOnly({ result }: { result: DeckWorksheetResult }) {
  return (
    <div className="space-y-3 text-foreground">
      <TeacherPreviewSection title="Instructions" accent="sky">
        <p className="whitespace-pre-wrap">{result.instructions}</p>
      </TeacherPreviewSection>
      <TeacherPreviewSection title={`Questions (${result.items.length})`} accent="violet">
        <ol className="list-decimal space-y-2 pl-5 marker:text-violet-300">
          {result.items.map((item) => (
            <li key={item.questionNumber} className="whitespace-pre-wrap">
              <span>{item.prompt}</span>
              {item.frontImageUrl ? (
                <p className="text-xs text-muted-foreground">Includes card front image</p>
              ) : null}
            </li>
          ))}
        </ol>
      </TeacherPreviewSection>
      <TeacherPreviewSection title="Answer key preview" accent="emerald">
        <ol className="list-decimal space-y-2 pl-5 marker:text-emerald-300">
          {result.items.map((item) => (
            <li key={item.questionNumber} className="whitespace-pre-wrap">
              <span>{item.answer}</span>
              {item.backImageUrl || item.answerImageUrl ? (
                <p className="text-xs text-muted-foreground">Includes card back image</p>
              ) : null}
            </li>
          ))}
        </ol>
      </TeacherPreviewSection>
    </div>
  );
}

function WorksheetEditable({
  draft,
  onChange,
}: {
  draft: DeckWorksheetResult;
  onChange: (next: DeckWorksheetResult) => void;
}) {
  function patch(partial: Partial<DeckWorksheetResult>) {
    onChange({ ...draft, ...partial });
  }

  function patchItem(index: number, partial: Partial<WorksheetItem>) {
    const items = draft.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...partial } : item,
    );
    onChange({ ...draft, items });
  }

  return (
    <div className="space-y-4 text-foreground">
      <div className="space-y-2">
        <Label htmlFor="edit-worksheet-title">Worksheet title</Label>
        <Input
          id="edit-worksheet-title"
          value={draft.worksheetTitle}
          onChange={(event) => patch({ worksheetTitle: event.target.value })}
          className="bg-background text-foreground"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-worksheet-instructions">Instructions</Label>
        <Textarea
          id="edit-worksheet-instructions"
          value={draft.instructions}
          onChange={(event) => patch({ instructions: event.target.value })}
          rows={3}
          className="bg-background text-foreground"
        />
      </div>
      <div className="space-y-4">
        <p className="font-medium text-foreground">Questions and answers</p>
        {draft.items.map((item, index) => (
          <div
            key={item.questionNumber}
            className="space-y-3 rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-card to-card p-4"
          >
            <p className="text-sm font-medium text-foreground">Question {item.questionNumber}</p>
            <div className="space-y-2">
              <Label htmlFor={`edit-worksheet-prompt-${item.questionNumber}`}>Prompt</Label>
              <Textarea
                id={`edit-worksheet-prompt-${item.questionNumber}`}
                value={item.prompt}
                onChange={(event) => patchItem(index, { prompt: event.target.value })}
                rows={Math.max(3, item.prompt.split("\n").length + 1)}
                className="bg-background text-foreground"
              />
              {item.frontImageUrl ? (
                <p className="text-xs text-muted-foreground">Card front image is kept in the PDF</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-worksheet-answer-${item.questionNumber}`}>Answer</Label>
              <Textarea
                id={`edit-worksheet-answer-${item.questionNumber}`}
                value={item.answer}
                onChange={(event) => patchItem(index, { answer: event.target.value })}
                rows={Math.max(2, item.answer.split("\n").length + 1)}
                className="bg-background text-foreground"
              />
              {item.backImageUrl || item.answerImageUrl ? (
                <p className="text-xs text-muted-foreground">Card back image is kept in the PDF</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorksheetPreviewEditor({
  result,
  isEditing,
  editDraft,
  onEditDraftChange,
}: {
  result: DeckWorksheetResult;
  isEditing: boolean;
  editDraft: DeckWorksheetResult | null;
  onEditDraftChange: (next: DeckWorksheetResult) => void;
}) {
  if (isEditing && editDraft) {
    return <WorksheetEditable draft={editDraft} onChange={onEditDraftChange} />;
  }
  return <WorksheetReadOnly result={result} />;
}

export function cloneWorksheetResult(result: DeckWorksheetResult): DeckWorksheetResult {
  return {
    ...result,
    items: result.items.map((item) => ({ ...item })),
  };
}
