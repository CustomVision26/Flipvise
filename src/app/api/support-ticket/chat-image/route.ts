import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessSupportTicketChat } from "@/lib/support-ticket-access";
import { uploadSupportTicketChatImageToS3 } from "@/lib/s3";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const ticketId = z.coerce.number().int().positive().parse(formData.get("ticketId"));

    if (!(await canAccessSupportTicketChat(ticketId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    if (!CHAT_IMAGE_TYPES.includes(file.type as (typeof CHAT_IMAGE_TYPES)[number])) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
        { status: 400 },
      );
    }
    if (file.size > CHAT_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 10 MB" }, { status: 400 });
    }

    const url = await uploadSupportTicketChatImageToS3({ ticketId, file });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[api/support-ticket/chat-image]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
