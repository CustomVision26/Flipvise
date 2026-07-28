"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getHomeworkPassageSections,
  stripOrderedListPrefix,
} from "@/lib/homework-list-items";
import {
  isRenderableHomeworkAnswerGraph,
  renderHomeworkAnswerGraphToSvg,
  type HomeworkAnswerGraph,
} from "@/lib/homework-answer-graph";
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

function HomeworkAnswerGraphFigure({
  graph,
}: {
  graph: HomeworkAnswerGraph | null | undefined;
}) {
  if (!graph || !isRenderableHomeworkAnswerGraph(graph)) return null;
  const svg = renderHomeworkAnswerGraphToSvg(graph);
  if (!svg) return null;
  return (
    <div
      className="mt-2 max-w-xl rounded-md border border-border/60 bg-background p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function HomeworkPassageBlock({
  passageTitle,
  passage,
  index,
  total,
}: {
  passageTitle?: string | null;
  passage: string;
  index: number;
  total: number;
}) {
  const heading = passageTitle?.trim()
    ? `Passage Title: ${passageTitle.trim()}`
    : total > 1
      ? `Reading Passage ${index + 1}`
      : "Reading Passage";

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
      <p className="text-sm font-medium text-foreground">{heading}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {passage}
      </p>
    </div>
  );
}

function HomeworkReadOnly({ result }: { result: HomeworkResult }) {
  const sections = getHomeworkPassageSections(result);
  const hasPassageBodies = sections.some((section) => section.body.trim());

  return (
    <div className="space-y-4 text-foreground">
      <p className="font-medium">{result.assignmentTitle}</p>
      <p>{result.instructions}</p>

      {hasPassageBodies ? (
        sections.map((section, index) => (
          <div key={`section-${index}`} className="space-y-3">
            {section.body.trim() ? (
              <HomeworkPassageBlock
                passageTitle={section.title}
                passage={section.body}
                index={index}
                total={sections.filter((item) => item.body.trim()).length}
              />
            ) : null}
            {section.questions.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5" start={section.questionNumbers[0]}>
                {section.questions.map((question, qIndex) => (
                  <li key={`${section.questionNumbers[qIndex]}-${question}`}>
                    {question}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ))
      ) : (
        <ol className="list-decimal space-y-1 pl-5">
          {result.questions.map((question, index) => (
            <li key={`${index}-${question}`}>{question}</li>
          ))}
        </ol>
      )}

      <div>
        <p className="font-medium text-foreground">Answer Key</p>
        <ol className="list-decimal space-y-3 pl-5">
          {result.answerKey.map((answer, index) => (
            <li key={`${index}-${answer}`}>
              <p>{answer}</p>
              <HomeworkAnswerGraphFigure graph={result.answerGraphs?.[index]} />
            </li>
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

  const passagesText = (draft.passages ?? [])
    .map((passage, index) => {
      const title = passage.title?.trim() || `Passage ${index + 1}`;
      return `=== ${title} ===\n${passage.body.trim()}`;
    })
    .join("\n\n");

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
        <Label htmlFor="edit-homework-passages">Reading passages</Label>
        <Textarea
          id="edit-homework-passages"
          value={
            passagesText ||
            (draft.passage?.trim()
              ? `=== ${draft.passageTitle?.trim() || "Passage"} ===\n${draft.passage.trim()}`
              : "")
          }
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!raw) {
              patch({
                passages: null,
                passageQuestionCounts: null,
                passage: null,
                passageTitle: null,
              });
              return;
            }

            const passages: NonNullable<HomeworkResult["passages"]> = [];
            const lines = raw.split(/\r?\n/);
            let currentTitle: string | undefined;
            let currentBody: string[] = [];

            function flush() {
              const body = currentBody.join("\n").trim();
              if (!body) {
                currentTitle = undefined;
                currentBody = [];
                return;
              }
              passages.push({
                body,
                title: currentTitle ?? null,
              });
              currentTitle = undefined;
              currentBody = [];
            }

            for (const line of lines) {
              const titleMatch = /^===\s*(.+?)\s*===\s*$/.exec(line.trim());
              if (titleMatch) {
                flush();
                currentTitle = titleMatch[1]?.trim() || undefined;
                continue;
              }
              currentBody.push(line);
            }
            flush();

            if (passages.length > 0) {
              patch({
                passages,
                passage: passages[0]!.body,
                passageTitle: passages[0]!.title ?? null,
              });
              return;
            }

            patch({
              passages: [{ body: raw }],
              passage: raw,
              passageTitle: null,
            });
          }}
          rows={10}
          className="bg-background text-foreground"
          placeholder={`=== Passage Title ===\nFull passage text…\n\n=== Another Title ===\nSecond passage…`}
        />
        <p className="text-xs text-muted-foreground">
          Separate passages with a title line like{" "}
          <span className="font-medium">=== My Title ===</span>. Questions stay in
          the list below in passage order.
        </p>
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
        <p className="text-xs text-muted-foreground">
          One question per line, in passage order
        </p>
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
    passages: result.passages?.map((passage) => ({ ...passage })),
    passageQuestionCounts: result.passageQuestionCounts
      ? [...result.passageQuestionCounts]
      : result.passageQuestionCounts,
    questions: [...result.questions],
    answerKey: [...result.answerKey],
    answerGraphs: result.answerGraphs?.map((graph) => ({
      ...graph,
      points: graph.points?.map((point) => ({ ...point })) ?? null,
      lines: graph.lines?.map((line) => ({ ...line })) ?? null,
    })),
  };
}
