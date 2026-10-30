import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";
import { applyDeliveryEvent, DeliveryEventType } from "../services/notificationEvents";
import { prisma } from "../lib/prisma";
import { updateOutboundMessageStatus } from "../services/conversationService";
import { createClient } from "@supabase/supabase-js";

const router = Router();

router.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.webhookVerifyToken) {
    res.status(200).send(challenge);
    return;
  }

  res.status(403).json({ success: false, error: { code: "VERIFICATION_FAILED", message: "Webhook verification failed" } });
});

interface MetaStatusEntry {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: { title?: string }[];
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; filename?: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  sticker?: { id: string; mime_type: string };
}

router.post(
  "/whatsapp",
  asyncHandler(async (req, res) => {
    const changes =
      req.body?.entry?.flatMap(
        (e: { changes?: { value?: { statuses?: MetaStatusEntry[]; messages?: MetaInboundMessage[]; contacts?: { profile?: { name?: string } }[] } }[] }) =>
          e.changes ?? []
      ) ?? [];

    for (const change of changes) {
      const value = change?.value ?? {};

      // Handle delivery status updates
      for (const entry of value.statuses ?? []) {
        const eventKey = `webhook-${entry.id}-${entry.status}`;
        await applyDeliveryEvent({
          eventKey,
          messageId: entry.id,
          eventType: entry.status as DeliveryEventType,
          failReason: entry.errors?.[0]?.title,
          rawPayload: entry,
        });

        // Update Message status in conversation thread
        if (entry.status === "delivered" || entry.status === "read" || entry.status === "failed") {
          void updateOutboundMessageStatus(
            entry.id,
            entry.status === "delivered" ? "DELIVERED" : entry.status === "read" ? "READ" : "FAILED",
            entry.errors?.[0]?.title
          );
        }
      }

      // Handle incoming messages from clients
      const contactName = value.contacts?.[0]?.profile?.name;
      for (const msg of value.messages ?? []) {
        await handleInboundMessage(msg, contactName);
      }
    }

    res.status(200).json({ success: true });
  })
);

// Meta sends numbers as "917082071949"; contacts may be stored as "7082071949" or "+917082071949"
function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants = new Set<string>([raw, digits]);
  // Indian numbers: 91XXXXXXXXXX → try last 10 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    variants.add(digits.slice(2));
    variants.add(`+${digits}`);
  } else if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`+91${digits}`);
  }
  return Array.from(variants);
}

async function fetchMetaMediaUrl(mediaId: string): Promise<string | null> {
  try {
    // Step 1: Get the temporary Meta URL
    const res = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${env.accessToken}` },
    });
    const data = (await res.json()) as { url?: string; mime_type?: string };
    if (!data.url) return null;

    // Step 2: Download the media bytes using the access token
    const mediaRes = await fetch(data.url, {
      headers: { Authorization: `Bearer ${env.accessToken}` },
    });
    if (!mediaRes.ok) return null;
    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    const mimeType = data.mime_type ?? "application/octet-stream";

    // Step 3: Upload to Supabase Storage for a permanent public URL
    if (env.supabaseUrl && env.supabaseServiceKey) {
      const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
      const ext = mimeType.split("/")[1]?.split(";")[0] ?? "bin";
      const path = `inbound/${mediaId}.${ext}`;
      const { error } = await supabase.storage
        .from(env.supabaseStorageBucket)
        .upload(path, buffer, { contentType: mimeType, upsert: true });
      if (!error) {
        const { data: pub } = supabase.storage.from(env.supabaseStorageBucket).getPublicUrl(path);
        return pub.publicUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function handleInboundMessage(msg: MetaInboundMessage, senderName?: string) {
  const rawPhone = msg.from;
  const phoneVariants = normalizePhone(rawPhone);

  // Find or create conversation — try all phone variants
  let conversation = await prisma.conversation.findFirst({
    where: { phone: { in: phoneVariants } },
  });

  if (!conversation) {
    // Try to link to existing contact using any variant
    const contact = await prisma.contact.findFirst({
      where: { phone: { in: phoneVariants } },
    });

    // Use the phone format that matched the contact, else Meta's raw format
    const phone = contact?.phone ?? rawPhone;

    // If no contact and we have a name, create one
    let contactId = contact?.id ?? null;
    if (!contact && senderName) {
      const newContact = await prisma.contact.create({
        data: { name: senderName, phone, source: "WEBSITE" },
      });
      contactId = newContact.id;
    }

    conversation = await prisma.conversation.create({
      data: { phone, contactId },
    });

    // Auto-reply for first-time contacts (free-form text, within 24h window)
    void sendAutoReply(rawPhone, senderName);
  }

  // Determine message type and body
  let type: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "STICKER" | "UNKNOWN" = "UNKNOWN";
  let body: string | null = null;
  let mediaUrl: string | null = null;

  switch (msg.type) {
    case "text":
      type = "TEXT";
      body = msg.text?.body ?? null;
      break;
    case "image":
      type = "IMAGE";
      body = msg.image?.caption ?? null;
      if (msg.image?.id) mediaUrl = await fetchMetaMediaUrl(msg.image.id);
      break;
    case "document":
      type = "DOCUMENT";
      body = msg.document?.filename ?? msg.document?.caption ?? null;
      if (msg.document?.id) mediaUrl = await fetchMetaMediaUrl(msg.document.id);
      break;
    case "audio":
      type = "AUDIO";
      if (msg.audio?.id) mediaUrl = await fetchMetaMediaUrl(msg.audio.id);
      break;
    case "video":
      type = "VIDEO";
      body = msg.video?.caption ?? null;
      if (msg.video?.id) mediaUrl = await fetchMetaMediaUrl(msg.video.id);
      break;
    case "sticker":
      type = "STICKER";
      if (msg.sticker?.id) mediaUrl = await fetchMetaMediaUrl(msg.sticker.id);
      break;
  }

  // Store the message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      type,
      body,
      mediaUrl,
      waMessageId: msg.id,
      status: "DELIVERED",
      sentAt: new Date(Number(msg.timestamp) * 1000),
    },
  });

  // Update conversation: set 24h window, increment unread
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      unreadCount: { increment: 1 },
    },
  });
}

async function sendAutoReply(to: string, senderName?: string) {
  try {
    const greetName = senderName ? ` ${senderName.split(" ")[0]}` : "";
    const body =
      `Thank you for reaching out to KSS Interiors${greetName}! 🙏\n\n` +
      `We specialize in premium modular kitchens and wardrobes crafted for your space.\n\n` +
      `Our team will get back to you shortly.\n` +
      `For urgent assistance, please call: 📞 +91 88003 49401\n\n` +
      `⏰ Business hours: Mon–Sat, 10am–7pm`;

    await fetch(`https://graph.facebook.com/v20.0/${env.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });
  } catch (err) {
    console.error("[auto-reply] failed:", err);
  }
}

export default router;
