"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteDeckAction } from "@/actions/decks";

interface DeleteDeckButtonProps {
  deckId: number;
  deckName: string;
}

export function DeleteDeckButton({ deckId, deckName }: DeleteDeckButtonProps) {
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    setIsPending(true);
    try {
      await deleteDeckAction({ deckId });
    } catch {
      // revalidatePath handles UI update on success; error is silent for now
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${deckName}`}
            onClick={(e) => e.preventDefault()}
          />
        }
      >
        <Trash2 className="size-4" />
      </AlertDialogTrigger>

      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">Delete &ldquo;{deckName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs sm:text-sm">
            This will permanently delete the deck and all of its cards. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
            className="w-full sm:w-auto"
          >
            {isPending ? "Deleting…" : "Delete Deck"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
