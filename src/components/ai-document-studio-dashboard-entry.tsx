import Link from "next/link";
import { FileStack } from "lucide-react";
import { DOCUMENT_STUDIO_TITLE } from "@/lib/document-generation-studio";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Personal-dashboard entry for AI Document Studio.
 * Only render when the user has at least one document-type add-on active.
 */
export function AiDocumentStudioDashboardEntry() {
  return (
    <Link
      href={AI_DOC_STUDIO_BASE}
      className={cn(
        buttonVariants({ size: "sm" }),
        "h-9 gap-2 bg-teal-600 text-white shadow-md shadow-teal-900/40 hover:bg-teal-600/90",
      )}
      title={`${DOCUMENT_STUDIO_TITLE} — open unlocked document types`}
    >
      <FileStack className="size-4 shrink-0" aria-hidden />
      <span>{DOCUMENT_STUDIO_TITLE}</span>
    </Link>
  );
}
