import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { buttonVariants } from "@/components/ui/button";
import { FlipviseInvoiceReceiptView } from "@/components/flipvise-invoice-receipt-view";
import { getAccessContext } from "@/lib/access";
import { loadFlipviseInvoiceReceipt } from "@/lib/flipvise-invoice-receipt";

export default async function FlipviseBillingReceiptPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId: raw } = await params;
  const invoiceId = decodeURIComponent(raw ?? "").trim();
  if (!invoiceId) notFound();

  const { userId } = await auth();
  if (!userId) redirect("/");

  const access = await getAccessContext();
  const receipt = await loadFlipviseInvoiceReceipt({
    ref: invoiceId,
    userId,
    userEmail: access.primaryEmail,
    isAdmin: access.isAdmin || access.isSuperadmin,
  });
  if (!receipt) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/dashboard/inbox"
        className={buttonVariants({ variant: "ghost", size: "sm", className: "gap-2" })}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Inbox
      </Link>
      <FlipviseInvoiceReceiptView receipt={receipt} />
    </div>
  );
}
