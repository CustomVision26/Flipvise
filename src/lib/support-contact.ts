/** Primary support inbox for Help Center and user documentation. */
export const SUPPORT_EMAIL = "customvision26@gmail.com" as const;

export function supportMailtoHref(
  subject = "Flipvise Support Request",
  email: string = SUPPORT_EMAIL,
) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

/** WhatsApp click-to-chat link for a public support number. */
export function whatsappChatHref(number: string | null | undefined): string | null {
  const digits = number?.replace(/\D/g, "") ?? "";
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}
