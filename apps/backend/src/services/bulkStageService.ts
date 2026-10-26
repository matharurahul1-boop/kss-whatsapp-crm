import { randomUUID } from "crypto";
import { ContactStage, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { isValidPhone, normalizePhone } from "../utils/phone";
import { estimateCampaignCost } from "./campaignCostService";
import { getWhatsAppService } from "./whatsapp";
import { recordOutboundMessage } from "./conversationService";
import { scheduleMockDeliveryProgression } from "./messageSimulator";
import { env } from "../config/env";

export const bulkStageSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200).transform((ids) => [...new Set(ids)]),
  stage: z.nativeEnum(ContactStage),
});
export type BulkStageInput = z.infer<typeof bulkStageSchema>;
type Lead = { id: string; name: string; phone: string; stage: ContactStage };

async function prepare(input: BulkStageInput) {
  const contacts = await prisma.contact.findMany({ where: { id: { in: input.ids } }, select: { id: true, name: true, phone: true, stage: true } });
  if (contacts.length !== input.ids.length) throw new ApiError(404, "CONTACTS_NOT_FOUND", "Some selected contacts no longer exist. Refresh the list and select again.");
  const changed = contacts.filter((contact) => contact.stage !== input.stage);
  const config = await prisma.stageTemplate.findUnique({ where: { stage: input.stage } });
  const automation = !!(config?.enabled && config.templateName);
  const template = automation ? await prisma.whatsAppTemplate.findUnique({ where: { name: config!.templateName } }) : null;
  const valid = changed.filter((contact) => isValidPhone(normalizePhone(contact.phone)));
  const cost = automation && template?.status === "APPROVED" && valid.length > 0 ? await estimateCampaignCost(template.category, valid.length) : null;
  const problem = !changed.length ? "Selected contacts are already in this stage. No messages will be resent."
    : automation && (!template || template.status !== "APPROVED") ? "The assigned stage template must exist and be approved before sending. Ask the Manager to check Stage Automation."
    : automation && template && template.variableCount > 1 ? "This stage template needs multiple variables. Stage automation currently supports the contact name in {{1}} only. Ask the Manager to use a compatible template."
    : cost && cost.rateInr == null ? "The template category price has not been configured."
    : cost && !cost.canSend ? "Insufficient wallet balance. Top up ₹" + cost.shortfall + " before updating and sending."
    : null;
  return { contacts, changed, config, template, automation, valid, cost, problem };
}

export async function previewBulkStage(input: BulkStageInput) {
  const plan = await prepare(input);
  return {
    selected: plan.contacts.length, changed: plan.changed.length, unchanged: plan.contacts.length - plan.changed.length,
    invalidPhones: plan.changed.length - plan.valid.length,
    messagesToSend: plan.automation ? plan.valid.length : 0,
    templateName: plan.automation ? plan.config!.templateName : null,
    automationEnabled: plan.automation, cost: plan.cost,
    canApply: plan.problem == null, problem: plan.problem,
  };
}

export async function applyBulkStage(input: BulkStageInput, userId: string) {
  const plan = await prepare(input);
  if (!plan.changed.length) return { updated: 0, unchanged: plan.contacts.length, sent: 0, failed: 0, skipped: 0, results: [] };
  if (plan.problem) throw new ApiError(plan.cost && !plan.cost.canSend && plan.cost.rateInr != null ? 402 : 400, "BULK_STAGE_BLOCKED", plan.problem);
  const operationId = randomUUID();
  const claimed = await prisma.$transaction(async (tx) => {
    // UPDATE RETURNING claims each changed lead once, including simultaneous requests.
    const changed = await tx.$queryRaw<Lead[]>(Prisma.sql`
      UPDATE "Contact" SET "stage" = ${input.stage}::"ContactStage", "updatedAt" = NOW()
      WHERE "id" IN (${Prisma.join(plan.changed.map((contact) => contact.id))}) AND "stage" <> ${input.stage}::"ContactStage"
      RETURNING "id", "name", "phone", "stage"
    `);
    const sends = plan.automation ? changed.filter((contact) => isValidPhone(normalizePhone(contact.phone))).map((contact) => ({ contact, notificationId: randomUUID() })) : [];
    if (sends.length) await tx.notification.createMany({ data: sends.map(({ contact, notificationId }) => ({
      id: notificationId, contactId: contact.id, phone: normalizePhone(contact.phone), templateId: plan.template!.id,
      channel: "SINGLE", status: "QUEUED", variables: plan.template!.variableCount ? { "1": contact.name } : {},
    })) });
    await tx.auditLog.create({ data: { userId, action: "CONTACTS_BULK_STAGE", description: changed.length + " contacts moved to " + input.stage,
      metadata: { operationId, stage: input.stage, contactIds: changed.map((contact) => contact.id), templateName: plan.template?.name ?? null, queued: sends.length },
    } });
    return { changed, sends };
  }, { timeout: 15000 });
  const service = claimed.sends.length ? getWhatsAppService() : null;
  const results: { contactId: string; name: string; status: "SENT" | "FAILED"; reason?: string }[] = [];
  for (let offset = 0; offset < claimed.sends.length; offset += 5) {
    const batch = await Promise.all(claimed.sends.slice(offset, offset + 5).map(async ({ contact, notificationId }) => {
      let result;
      try {
        result = await service!.sendMessage({ phone: normalizePhone(contact.phone), templateName: plan.template!.name,
          language: plan.config!.language, variables: plan.template!.variableCount ? { "1": contact.name } : {} });
      } catch {
        result = { status: "failed" as const, messageId: "", failReason: "Message provider unavailable. The send could not be confirmed." };
      }
      const sent = result.status === "sent";
      await prisma.notification.update({ where: { id: notificationId }, data: {
        status: sent ? "SENT" : "FAILED", messageId: result.messageId || null,
        sentAt: sent ? new Date() : undefined, failedAt: sent ? undefined : new Date(), failReason: result.failReason,
      } });
      if (sent) {
        try { await recordOutboundMessage({ phone: normalizePhone(contact.phone), waMessageId: result.messageId, body: plan.template!.body, templateName: plan.template!.name, type: "TEMPLATE" }); }
        catch { console.error("Could not record conversation for bulk-stage notification", notificationId); }
        if (env.metaMode === "mock") scheduleMockDeliveryProgression(result.messageId);
      }
      return { contactId: contact.id, name: contact.name, status: sent ? "SENT" as const : "FAILED" as const, ...(sent ? {} : { reason: result.failReason ?? "Message failed" }) };
    }));
    results.push(...batch);
  }
  return { operationId, updated: claimed.changed.length, unchanged: plan.contacts.length - claimed.changed.length,
    sent: results.filter((result) => result.status === "SENT").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    skipped: claimed.changed.length - claimed.sends.length,
    templateName: plan.template?.name ?? null, results,
  };
}
