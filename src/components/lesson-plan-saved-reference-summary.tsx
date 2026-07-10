import { FileText } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { LessonPlanReferenceMaterial } from "@/lib/lesson-plan-reference-material";

type LessonPlanSavedReferenceSummaryProps = {
  references: LessonPlanReferenceMaterial[];
  description?: string;
};

export function LessonPlanSavedReferenceSummary({
  references,
  description = "These references from the linked lesson plan are included when generating content.",
}: LessonPlanSavedReferenceSummaryProps) {
  if (references.length === 0) return null;

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Saved reference materials</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <ul className="space-y-2">
        {references.map((reference, index) => (
          <li
            key={`${reference.summary}-${index}`}
            className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-foreground">
              {reference.summary.trim() || `Reference ${index + 1}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
