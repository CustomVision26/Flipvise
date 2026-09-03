export const FLIPVISE_INBOX_SIGNATURE =
  "Regards,\nFlipvise Team by Flipvise Studio LLC";

const SIGNATURE_PATTERN =
  /(?:\n\s*)?Regards,\s*\n\s*Flipvise Team by Flipvise Studio LLC\s*$/i;

/** Appends the standard inbox closing once — strips a trailing copy first. */
export function withFlipviseInboxSignature(body: string): string {
  const stripped = body.replace(SIGNATURE_PATTERN, "").trimEnd();
  return `${stripped}\n\n${FLIPVISE_INBOX_SIGNATURE}`;
}
