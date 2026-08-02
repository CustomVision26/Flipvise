"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildLiveClassroomHref, LIVE_CLASSROOM_START_PATH } from "@/lib/live-classroom-url";
import type { LiveClassroomReportStats } from "@/lib/live-classroom-types";

type LiveClassroomReportActionsProps = {
  teamId: number;
  sessionName: string;
  stats: LiveClassroomReportStats;
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LiveClassroomReportActions({
  teamId,
  sessionName,
  stats,
}: LiveClassroomReportActionsProps) {
  const safeName = sessionName.replace(/[^\w\-]+/g, "_").slice(0, 64);

  function exportJsonAsPdfProxy() {
    // Structured text export — printable PDF generation can reuse teacher PDF pipeline later.
    const lines = [
      `Live Classroom™ Report`,
      `Session: ${sessionName}`,
      `Attendance: ${stats.attendance}`,
      `Accuracy: ${stats.accuracyPercent}%`,
      `Avg response: ${stats.averageResponseTimeSec}s`,
      `Strongest: ${stats.strongestTopic ?? "—"}`,
      `Weakest: ${stats.weakestTopic ?? "—"}`,
      "",
      "AI Summary",
      stats.aiTeacherSummary,
      "",
      "Recommendations",
      ...stats.recommendations.map((r) => `- ${r}`),
    ];
    downloadText(`${safeName}-report.txt`, lines.join("\n"), "text/plain");
    toast.success("Report exported (printable text)");
  }

  function exportExcelCsv() {
    const rows = [
      ["Type", "Name", "Score/Correct", "Accuracy%", "AvgResponseSec"],
      ...stats.teamStats.map((t) => [
        "team",
        t.teamName,
        String(t.score),
        String(t.accuracyPercent),
        String(t.avgResponseTimeSec),
      ]),
      ...stats.individualStats.map((p) => [
        "individual",
        p.displayName,
        `${p.correct}/${p.correct + p.incorrect}`,
        String(p.accuracyPercent),
        String(p.avgResponseTimeSec),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadText(`${safeName}-report.csv`, csv, "text/csv");
    toast.success("Excel-compatible CSV exported");
  }

  async function shareReport() {
    const text = `${sessionName}\n${stats.aiTeacherSummary}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: sessionName, text });
        return;
      }
    } catch {
      // fall through
    }
    await navigator.clipboard.writeText(text);
    toast.success("Summary copied to clipboard");
  }

  return (
    <Card className="border-border/80 bg-card/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Report actions</CardTitle>
        <CardDescription>
          Follow-up tools for remediation and sharing. Extensions (AI Recall
          deep-link, remediation deck builder) use the same report payload.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.message("Assign AI Recall™", {
              description:
                "Open Study → AI Recall on the remediation deck after you create it.",
            })
          }
        >
          Assign AI Recall™
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.message("Create Remediation Deck", {
              description:
                "Create a deck from the weakest topic on your Personal Dashboard, then assign it in Team Admin.",
            })
          }
        >
          Create Remediation Deck
        </Button>
        <Button variant="outline" size="sm" onClick={exportJsonAsPdfProxy}>
          Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportExcelCsv}>
          Export Excel
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          render={
            <Link
              href={buildLiveClassroomHref(LIVE_CLASSROOM_START_PATH, teamId)}
            />
          }
        >
          Schedule Follow-up Battle
        </Button>
        <Button variant="outline" size="sm" onClick={() => void shareReport()}>
          Share Report
        </Button>
      </CardContent>
    </Card>
  );
}
