"use client";

import { useTransition } from "react";
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
import { deleteAllCardsAction } from "@/actions/cards";

interface DeleteAllCardsDialogProps {
  deckId: number;
  cardCount: number;
}

export function DeleteAllCardsDialog({ deckId, cardCount }: DeleteAllCardsDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleDeleteAll() {
    startTransition(async () => {
      await deleteAllCardsAction({ deckId });
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" />
        Delete all
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">Delete all cards?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs sm:text-sm">
            This will permanently remove all{" "}
            <span className="font-semibold text-foreground">
              {cardCount} card{cardCount !== 1 ? "s" : ""}
            </span>{" "}
            from this deck. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isPending} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
          >
            {isPending ? "Deleting…" : "Delete All Cards"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
