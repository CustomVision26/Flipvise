import Link from "next/link";
import { Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LiveClassroomUnlock({
  teamName,
}: {
  teamName?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Presentation className="size-5" aria-hidden />
          </div>
          <CardTitle className="text-xl tracking-tight">
            Unlock Live Classroom™
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {teamName
              ? `${teamName} does not have the Live Classroom™ organization add-on yet.`
              : "Your organization does not have the Live Classroom™ add-on yet."}{" "}
            The subscription owner can purchase it from Pricing, then enable it
            under Team Admin add-ons.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            nativeButton={false}
            render={<Link href="/pricing/add-ons" />}
          >
            View pricing
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/dashboard/team-admin/add-ons" />}
          >
            Team Admin add-ons
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
