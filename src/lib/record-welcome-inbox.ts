import {
  insertWelcomeInboxMessage,
  listWelcomeInboxMessagesForUser,
} from "@/db/queries/welcome-inbox";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";

function welcomeCopy(firstName?: string | null): {
  title: string;
  description: string;
} {
  const greeting = firstName?.trim()
    ? `Dear ${firstName.trim()},`
    : "Dear Flipvise learner,";

  return {
    title: "Welcome to Flipvise",
    description:
      `${greeting}\n\n` +
      "Thank you for choosing Flipvise. We are delighted to have you with us and look forward to supporting your learning journey.\n\n" +
      "Flipvise helps you study smarter with flashcards, quizzes, and optional AI tools. You can build decks on your personal dashboard, review with flip mode or timed quizzes, and track your progress over time.\n\n" +
      "Here are a few opportunities to explore:\n" +
      "• Create your first deck — add cards manually or generate them with AI on eligible plans.\n" +
      "• Install Flipvise on your phone (iOS/Android app or Add to Home Screen) and use Make available offline to study without an internet connection.\n" +
      "• Open Documentation for guides on decks, study sessions, team workspaces, and the mobile app.\n" +
      "• Visit Pricing to compare plans if you would like higher deck limits, AI Reading, or team collaboration.\n\n" +
      "If you have questions, open Help Center or Contact Us at any time. Welcome aboard — we are glad you are here.\n\n" +
      "Regards,\n" +
      "Flipvise Team by Flipvise Studio LLC",
  };
}

/** Persists a one-time welcome message to the user's dashboard inbox (idempotent per user). */
export async function recordWelcomeInboxMessage(input: {
  recipientUserId: string;
  firstName?: string | null;
  notify?: boolean;
}): Promise<void> {
  const copy = welcomeCopy(input.firstName);

  await insertWelcomeInboxMessage({
    recipientUserId: input.recipientUserId,
    title: copy.title,
    description: copy.description,
  });

  if (input.notify !== false) {
    notifyNativeInboxPush({
      recipientUserId: input.recipientUserId,
      category: "welcome",
      body: copy.title,
    });
  }
}

/** Creates the welcome inbox row when missing (webhook fallback for local dev and web sign-up). */
export async function ensureWelcomeInboxForUserIfMissing(input: {
  recipientUserId: string;
  firstName?: string | null;
  notify?: boolean;
}): Promise<boolean> {
  const existing = await listWelcomeInboxMessagesForUser(
    input.recipientUserId,
    1,
  );
  if (existing.length > 0) return false;

  await recordWelcomeInboxMessage(input);
  return true;
}
