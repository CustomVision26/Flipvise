"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { IllustratedPageBackground } from "@/components/illustrated/illustrated-page-background";
import type { IllustratedPageTheme } from "@/lib/illustrated-page-theme";

/** How much gutter art the current deck screen should show. */
export type DeckScreenContext =
  | "deck"
  | "prep"
  | "study"
  | "quiz-live"
  | "results";

type DeckAppearanceValue = {
  deckId: number;
  theme: IllustratedPageTheme;
  /** False while the route deck id and the loaded theme disagree. */
  themeReady: boolean;
  screen: DeckScreenContext;
  setScreen: (screen: DeckScreenContext) => void;
  effectiveIllustratedDesign: boolean;
  effectiveReducedMotion: boolean;
};

const DeckAppearanceContext = createContext<DeckAppearanceValue | null>(null);

export function useDeckAppearance(): DeckAppearanceValue | null {
  return useContext(DeckAppearanceContext);
}

/**
 * Marks the current deck screen so the shared background can change intensity
 * without remounting the study controller.
 */
export function useDeckScreen(screen: DeckScreenContext) {
  const appearance = useDeckAppearance();
  const setScreen = appearance?.setScreen;
  useEffect(() => {
    if (!setScreen) return;
    setScreen(screen);
    return () => setScreen("deck");
  }, [screen, setScreen]);
}

function NeutralDeckBackground() {
  return (
    <div className="illustrated-page-bg" data-illustrated-theme="pending" aria-hidden>
      <div className="illustrated-page-bg-base" style={{ background: "#0b1220" }} />
    </div>
  );
}

export function DeckAppearanceProvider({
  deckId,
  theme,
  children,
}: {
  deckId: number;
  theme: IllustratedPageTheme;
  children: ReactNode;
}) {
  const params = useParams<{ deckId?: string }>();
  const { effectiveIllustratedDesign, effectiveReducedMotion } =
    useIllustratedAppearance();
  const [screen, setScreenState] = useState<DeckScreenContext>("deck");
  const setScreen = useCallback((next: DeckScreenContext) => {
    setScreenState((current) => (current === next ? current : next));
  }, []);

  const routeDeckId = Number(params?.deckId);
  const themeReady = !Number.isFinite(routeDeckId) || routeDeckId === deckId;

  const value = useMemo<DeckAppearanceValue>(
    () => ({
      deckId,
      theme,
      themeReady,
      screen,
      setScreen,
      effectiveIllustratedDesign,
      effectiveReducedMotion,
    }),
    [
      deckId,
      theme,
      themeReady,
      screen,
      setScreen,
      effectiveIllustratedDesign,
      effectiveReducedMotion,
    ],
  );

  return (
    <DeckAppearanceContext.Provider value={value}>
      <div
        className="illustrated-page relative flex min-h-0 flex-1 flex-col"
        data-deck-id={deckId}
        data-deck-theme={themeReady ? theme.subject : "pending"}
        data-deck-screen={screen}
      >
        {effectiveIllustratedDesign ? (
          themeReady ? (
            <IllustratedPageBackground theme={theme} />
          ) : (
            <NeutralDeckBackground />
          )
        ) : null}
        {children}
      </div>
    </DeckAppearanceContext.Provider>
  );
}
