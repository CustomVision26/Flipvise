import { notFound, redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { resolveIllustratedPageTheme } from "@/lib/illustrated-page-theme";
import { DeckAppearanceProvider } from "@/components/illustrated/deck-appearance-provider";

/**
 * One theme for every screen under this deck: editor, gallery, study modes,
 * quiz, and results. The theme comes from the deck record, not from card text.
 */
export default async function DeckLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ deckId: string }>;
}) {
  const { userId } = await getAccessContext();
  if (!userId) redirect("/");

  const { deckId } = await params;
  const id = Number(deckId);
  if (!Number.isFinite(id)) notFound();

  const bundle = await getDeckWithViewerAccess(id, userId);
  if (!bundle) notFound();

  const theme = resolveIllustratedPageTheme({
    name: bundle.deck.name,
    description: bundle.deck.description,
    gradeLevel: bundle.deck.gradeLevel,
  });

  return (
    <DeckAppearanceProvider deckId={id} theme={theme}>
      {children}
    </DeckAppearanceProvider>
  );
}
