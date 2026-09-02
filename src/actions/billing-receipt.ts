"use server";

import { z } from "zod";
import { auth as clerkAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
import { loadFlipviseInvoiceReceipt } from "@/lib/flipvise-invoice-receipt";
import { generateFlipviseInvoiceReceiptPdf } from "@/lib/flipvise-invoice-receipt-pdf";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const downloadSchema = z.object({
  invoiceRef: z.string().trim().min(1).max(255),
});

export async function downloadFlipviseInvoiceReceiptPdfAction(
  data: z.infer<typeof downloadSchema>,
) {
  const parsed = downloadSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid invoice");

  const { userId } = await clerkAuth();
  if (!userId) throw new Error("Unauthorized");

  const access = await getAccessContext();
  let userEmail: string | null = access.primaryEmail;
  if (!userEmail) {
    try {
      const user = await clerkClient.users.getUser(userId);
      userEmail =
        user.primaryEmailAddress?.emailAddress?.toLowerCase() ??
        user.emailAddresses[0]?.emailAddress?.toLowerCase() ??
        null;
    } catch {
      userEmail = null;
    }
  }

  const receipt = await loadFlipviseInvoiceReceipt({
    ref: parsed.data.invoiceRef,
    userId,
    userEmail,
    isAdmin: access.isAdmin || access.isSuperadmin,
  });
  if (!receipt) throw new Error("Invoice not found");

  const pdf = await generateFlipviseInvoiceReceiptPdf(receipt);
  const filename = `Flipvise-${receipt.title.toLowerCase()}-${receipt.invoiceNumber ?? receipt.externalId}.pdf`;
  return {
    filename,
    base64: pdf.toString("base64"),
  };
}
