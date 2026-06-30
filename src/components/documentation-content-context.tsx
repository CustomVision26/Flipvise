"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DocPage, DocSection } from "@/lib/documentation-content-types";
import type { DocArticle } from "@/lib/user-documentation-article-types";
import type { DocumentationAudience } from "@/db/queries/documentation-overrides";

export type DocumentationContentValue = {
  audience: DocumentationAudience;
  sections: DocSection[];
  getArticle: (pageId: string) => DocArticle | null;
  hasArticle: (pageId: string) => boolean;
  articleCount: number;
};

export type DocumentationEditValue = {
  enabled: boolean;
  onEditPage: (page: DocPage) => void;
  onEditArticle: (args: { page: DocPage; article: DocArticle }) => void;
};

const DocumentationContentContext = createContext<DocumentationContentValue | null>(null);
const DocumentationEditContext = createContext<DocumentationEditValue | null>(null);

export function DocumentationContentProvider({
  value,
  children,
}: {
  value: DocumentationContentValue;
  children: ReactNode;
}) {
  return (
    <DocumentationContentContext.Provider value={value}>
      {children}
    </DocumentationContentContext.Provider>
  );
}

export function DocumentationEditProvider({
  value,
  children,
}: {
  value: DocumentationEditValue | null;
  children: ReactNode;
}) {
  return (
    <DocumentationEditContext.Provider value={value}>
      {children}
    </DocumentationEditContext.Provider>
  );
}

export function useDocumentationContentOptional() {
  return useContext(DocumentationContentContext);
}

export function useDocumentationEditOptional() {
  return useContext(DocumentationEditContext);
}
