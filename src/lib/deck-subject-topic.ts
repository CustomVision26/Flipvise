/** Splits teacher/quiz deck names formatted as `Subject — Topic`. */
const DECK_NAME_SEPARATOR = /\s+[—–-]\s+/;

export function parseDeckSubjectTopic(deck: {
  name: string;
  description?: string | null;
}): { subject: string; topic: string } {
  const name = deck.name.trim();
  if (!name) {
    return { subject: "", topic: "" };
  }

  const nameParts = name.split(DECK_NAME_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (nameParts.length >= 2) {
    return {
      subject: nameParts[0] ?? "",
      topic: nameParts.slice(1).join(" — "),
    };
  }

  const description = deck.description?.trim();
  if (description) {
    const segments = description.split("·").map((part) => part.trim()).filter(Boolean);
    if (segments.length >= 2) {
      const topic = segments[0] ?? "";
      const subject = segments[1] ?? "";
      if (subject && !subject.toLowerCase().includes("teacher quiz")) {
        return { subject, topic };
      }
    }
  }

  return { subject: name, topic: "" };
}

/** Deck name → subject; deck `description` field → topic (Description/Topic in edit deck). */
export function resolveDeckSubjectAndTopic(deck: {
  name: string;
  description?: string | null;
}): { subject: string; topic: string } {
  const parsed = parseDeckSubjectTopic(deck);
  const topicFromDescription = deck.description?.trim() ?? "";
  return {
    subject: parsed.subject,
    topic: topicFromDescription || parsed.topic,
  };
}
