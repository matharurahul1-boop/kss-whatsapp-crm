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

  // Use raw query so variables column works even if Prisma client cache is stale
  const configRows = await prisma.$queryRaw<{ id: string; stage: string; templateName: string; language: string; enabled: boolean; variables: Record<string,string> | null }[]>`
    SELECT "id","stage","templateName","language","enabled","variables" FROM "StageTemplate" WHERE "stage" = ${input.stage}::"ContactStage" LIMIT 1
  `;
  const config = configRows[0] ?? null;

  console.log(`[bulkStage] stage=${input.stage} config=`, config ? { templateName: config.templateName, enabled: config.enabled, language: config.language } : "NOT FOUND");

  const automation = !!(config?.enabled && config.templateName);
  const template = automation ? await prisma.whatsAppTemplate.findUnique({ where: { name: config!.templateName }, select: { id: true, name: true, status: true, category: true, body: true, variableCount: true } }) : null;

  console.log(`[bulkStage] automation=${automation} template=`, template ? { name: template.name, status: template.status } : "null");

  const valid = changed.filter((contact) => isValidPhone(normalizePhone(contact.phone)));

  console.log(`[bulkStage] changed=${changed.length} validPhones=${valid.length} invalidPhones=${changed.length - valid.length}`);
  if (changed.length !== valid.length) {
    changed.filter((c) => !isValidPhone(normalizePhone(c.phone))).forEach((c) => console.log(`[bulkStage] invalid phone: "${c.phone}" → normalised="${normalizePhone(c.phone)}"`));
  }

  const cost = automation && template?.status === "APPROVED" && valid.length > 0 ? await estimateCampaignCost(template.category, valid.length) : null;

  // Which variable numbers (2, 3, ...) are needed by the template but NOT in config.variables?
  const configuredNums = new Set(Object.keys(config?.variables ?? {}).map(Number));
  const missingVars: number[] = template
    ? Array.from({ length: Math.max(0, template.variableCount - 1) }, (_, i) => i + 2).filter((n) => !configuredNums.has(n))
    : [];

  // Build human-readable skip reason for the UI
  let skipReason: string | null = null;
  if (!automation) {
    if (!config) skipReason = `No Stage Automation configured for stage "${input.stage}". Go to Settings > Stage Automation to assign a template.`;
    else if (!config.enabled) skipReason = `Stage Automation is disabled for "${input.stage}". Enable it in Settings > Stage Automation.`;
    else skipReason = `No template assigned for stage "${input.stage}" in Stage Automation.`;
  } else if (!template) {
    skipReason = `Template "${config!.templateName}" not found in the app. Try pulling from Meta.`;
  } else if (template.status !== "APPROVED") {
    skipReason = `Template "${template.name}" status is ${template.status} — must be APPROVED to send.`;
  } else if (valid.length === 0) {
    skipReason = `Contact phone number is invalid or missing. Fix the phone and try again.`;
  }

  const problem = !changed.length ? "Selected contacts are already in this stage. No messages will be resent."
    : automation && (!template || template.status !== "APPROVED") ? `Template "${config!.templateName}" must be APPROVED. Current status: ${template?.status ?? "not found"}.`
    : cost && cost.rateInr == null ? "The template category price has not been configured."
    : cost && !cost.canSend ? "Insufficient wallet balance. Top up ₹" + cost.shortfall + " before updating and sending."
    : null;

  return { contacts, changed, config, template, automation, valid, cost, problem, skipReason, missingVars };
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
    skipReason: plan.skipReason,
    missingVars: plan.missingVars,
  };
}

export async function applyBulkStage(input: BulkStageInput, userId: string, extraVariables?: Record<string, string>) {
  const plan = await prepare(input);
  if (!plan.changed.length) return { updated: 0, unchanged: plan.contacts.length, sent: 0, failed: 0, skipped: 0, skipReason: null, results: [] };
  if (plan.problem) throw new ApiError(plan.cost && !plan.cost.canSend && plan.cost.rateInr != null ? 402 : 400, "BULK_STAGE_BLOCKED", plan.problem);
  const operationId = randomUUID();
  const claimed = await prisma.$transaction(async (tx) => {
    const changed = await tx.$queryRaw<Lead[]>(Prisma.sql`
      UPDATE "Contact" SET "stage" = ${input.stage}::"ContactStage", "updatedAt" = NOW()
      WHERE "id" IN (${Prisma.join(plan.changed.map((contact) => contact.id))}) AND "stage" <> ${input.stage}::"ContactStage"
      RETURNING "id", "name", "phone", "stage"
    `);
    const sends = plan.automation && plan.template?.status === "APPROVED"
      ? changed.filter((contact) => isValidPhone(normalizePhone(contact.phone))).map((contact) => ({ contact, notificationId: randomUUID() }))
      : [];
    if (sends.length) await tx.notification.createMany({ data: sends.map(({ contact, notificationId }) => ({
      id: notificationId, contactId: contact.id, phone: normalizePhone(contact.phone), templateId: plan.template!.id,
      channel: "SINGLE", status: "QUEUED", variables: { "1": contact.name, ...(plan.config!.variables ?? {}), ...(extraVariables ?? {}) },
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
      const vars = { "1": contact.name, ...(plan.config!.variables ?? {}), ...(extraVariables ?? {}) };
      console.log(`[bulkStage] sending to ${contact.phone} template=${plan.template!.name} lang=${plan.config!.language} vars=`, vars);
      let result;
      try {
        result = await service!.sendMessage({
          phone: normalizePhone(contact.phone),
          templateName: plan.template!.name,
          language: plan.config!.language,
          variables: vars,
        });
        console.log(`[bulkStage] sendMessage result for ${contact.phone}:`, result);
      } catch (err) {
        console.error(`[bulkStage] sendMessage threw for ${contact.phone}:`, err);
        result = { status: "failed" as const, messageId: "", failReason: String(err) };
      }
      const sent = result.status === "sent";
      await prisma.notification.update({ where: { id: notificationId }, data: {
        status: sent ? "SENT" : "FAILED", messageId: result.messageId || null,
        sentAt: sent ? new Date() : undefined, failedAt: sent ? undefined : new Date(), failReason: result.failReason,
      } });
      if (sent) {
        try { await recordOutboundMessage({ phone: normalizePhone(contact.phone), waMessageId: result.messageId, body: plan.template!.body, templateName: plan.template!.name, type: "TEMPLATE" }); }
        catch { console.error("[bulkStage] Could not record conversation for", notificationId); }
        if (env.metaMode === "mock") scheduleMockDeliveryProgression(result.messageId);
      }
      return { contactId: contact.id, name: contact.name, status: sent ? "SENT" as const : "FAILED" as const, ...(sent ? {} : { reason: result.failReason ?? "Message failed" }) };
    }));
    results.push(...batch);
  }

  return {
    operationId,
    updated: claimed.changed.length,
    unchanged: plan.contacts.length - claimed.changed.length,
    sent: results.filter((r) => r.status === "SENT").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    skipped: claimed.changed.length - claimed.sends.length,
    skipReason: claimed.sends.length === 0 ? plan.skipReason : null,
    templateName: plan.template?.name ?? null,
    results,
  };
}
