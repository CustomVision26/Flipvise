"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFlipviseInvoiceReceiptPdfAction } from "@/actions/billing-receipt";

export function FlipviseInvoiceReceiptPdfButton({
  invoiceRef,
}: {
  invoiceRef: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await downloadFlipviseInvoiceReceiptPdfAction({
            invoiceRef,
          });
          const binary = atob(result.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const url = URL.createObjectURL(
            new Blob([bytes], { type: "application/pdf" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = result.filename;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Could not download receipt.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Download className="size-3.5" aria-hidden />
      )}
      Download PDF
    </Button>
  );
}
