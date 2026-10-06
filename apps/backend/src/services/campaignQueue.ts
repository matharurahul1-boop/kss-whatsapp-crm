import { prisma } from "../lib/prisma";
import { getWhatsAppService } from "./whatsapp";
import { scheduleMockDeliveryProgression } from "./messageSimulator";
import { renderTemplateBody } from "../utils/template";
import { recordOutboundMessage } from "./conversationService";

const BATCH_SIZE = 5;
const BATCH_INTERVAL_MS = 400;

interface QueueItem {
  campaignId: string;
}

const queue: QueueItem[] = [];
let processing = false;

export function enqueueCampaign(campaignId: string): void {
  queue.push({ campaignId });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await runCampaign(item.campaignId);
      }
    }
  } finally {
    processing = false;
  }
}

async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });
  if (!campaign || campaign.status === "CANCELLED") return;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  const service = getWhatsAppService();
  const variableMap = (campaign.variableMap as Record<string, string>) ?? {};

  let cursor: string | undefined;
  let hasFailures = false;
  let hasSuccesses = false;
  let processedAny = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.campaignRecipient.findMany({
      where: { campaignId, status: "PENDING" },
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { contact: true },
    });

    if (batch.length === 0) break;

    // Re-check for cancellation between batches so a cancel takes effect promptly.
    const fresh = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { status: true } });
    if (fresh?.status === "CANCELLED") return;

    await Promise.all(
      batch.map(async (recipient) => {
        processedAny = true;
        const variables: Record<string, string> = {};
        for (const [key, field] of Object.entries(variableMap)) {
          variables[key] = resolveContactField(recipient.contact, field) ?? "";
        }

        await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "QUEUED" } });

        const result = await service.sendMessage({
          phone: recipient.contact.phone,
          templateName: campaign.template.name,
          language: campaign.template.language,
          variables,
        });

        if (result.status === "failed") {
          hasFailures = true;
          await prisma.$transaction([
            prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "FAILED", failReason: result.failReason, messageId: result.messageId || null, processedAt: new Date() },
            }),
            prisma.notification.create({
              data: {
                contactId: recipient.contactId,
                phone: recipient.contact.phone,
                templateId: campaign.templateId,
                campaignId,
                channel: "CAMPAIGN",
                status: "FAILED",
                messageId: result.messageId || `failed_${recipient.id}`,
                variables,
                failReason: result.failReason,
                failedAt: new Date(),
              },
            }),
            prisma.campaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } }),
          ]);
        } else {
          hasSuccesses = true;
          await prisma.$transaction([
            prisma.campaignRecipient.update({
              where: { id: recipient.id },
              data: { status: "SENT", messageId: result.messageId, processedAt: new Date() },
            }),
            prisma.notification.create({
              data: {
                contactId: recipient.contactId,
                phone: recipient.contact.phone,
                templateId: campaign.templateId,
                campaignId,
                channel: "CAMPAIGN",
                status: "SENT",
                messageId: result.messageId,
                variables,
                sentAt: new Date(),
              },
            }),
            prisma.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } }),
          ]);
          if (service.mode === "mock") scheduleMockDeliveryProgression(result.messageId);
          void recordOutboundMessage({
            phone: recipient.contact.phone,
            waMessageId: result.messageId,
            body: campaign.template.body,
            templateName: campaign.template.name,
            type: "TEMPLATE",
          });
        }
      })
    );

    cursor = batch[batch.length - 1]?.id;
    await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
  }

  if (!processedAny) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "COMPLETED", completedAt: new Date() } });
    return;
  }

  const finalStatus = hasFailures && hasSuccesses ? "PARTIALLY_COMPLETED" : hasFailures && !hasSuccesses ? "FAILED" : "COMPLETED";

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: finalStatus, completedAt: new Date() },
  });
}

function resolveContactField(contact: { name: string; phone: string; email: string | null }, field: string): string {
  switch (field) {
    case "name":
      return contact.name;
    case "phone":
      return contact.phone;
    case "email":
      return contact.email ?? "";
    default:
      return field; // literal fallback value entered by the user
  }
}

export { renderTemplateBody };
