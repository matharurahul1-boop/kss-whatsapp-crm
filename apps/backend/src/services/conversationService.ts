import { prisma } from "../lib/prisma";

interface OutboundMessageOptions {
  phone: string;
  waMessageId: string;
  body: string | null;
  templateName?: string;
  type?: "TEXT" | "TEMPLATE";
}

/**
 * Called after every successful outbound send.
 * Creates/updates the Conversation and appends an OUTBOUND Message.
 */
export async function recordOutboundMessage(opts: OutboundMessageOptions): Promise<void> {
  const { phone, waMessageId, body, templateName, type = "TEMPLATE" } = opts;

  // Find or create conversation
  let conversation = await prisma.conversation.findUnique({ where: { phone } });

  if (!conversation) {
    const contact = await prisma.contact.findUnique({ where: { phone } });
    conversation = await prisma.conversation.create({
      data: { phone, contactId: contact?.id ?? null },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type,
      body,
      templateName: templateName ?? null,
      waMessageId,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
}

/**
 * Called when a delivery/read webhook arrives — update the Message status.
 */
export async function updateOutboundMessageStatus(
  waMessageId: string,
  status: "DELIVERED" | "READ" | "FAILED",
  failReason?: string
): Promise<void> {
  const msg = await prisma.message.findUnique({ where: { waMessageId } });
  if (!msg) return;

  const now = new Date();
  await prisma.message.update({
    where: { waMessageId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? now : undefined,
      readAt: status === "READ" ? now : undefined,
      failedAt: status === "FAILED" ? now : undefined,
      failReason: status === "FAILED" ? failReason : undefined,
    },
  });
}
