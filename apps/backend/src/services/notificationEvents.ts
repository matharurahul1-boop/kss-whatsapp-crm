import { NotificationStatus, RecipientStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type DeliveryEventType = "sent" | "delivered" | "read" | "failed";

interface ApplyEventInput {
  eventKey: string;
  messageId: string;
  eventType: DeliveryEventType;
  failReason?: string;
  provider?: string;
  rawPayload?: unknown;
}

const STATUS_MAP: Record<DeliveryEventType, NotificationStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

const RECIPIENT_STATUS_MAP: Record<DeliveryEventType, RecipientStatus> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

// Applies a delivery status event idempotently. Duplicate webhook deliveries
// (same eventKey) are detected via the unique WebhookEvent record and skipped.
export async function applyDeliveryEvent(input: ApplyEventInput): Promise<{ applied: boolean }> {
  const existing = await prisma.webhookEvent.findUnique({ where: { eventKey: input.eventKey } });
  if (existing) {
    return { applied: false };
  }

  const notification = await prisma.notification.findUnique({ where: { messageId: input.messageId } });
  if (!notification) {
    await prisma.webhookEvent.create({
      data: {
        eventKey: input.eventKey,
        provider: input.provider ?? "meta",
        eventType: input.eventType,
        payload: (input.rawPayload as object) ?? { messageId: input.messageId, note: "notification not found" },
      },
    });
    return { applied: false };
  }

  // Never downgrade a terminal-forward status (read cannot revert to delivered, etc.)
  const rank: Record<NotificationStatus, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
  const nextStatus = STATUS_MAP[input.eventType];
  const shouldUpdate = rank[nextStatus] >= rank[notification.status] || nextStatus === "FAILED";

  await prisma.$transaction(async (tx) => {
    await tx.webhookEvent.create({
      data: {
        eventKey: input.eventKey,
        provider: input.provider ?? "meta",
        eventType: input.eventType,
        payload: (input.rawPayload as object) ?? { messageId: input.messageId, eventType: input.eventType },
      },
    });

    if (!shouldUpdate) return;

    const now = new Date();
    await tx.notification.update({
      where: { id: notification.id },
      data: {
        status: nextStatus,
        failReason: input.eventType === "failed" ? input.failReason ?? "Delivery failed" : notification.failReason,
        sentAt: input.eventType === "sent" ? now : notification.sentAt,
        deliveredAt: input.eventType === "delivered" ? now : notification.deliveredAt,
        readAt: input.eventType === "read" ? now : notification.readAt,
        failedAt: input.eventType === "failed" ? now : notification.failedAt,
      },
    });

    if (notification.campaignId) {
      await updateCampaignCounters(tx, notification.campaignId, notification.contactId, input.eventType, input.failReason);
    }
  });

  return { applied: shouldUpdate };
}

async function updateCampaignCounters(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  campaignId: string,
  contactId: string | null,
  eventType: DeliveryEventType,
  failReason?: string
): Promise<void> {
  if (contactId) {
    const recipient = await tx.campaignRecipient.findUnique({
      where: { campaignId_contactId: { campaignId, contactId } },
    });
    if (recipient) {
      await tx.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: RECIPIENT_STATUS_MAP[eventType],
          failReason: eventType === "failed" ? failReason ?? "Delivery failed" : recipient.failReason,
          processedAt: new Date(),
        },
      });
    }
  }

  const field = eventType === "sent" ? "sentCount" : eventType === "delivered" ? "deliveredCount" : eventType === "read" ? "readCount" : "failedCount";
  await tx.campaign.update({ where: { id: campaignId }, data: { [field]: { increment: 1 } } });
}
