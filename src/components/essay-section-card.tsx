"use client";

import type { EssaySection } from "@/lib/essay-ai-schema";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

type EssaySectionCardProps = {
  section: EssaySection;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  largeText?: boolean;
};

export function EssaySectionCard({
  section,
  value,
  onChange,
  disabled = false,
  largeText = false,
}: EssaySectionCardProps) {
  const words = countWords(value);
  const textSize = largeText ? "text-base leading-relaxed" : "text-sm";
  const hasPlanning =
    section.planningGoal ||
    section.planningKeyIdea ||
    section.planningEvidence;

  return (
    <Card
      size="sm"
      className="bg-muted/20"
      aria-label={`Essay section: ${section.title}`}
    >
      <CardHeader className="gap-2">
        <div className="flex min-w-0 flex-wrap items-start gap-2">
          <CardTitle
            className={`min-w-0 flex-1 break-words ${largeText ? "text-base" : "text-sm"}`}
          >
            {section.title}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 capitalize">
            {section.type}
          </Badge>
        </div>
        <CardDescription className={textSize}>
          {section.instructions}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPlanning ? (
          <div className={`space-y-2 rounded-md border border-border bg-muted/40 p-3 ${textSize}`}>
            {section.planningGoal ? (
              <p>
                <span className="font-medium text-foreground">Goal: </span>
                <span className="text-muted-foreground">
                  {section.planningGoal}
                </span>
              </p>
            ) : null}
            {section.planningKeyIdea ? (
              <p>
                <span className="font-medium text-foreground">Key idea: </span>
                <span className="text-muted-foreground">
                  {section.planningKeyIdea}
                </span>
              </p>
            ) : null}
            {section.planningEvidence ? (
              <p>
                <span className="font-medium text-foreground">Evidence: </span>
                <span className="text-muted-foreground">
                  {section.planningEvidence}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {section.sentenceStarters && section.sentenceStarters.length > 0 ? (
          <div className="space-y-1">
            <p className={`font-medium text-foreground ${textSize}`}>
              Sentence starters
            </p>
            <ul
              className={`list-disc space-y-0.5 pl-4 text-muted-foreground ${textSize}`}
            >
              {section.sentenceStarters.map((starter) => (
                <li key={starter}>{starter}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {section.transitionWords && section.transitionWords.length > 0 ? (
          <div className="space-y-1">
            <p className={`font-medium text-foreground ${textSize}`}>
              Transitions
            </p>
            <p className={`text-muted-foreground ${textSize}`}>
              {section.transitionWords.join(" · ")}
            </p>
          </div>
        ) : null}

        {section.checklist && section.checklist.length > 0 ? (
          <div className="space-y-1">
            <p className={`font-medium text-foreground ${textSize}`}>
              Checklist
            </p>
            <ul
              className={`list-disc space-y-0.5 pl-4 text-muted-foreground ${textSize}`}
            >
              {section.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {section.teacherNotes ? (
          <div
            className={`rounded-md border border-border/70 bg-muted/40 px-3 py-2 ${textSize}`}
          >
            <p className="font-medium text-foreground">Construction tip</p>
            <p className={`mt-1 text-muted-foreground ${textSize}`}>
              {section.teacherNotes.replace(
                /^Construction tip\s*[—–-]\s*[^:]+:\s*/i,
                "",
              )}
            </p>
          </div>
        ) : null}

        <Separator />

        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={largeText ? 10 : 8}
            placeholder="Write this section here…"
            className={textSize}
            aria-label={`Writing area for ${section.title}`}
          />
          <p className="text-xs text-muted-foreground">
            {words} word{words === 1 ? "" : "s"}
            {section.estimatedWords
              ? ` · target ~${section.estimatedWords}`
              : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
