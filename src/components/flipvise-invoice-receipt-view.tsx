import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { LOGO_PUBLIC_URL } from "@/lib/branding";
import type { FlipviseInvoiceReceipt } from "@/lib/flipvise-invoice-receipt";
import { FlipviseInvoiceReceiptPdfButton } from "@/components/flipvise-invoice-receipt-pdf-button";

export function FlipviseInvoiceReceiptView({
  receipt,
}: {
  receipt: FlipviseInvoiceReceipt;
}) {
  const [sellerName, ...sellerRest] = receipt.sellerLines;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {receipt.title}
          </h1>
          <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
            {receipt.invoiceNumber ? (
              <div>
                <dt className="inline">Invoice number: </dt>
                <dd className="inline text-foreground">{receipt.invoiceNumber}</dd>
              </div>
            ) : null}
            {receipt.receiptNumber ? (
              <div>
                <dt className="inline">Receipt number: </dt>
                <dd className="inline text-foreground">{receipt.receiptNumber}</dd>
              </div>
            ) : null}
            {receipt.datePaidLabel ? (
              <div>
                <dt className="inline">Date paid: </dt>
                <dd className="inline text-foreground">{receipt.datePaidLabel}</dd>
              </div>
            ) : null}
            {receipt.planPeriodStartLabel ? (
              <div>
                <dt className="inline">Plan starts: </dt>
                <dd className="inline text-foreground">{receipt.planPeriodStartLabel}</dd>
              </div>
            ) : null}
            {receipt.planPeriodEndLabel ? (
              <div>
                <dt className="inline">Plan ends: </dt>
                <dd className="inline text-foreground">{receipt.planPeriodEndLabel}</dd>
              </div>
            ) : null}
            {receipt.autoRenewalOn != null ? (
              <div className="flex items-center gap-2 pt-1">
                <dt className="inline">Auto-renewal: </dt>
                <dd className="inline">
                  <Badge variant={receipt.autoRenewalOn ? "secondary" : "outline"}>
                    {receipt.autoRenewalOn ? "On" : "Off"}
                  </Badge>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <Image
          src={LOGO_PUBLIC_URL}
          alt="Flipvise"
          width={160}
          height={60}
          className="h-12 w-auto object-contain"
          unoptimized
        />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{sellerName}</p>
            {sellerRest.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bill to
            </p>
            {receipt.billToName ? (
              <p className="font-medium text-foreground">{receipt.billToName}</p>
            ) : null}
            {receipt.billToLines.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
            {receipt.billToEmail ? (
              <p className="text-muted-foreground">{receipt.billToEmail}</p>
            ) : null}
          </div>
        </div>

        <p className="text-lg font-semibold text-foreground">
          {receipt.paid
            ? `${receipt.amountPaidLabel} paid${receipt.datePaidLabel ? ` on ${receipt.datePaidLabel}` : ""}`
            : `${receipt.amountPaidLabel} due`}
        </p>
        {receipt.autoRenewalOn != null ? (
          <p className="text-sm text-muted-foreground">
            {receipt.autoRenewalOn && receipt.planPeriodEndLabel
              ? `Auto-renewal is on. This plan renews on ${receipt.planPeriodEndLabel} unless you cancel.`
              : !receipt.autoRenewalOn && receipt.planPeriodEndLabel
                ? `Auto-renewal is off. Access ends on ${receipt.planPeriodEndLabel}.`
                : receipt.autoRenewalOn
                  ? "Auto-renewal is on."
                  : "Auto-renewal is off."}
          </p>
        ) : null}

        {receipt.lines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.lines.map((line) => (
                <TableRow key={`${line.description}-${line.amountLabel}`}>
                  <TableCell className="whitespace-normal text-foreground">
                    {line.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {line.quantity ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">
                    {line.amountLabel}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        <Separator />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {receipt.paid ? "Amount paid" : "Amount due"}
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {receipt.amountPaidLabel}
          </p>
        </div>

        <FlipviseInvoiceReceiptPdfButton invoiceRef={receipt.externalId} />
      </CardContent>
    </Card>
  );
}
