/** Primary support inbox for Help Center and user documentation. */
export const SUPPORT_EMAIL = "customvision26@gmail.com" as const;

export function supportMailtoHref(
  subject = "Flipvise Support Request",
  email: string = SUPPORT_EMAIL,
) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
