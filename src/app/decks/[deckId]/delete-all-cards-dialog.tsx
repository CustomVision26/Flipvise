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
            className="gap-1.5 text-destructive hover:text-destructive border-destructive/40 hover:border-destructive hover:bg-destructive/10"
          />
        }
      >
        <Trash2 className="size-4" />
        Delete All Cards
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete all cards?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove all{" "}
            <span className="font-semibold text-foreground">
              {cardCount} card{cardCount !== 1 ? "s" : ""}
            </span>{" "}
            from this deck. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAll}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting…" : "Delete All Cards"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
