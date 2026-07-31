"use client";

import {
  EssayCitationFormattingPool,
  type SubmittedEssayPoolItem,
} from "@/components/essay-citation-formatting-pool";
import {
  EssayCitationFormattedTable,
  type CitationFormattedEssayRow,
} from "@/components/essay-citation-formatted-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EssayCitationFormattingTabsProps = {
  essays: SubmittedEssayPoolItem[];
  submittedDocuments: CitationFormattedEssayRow[];
  defaultTab?: "format" | "formatted";
  initialEssayId?: number | null;
  initialEditMode?: boolean;
};

export function EssayCitationFormattingTabs({
  essays,
  submittedDocuments,
  defaultTab = "format",
  initialEssayId = null,
  initialEditMode = false,
}: EssayCitationFormattingTabsProps) {
  return (
    <Tabs
      key={`citation-tabs-${defaultTab}-${initialEssayId ?? "none"}-${initialEditMode ? "edit" : "view"}`}
      defaultValue={defaultTab}
      className="gap-0"
    >
      <TabsList
        variant="line"
        className="h-auto w-full justify-start rounded-none border-b border-border/60"
      >
        <TabsTrigger value="format" className="flex-none px-3 py-2.5">
          Format essay
        </TabsTrigger>
        <TabsTrigger value="formatted" className="flex-none px-3 py-2.5">
          Formatted papers
          {submittedDocuments.length > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              {submittedDocuments.length}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="format" className="mt-5">
        <EssayCitationFormattingPool
          key={
            initialEssayId != null
              ? `essay-${initialEssayId}-edit-${initialEditMode ? "1" : "0"}`
              : "citation-pool"
          }
          essays={essays}
          initialEssayId={initialEssayId}
          initialEditMode={initialEditMode}
        />
      </TabsContent>

      <TabsContent value="formatted" className="mt-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Papers with a citation style applied and a saved formatted preview.
        </p>
        <EssayCitationFormattedTable documents={submittedDocuments} />
      </TabsContent>
    </Tabs>
  );
}
