"use client";

import {
  getContactUsThreadAction,
  replyToContactUsAction,
} from "@/actions/contact-us";
import { ContactUsThreadClient } from "@/components/contact-us-thread-client";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";

export function UserContactUsThreadPanel({
  messageId,
  accessToken,
  initialThread,
}: {
  messageId: number;
  accessToken?: string;
  initialThread: ContactUsThread;
}) {
  return (
    <ContactUsThreadClient
      messageId={messageId}
      accessToken={accessToken}
      viewerRole="user"
      initialThread={initialThread}
      fetchThread={() => getContactUsThreadAction({ messageId, token: accessToken })}
      sendReply={async (message) => {
        const result = await replyToContactUsAction({ messageId, message, token: accessToken });
        return result.thread;
      }}
    />
  );
}
