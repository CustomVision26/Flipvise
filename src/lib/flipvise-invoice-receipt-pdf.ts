import type { FlipviseInvoiceReceipt } from "@/lib/flipvise-invoice-receipt";

export async function generateFlipviseInvoiceReceiptPdf(
  receipt: FlipviseInvoiceReceipt,
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text(receipt.title, margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (receipt.invoiceNumber) {
    doc.text(`Invoice number: ${receipt.invoiceNumber}`, margin, y);
    y += 14;
  }
  if (receipt.receiptNumber) {
    doc.text(`Receipt number: ${receipt.receiptNumber}`, margin, y);
    y += 14;
  }
  if (receipt.datePaidLabel) {
    doc.text(`Date paid: ${receipt.datePaidLabel}`, margin, y);
    y += 22;
  } else {
    y += 8;
  }

  const colW = (pageW - margin * 2 - 24) / 2;
  let sellerY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(receipt.sellerLines[0] ?? "Flipvise Studio LLC", margin, sellerY);
  sellerY += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50);
  for (const line of receipt.sellerLines.slice(1)) {
    doc.text(line, margin, sellerY);
    sellerY += 13;
  }

  let billY = y;
  const billX = margin + colW + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Bill to", billX, billY);
  billY += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  if (receipt.billToName) {
    doc.text(receipt.billToName, billX, billY);
    billY += 14;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50);
  for (const line of receipt.billToLines) {
    const wrapped = doc.splitTextToSize(line, colW);
    doc.text(wrapped, billX, billY);
    billY += 13 * wrapped.length;
  }
  if (receipt.billToEmail) {
    doc.text(receipt.billToEmail, billX, billY);
    billY += 13;
  }

  y = Math.max(sellerY, billY) + 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  const paidLine = receipt.paid
    ? `${receipt.amountPaidLabel} paid${receipt.datePaidLabel ? ` on ${receipt.datePaidLabel}` : ""}`
    : `${receipt.amountPaidLabel} due`;
  doc.text(paidLine, margin, y);
  y += 20;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Description", margin, y);
  doc.text("Qty", pageW - margin - 120, y);
  doc.text("Amount", pageW - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30);
  for (const line of receipt.lines) {
    const desc = doc.splitTextToSize(line.description, pageW - margin * 2 - 150);
    doc.text(desc, margin, y);
    if (line.quantity != null) {
      doc.text(String(line.quantity), pageW - margin - 120, y);
    }
    doc.text(line.amountLabel, pageW - margin, y, { align: "right" });
    y += Math.max(16, desc.length * 13) + 6;
  }

  y += 8;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(receipt.paid ? "Amount paid" : "Amount due", margin, y);
  doc.text(receipt.amountPaidLabel, pageW - margin, y, { align: "right" });

  const array = doc.output("arraybuffer");
  return Buffer.from(array);
}
