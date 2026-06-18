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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ContactUsThreadClient
      messageId={messageId}
      accessToken={accessToken}
      viewerRole="user"
      initialThread={initialThread}
      fetchThread={() => getContactUsThreadAction({ messageId, token: accessToken })}
      sendReply={async (payload) => {
        const result = await replyToContactUsAction({
          messageId,
          message: payload.message,
          imageUrl: payload.imageUrl,
          token: accessToken,
        });
        return result.thread;
      }}
    />
    </div>
  );
}
