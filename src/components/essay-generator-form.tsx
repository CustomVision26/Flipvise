"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { generateEssayAction } from "@/actions/essay";
import { ESSAY_TYPES, type EssayType } from "@/lib/essay-ai-schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EssayGeneratorForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [subject, setSubject] = React.useState("");
  const [gradeLevel, setGradeLevel] = React.useState("");
  const [essayType, setEssayType] = React.useState<EssayType>("argumentative");
  const [difficultyLevel, setDifficultyLevel] = React.useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [topic, setTopic] = React.useState("");
  const [learningStandard, setLearningStandard] = React.useState("");
  const [wordCount, setWordCount] = React.useState(500);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(0);
  const [includeVocabulary, setIncludeVocabulary] = React.useState(true);
  const [includeOutline, setIncludeOutline] = React.useState(true);
  const [includeRubric, setIncludeRubric] = React.useState(true);
  const [includeModelEssay, setIncludeModelEssay] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { documentId } = await generateEssayAction({
        subject,
        gradeLevel,
        essayType,
        difficultyLevel,
        topic,
        learningStandard,
        wordCount,
        timeLimitMinutes,
        includeVocabulary,
        includeOutline,
        includeRubric,
        includeModelEssay,
      });
      router.push(`/dashboard/essay/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate AI Essay</CardTitle>
        <CardDescription>
          Create an essay activity with prompt, outline, vocabulary, and optional rubric.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="essay-subject">Subject</Label>
            <Input
              id="essay-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="essay-grade">Grade</Label>
            <Input
              id="essay-grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              required
              maxLength={64}
              placeholder="e.g. Grade 8"
            />
          </div>
          <div className="space-y-2">
            <Label>Essay Type</Label>
            <Select
              value={essayType}
              onValueChange={(v) => setEssayType(v as EssayType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESSAY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select
              value={difficultyLevel}
              onValueChange={(v) =>
                setDifficultyLevel(v as "easy" | "medium" | "hard")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="essay-topic">Topic</Label>
            <Textarea
              id="essay-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              rows={2}
              maxLength={512}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="essay-standard">Learning Standard (optional)</Label>
            <Input
              id="essay-standard"
              value={learningStandard}
              onChange={(e) => setLearningStandard(e.target.value)}
              maxLength={512}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="essay-words">Word Count</Label>
            <Input
              id="essay-words"
              type="number"
              min={100}
              max={5000}
              value={wordCount}
              onChange={(e) => setWordCount(Number(e.target.value) || 500)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="essay-time">Time Limit (minutes, 0 = none)</Label>
            <Input
              id="essay-time"
              type="number"
              min={0}
              max={240}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value) || 0)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2">
            {(
              [
                ["includeVocabulary", includeVocabulary, setIncludeVocabulary, "Include Vocabulary"],
                ["includeOutline", includeOutline, setIncludeOutline, "Include Outline"],
                ["includeRubric", includeRubric, setIncludeRubric, "Include Rubric"],
                [
                  "includeModelEssay",
                  includeModelEssay,
                  setIncludeModelEssay,
                  "Include Model Essay (hidden until revealed)",
                ],
              ] as const
            ).map(([id, checked, setChecked, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                  id={id}
                />
                {label}
              </label>
            ))}
          </div>

          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
