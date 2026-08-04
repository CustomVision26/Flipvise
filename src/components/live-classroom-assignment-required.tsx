import Link from "next/link";
import { UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LiveClassroomAssignmentRequired({
  teamName,
}: {
  teamName?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <UserRoundX className="size-5" aria-hidden />
          </div>
          <CardTitle className="text-xl tracking-tight">
            Live Classroom™ assignment required
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {teamName
              ? `You are a member of ${teamName}, but you are not assigned to the Live Classroom™ team.`
              : "You are not assigned to the Live Classroom™ team for this workspace."}{" "}
            Ask the subscription owner or a team administrator to assign you
            under Live Classroom™ → Settings. Workspace membership alone does
            not grant access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/dashboard" />}
          >
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
