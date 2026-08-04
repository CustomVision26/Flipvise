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
 * Shown when a workspace member (not the plan owner) opens AI Essay.
 * Member assignment of AI Essay is not available yet.
 */
export function AiEssayComingSoon() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">AI Essay</CardTitle>
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3" aria-hidden />
              Coming soon
            </Badge>
          </div>
          <CardDescription className="text-sm leading-relaxed">
            AI Essay is available in the system as an add-on, but workspace member
            access is coming soon. Right now only the plan owner can use AI Essay
            on their personal dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Ask your workspace owner if you need writing tools today, or check
            back when member add-ons for AI Essay ship.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
