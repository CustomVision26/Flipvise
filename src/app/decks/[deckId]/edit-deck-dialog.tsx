"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateDeckAction } from "@/actions/decks";

interface EditDeckDialogProps {
  deck: { id: number; name: string; description: string | null };
}

export function EditDeckDialog({ deck }: EditDeckDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName(deck.name);
      setDescription(deck.description ?? "");
      setError(null);
    }
    setOpen(next);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateDeckAction({
          deckId: deck.id,
          name,
          description: description.trim() || undefined,
        });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4" />}>
        Edit Deck
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit deck</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update the name and description of this deck.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-name" className="text-xs sm:text-sm">Name</Label>
            <Input
              id="deck-name"
              placeholder="Deck name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-description" className="text-xs sm:text-sm">Description</Label>
            <Textarea
              id="deck-description"
              placeholder="Optional description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isPending}
              className="text-sm"
            />
          </div>
          {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="w-full sm:w-auto"
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
