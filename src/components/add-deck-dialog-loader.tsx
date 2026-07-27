"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { AddDeckDialogProps } from "@/components/add-deck-dialog";

/**
 * Client-only loader so Turbopack SSR cannot fail the whole /dashboard page with
 * "module factory is not available" for add-deck-dialog (app-ssr).
 */
const AddDeckDialog = dynamic(
  () =>
    import("@/components/add-deck-dialog").then((mod) => mod.AddDeckDialog),
  {
    ssr: false,
    loading: () => (
      <Button type="button" disabled>
        Add Deck
      </Button>
    ),
  },
);

export function AddDeckDialogLoader(props: AddDeckDialogProps) {
  return <AddDeckDialog {...props} />;
}
