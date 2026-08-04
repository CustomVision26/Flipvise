import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Member add-ons surface. AI Essay is not assignable to workspace members yet —
 * only the plan owner may use it on their personal dashboard.
 */
export function TeamAdminAddonsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned Features</CardTitle>
        <CardDescription>
          Optional premium features for workspace members. Member assignment for
          AI Essay is not available yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">AI Essay</p>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Clock className="size-3" aria-hidden />
              Coming soon
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            AI Essay is available as a system add-on for the plan owner on their
            personal dashboard only. Assigning AI Essay to workspace members is
            coming soon — member access shows the same Coming soon message.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Organization add-on (purchased by the subscription owner via Pricing):{" "}
          Live Classroom™. Coming soon (same member permission model): AI Recall ·
          Battle Mode · Presentation Generator · Math Diagram Generator
        </p>
      </CardContent>
    </Card>
  );
}
