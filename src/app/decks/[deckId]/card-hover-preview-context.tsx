"use client";

import { createContext, useContext } from "react";

type CardHoverPreviewContextValue = {
  closeHover: () => void;
};

const CardHoverPreviewContext = createContext<CardHoverPreviewContextValue | null>(
  null,
);

export function CardHoverPreviewProvider({
  closeHover,
  children,
}: {
  closeHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <CardHoverPreviewContext.Provider value={{ closeHover }}>
      {children}
    </CardHoverPreviewContext.Provider>
  );
}

export function useCardHoverPreview() {
  return useContext(CardHoverPreviewContext);
}
