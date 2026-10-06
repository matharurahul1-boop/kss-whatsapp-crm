import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";
import { applyDeliveryEvent, DeliveryEventType } from "../services/notificationEvents";
import { prisma } from "../lib/prisma";
import { updateOutboundMessageStatus } from "../services/conversationService";

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

async function handleInboundMessage(msg: MetaInboundMessage, senderName?: string) {
  const phone = msg.from;

  // Find or create conversation
  let conversation = await prisma.conversation.findUnique({ where: { phone } });

  if (!conversation) {
    // Try to link to existing contact
    const contact = await prisma.contact.findUnique({ where: { phone } });

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
  }

  // Determine message type and body
  let type: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "STICKER" | "UNKNOWN" = "UNKNOWN";
  let body: string | null = null;

  switch (msg.type) {
    case "text":
      type = "TEXT";
      body = msg.text?.body ?? null;
      break;
    case "image":
      type = "IMAGE";
      body = msg.image?.caption ?? null;
      break;
    case "document":
      type = "DOCUMENT";
      body = msg.document?.filename ?? msg.document?.caption ?? null;
      break;
    case "audio":
      type = "AUDIO";
      break;
    case "video":
      type = "VIDEO";
      body = msg.video?.caption ?? null;
      break;
    case "sticker":
      type = "STICKER";
      break;
  }

  // Store the message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      type,
      body,
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

export default router;
