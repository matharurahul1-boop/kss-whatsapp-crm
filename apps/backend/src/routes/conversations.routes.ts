import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { env } from "../config/env";
import { nanoid } from "nanoid";

const router = Router();
router.use(requireAuth);

// List all conversations, latest first
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const where = search
      ? {
          OR: [
            { phone: { contains: search } },
            { contact: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip,
        take,
        include: {
          contact: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

// Get messages for a conversation
router.get(
  "/:phone/messages",
  asyncHandler(async (req, res) => {
    const { page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const conversation = await prisma.conversation.findUnique({
      where: { phone: req.params.phone },
      include: { contact: true },
    });
    if (!conversation) throw new ApiError(404, "NOT_FOUND", "Conversation not found");

    // Mark as read — reset unreadCount
    if (conversation.unreadCount > 0) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { unreadCount: 0 } });
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        skip,
        take,
      }),
      prisma.message.count({ where: { conversationId: conversation.id } }),
    ]);

    const windowActive =
      conversation.windowExpiresAt !== null && conversation.windowExpiresAt > new Date();

    res.json({
      success: true,
      data: {
        conversation: { ...conversation, unreadCount: 0 },
        messages,
        total,
        windowActive,
        windowExpiresAt: conversation.windowExpiresAt,
      },
    });
  })
);

async function sendViaMetaApi(phone: string, payload: Record<string, unknown>): Promise<string> {
  if (env.metaMode === "mock") {
    return `wamid.mock.${nanoid(20)}`;
  }
  // Warn if media URL is localhost — Meta can't fetch it
  const typeKey = payload.type as string;
  const mediaObj = payload[typeKey] as Record<string, string> | undefined;
  if (mediaObj?.link && (mediaObj.link.includes("localhost") || mediaObj.link.includes("127.0.0.1"))) {
    throw new ApiError(400, "URL_NOT_PUBLIC",
      "Media file is on localhost — Meta API cannot access it. Set SERVER_BASE_URL to your public/ngrok URL in .env");
  }
  const metaRes = await fetch(`https://graph.facebook.com/v20.0/${env.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, ...payload }),
  });
  const metaData = (await metaRes.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (!metaRes.ok || !metaData.messages?.[0]) {
    throw new ApiError(500, "SEND_FAILED", metaData.error?.message ?? "Failed to send message");
  }
  return metaData.messages[0].id;
}

const replySchema = z.object({
  text: z.string().min(1).max(4096),
  replyToId: z.string().optional(),
});

// Send a free-form text reply (only within 24h window)
router.post(
  "/:phone/reply",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { text, replyToId } = replySchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({ where: { phone: req.params.phone } });
    if (!conversation) throw new ApiError(404, "NOT_FOUND", "Conversation not found");

    const windowOpen = conversation.windowExpiresAt && conversation.windowExpiresAt > new Date();
    if (!windowOpen) {
      throw new ApiError(400, "WINDOW_CLOSED", "24-hour reply window has expired. Send a template message to re-open.");
    }

    const waMessageId = await sendViaMetaApi(req.params.phone, { type: "text", text: { body: text } });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        type: "TEXT",
        body: text,
        waMessageId,
        status: "SENT",
        sentAt: new Date(),
        ...(replyToId ? { replyTo: { connect: { id: replyToId } } } : {}),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    res.json({ success: true, data: message });
  })
);

const mediaReplySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(["IMAGE", "DOCUMENT", "AUDIO", "VIDEO"]),
  caption: z.string().max(1024).optional(),
  filename: z.string().optional(),
  replyToId: z.string().optional(),
});

// Send a media reply (only within 24h window)
router.post(
  "/:phone/reply-media",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { mediaUrl, mediaType, caption, filename, replyToId } = mediaReplySchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({ where: { phone: req.params.phone } });
    if (!conversation) throw new ApiError(404, "NOT_FOUND", "Conversation not found");

    const windowOpen = conversation.windowExpiresAt && conversation.windowExpiresAt > new Date();
    if (!windowOpen) {
      throw new ApiError(400, "WINDOW_CLOSED", "24-hour reply window has expired. Send a template message to re-open.");
    }

    const typeKey = mediaType.toLowerCase() as "image" | "document" | "audio" | "video";
    const mediaPayload: Record<string, unknown> = { link: mediaUrl };
    if (caption && (mediaType === "IMAGE" || mediaType === "VIDEO")) mediaPayload.caption = caption;
    if (filename && mediaType === "DOCUMENT") mediaPayload.filename = filename;

    const waMessageId = await sendViaMetaApi(req.params.phone, { type: typeKey, [typeKey]: mediaPayload });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        type: mediaType,
        body: caption ?? null,
        mediaUrl,
        mediaType: mediaType.toLowerCase(),
        waMessageId,
        status: "SENT",
        sentAt: new Date(),
        ...(replyToId ? { replyTo: { connect: { id: replyToId } } } : {}),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    res.json({ success: true, data: message });
  })
);

// Open 24h window manually (useful when webhook isn't reachable locally)
router.post(
  "/:phone/open-window",
  asyncHandler(async (_req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { phone: _req.params.phone } });
    if (!conversation) throw new ApiError(404, "NOT_FOUND", "Conversation not found");

    const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { windowExpiresAt },
    });

    res.json({ success: true, data: { windowExpiresAt } });
  })
);

// Simulate an inbound message (for testing without ngrok/live webhook)
const simulateSchema = z.object({
  text: z.string().min(1).max(4096).optional(),
  senderName: z.string().optional(),
});

router.post(
  "/:phone/simulate-inbound",
  asyncHandler(async (_req, res) => {
    const { text = "Hello!", senderName } = simulateSchema.parse(_req.body);
    const phone = _req.params.phone;

    let conversation = await prisma.conversation.findUnique({ where: { phone } });
    if (!conversation) {
      const contact = await prisma.contact.findUnique({ where: { phone } });
      let contactId = contact?.id ?? null;
      if (!contact && senderName) {
        const c = await prisma.contact.create({ data: { name: senderName, phone, source: "WEBSITE" } });
        contactId = c.id;
      }
      conversation = await prisma.conversation.create({ data: { phone, contactId } });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        type: "TEXT",
        body: text,
        waMessageId: `wamid.sim.${nanoid(16)}`,
        status: "DELIVERED",
        sentAt: new Date(),
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        unreadCount: { increment: 1 },
      },
    });

    res.json({ success: true, data: { message: "Inbound message simulated", windowOpened: true } });
  })
);

export default router;
