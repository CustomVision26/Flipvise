import { requireAiDocumentStudioAccess } from "@/lib/ai-document-studio-access";

/**
 * AI Document Studio shell — available when any document-type add-on
 * (e.g. AI Essay) is Stripe-paid or admin/team assigned.
 */
export default async function AiDocumentStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAiDocumentStudioAccess("page");
  return children;
}
