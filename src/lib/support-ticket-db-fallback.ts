let warnedMissingSupportTicketReplyImageUrlColumn = false;

export function isMissingSupportTicketReplyImageUrlColumnError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    const message = typeof obj.message === "string" ? obj.message : "";
    if (
      /support_ticket_replies/i.test(message) &&
      /imageUrl/i.test(message) &&
      /(does not exist|Failed query|42703)/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error);
  return (
    /support_ticket_replies/i.test(flat) &&
    /imageUrl/i.test(flat) &&
    (/Failed query/i.test(flat) || /does not exist/i.test(flat) || /42703/i.test(flat))
  );
}

export function warnMissingSupportTicketReplyImageUrlColumnOnce() {
  if (warnedMissingSupportTicketReplyImageUrlColumn) return;
  warnedMissingSupportTicketReplyImageUrlColumn = true;
  console.warn(
    "[db] `support_ticket_replies` is missing `imageUrl` — run: npm run db:ensure-support-ticket-reply-images",
  );
}
