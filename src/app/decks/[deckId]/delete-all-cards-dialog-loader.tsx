"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type DeleteAllCardsDialogLoaderProps = {
  deckId: number;
  cardCount: number;
};

const DeleteAllCardsDialogDynamic = dynamic<DeleteAllCardsDialogLoaderProps>(
  () =>
    import("./delete-all-cards-dialog").then((m) => m.DeleteAllCardsDialog),
  {
    // Avoids Turbopack dev SSR "module factory is not available" for this client tree.
    ssr: false,
    loading: () => <Skeleton className="h-9 w-[7.25rem] rounded-md" />,
  },
);

export function DeleteAllCardsDialogLoader(props: DeleteAllCardsDialogLoaderProps) {
  return <DeleteAllCardsDialogDynamic {...props} />;
}
