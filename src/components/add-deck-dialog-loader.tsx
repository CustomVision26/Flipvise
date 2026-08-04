"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import type { AddDeckDialogProps } from "@/components/add-deck-dialog-types";

/**
 * Client-only loader so Turbopack SSR cannot fail the page with
 * "module factory is not available" for add-deck-dialog (app-ssr).
 * Props types live in a separate module so this file never pulls in add-deck-dialog
 * during SSR module graph evaluation.
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
