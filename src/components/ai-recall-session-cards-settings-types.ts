export type AiRecallSessionCardDeckRow = {
  id: number;
  name: string;
  /** null = inherit; 0 = all; 1–100 = fixed */
  aiRecallSessionCardCount: number | null;
};

export type AiRecallSessionCardsSettingsProps = {
  teamId: number;
  initialWorkspaceCardCount: number | null;
  decks: AiRecallSessionCardDeckRow[];
};
