import { bulkStageSchema, previewBulkStage, applyBulkStage } from "../services/bulkStageService";
import { requireManager } from "../middleware/requireManager";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { isValidPhone, normalizePhone } from "../utils/phone";
import { ApiError } from "../middleware/errorHandler";
import { getWhatsAppService } from "../services/whatsapp";
import { TRIGGER_DEFS } from "./triggers.routes";
import { recordOutboundMessage } from "../services/conversationService";
import { recipientFromTemplateName, resolveRecipientPhones, internalVariables, ContactContext, RecipientKind } from "../services/internalRecipients";


const router = Router();
router.use(requireAuth);
router.use("/stage-templates", requireManager);

// Maps contact stage → trigger event (for auto-fire on stage change)
const STAGE_TO_TRIGGER: Record<string, string> = {
  ENQUIRY:         "ENQUIRY_CREATED",
  PI_CREATED:      "PI_CREATED",
  SALES_ORDER:     "SALES_ORDER_INITIATED",
  PRODUCTION:      "ORDER_STATUS_PRODUCTION",
  READY_DISPATCH:  "ORDER_STATUS_READY_DISPATCH",
  DISPATCHED:      "ORDER_STATUS_DISPATCHED",
  INSTALLATION:    "ORDER_STATUS_INSTALLATION",
  HANDOVER:        "ORDER_STATUS_HANDOVER",
  SERVICE_REQUEST: "SERVICE_REQUEST_REMINDER",
  TICKET_OPEN:     "TICKET_OPEN",
  TICKET_CLOSED:   "TICKET_CLOSED",
  ON_HOLD:         "ENQUIRY_CANCELLED_ADMIN",
  LOST:            "ENQUIRY_CANCELLED_ADMIN",
};

async function fireTriggerForStage(stage: string, contact: ContactContext, customerPhone: string) {
  const event = STAGE_TO_TRIGGER[stage];
  if (!event) return;
  await fireTriggerEvent(event, contact, customerPhone, STAGE_LABELS[stage] ?? stage);
}

/** Sends the template configured for a trigger event to its recipients. Returns how many messages went out. */
async function fireTriggerEvent(event: string, contact: ContactContext, customerPhone: string, label: string): Promise<number> {
  try {
    const cfg = await (prisma as any).triggerConfig.findUnique({ where: { event } });
    if (!cfg?.enabled || !cfg.templateName) return 0;
    // Use Meta-registered language from WhatsAppTemplate, fall back to config language
    const tpl = await prisma.whatsAppTemplate.findUnique({ where: { name: cfg.templateName }, select: { language: true } });
    const language = tpl?.language || cfg.language || "en_US";
    const staticVars: Record<string, string> = cfg.variables && typeof cfg.variables === "object" ? cfg.variables as Record<string, string> : {};
    const kind = recipientFromTemplateName(cfg.templateName, cfg.recipient as RecipientKind);
    const variables = { ...internalVariables(cfg.templateName, contact, label), ...staticVars };
    const phones = await resolveRecipientPhones(kind, customerPhone);
    if (!phones.length) console.warn(`[trigger] ${event}: no ${kind} phone numbers configured - nothing sent`);
    const wa = getWhatsAppService();
    for (const phone of phones) {
      console.log(`[trigger] firing ${event} -> template=${cfg.templateName} lang=${language} to=${kind} phone=${phone}`);
      const result = await wa.sendMessage({ phone, templateName: cfg.templateName, language, variables });
      await recordOutboundMessage({ phone, waMessageId: result.messageId, body: null, templateName: cfg.templateName, type: "TEMPLATE" });
    }
    return phones.length;
  } catch (err) {
    console.error(`[contacts] Trigger "${event}" failed for ${contact.name}:`, err);
    return 0;
  }
}

const STAGE_LABELS: Record<string, string> = {
  ENQUIRY:         "Enquiry",
  PROSPECT:        "Prospect",
  VISIT_SCHEDULED: "Visit Scheduled",
  VISITED:         "Visited",
  NEGOTIATION:     "Negotiation",
  PI_CREATED:      "PI Created",
  SALES_ORDER:     "Sales Order",
  PRODUCTION:      "In Production",
  READY_DISPATCH:  "Ready for Dispatch",
  DISPATCHED:      "Dispatched",
  INSTALLATION:    "Installation Scheduled",
  HANDOVER:        "Handover",
  SERVICE_REQUEST: "Service Request",
  TICKET_OPEN:     "Ticket Open",
  TICKET_CLOSED:   "Ticket Closed",
  ON_HOLD:         "On Hold",
  LOST:            "Lost",
};

async function sendTemplateToContact(customerPhone: string, contact: ContactContext, templateName: string, _configLanguage = "en_US") {
  try {
    // Always use the language Meta registered the template with
    const tpl = await prisma.whatsAppTemplate.findUnique({ where: { name: templateName }, select: { language: true } });
    const language = tpl?.language || _configLanguage;
    const kind = recipientFromTemplateName(templateName);
    const phones = await resolveRecipientPhones(kind, customerPhone);
    if (!phones.length) console.warn(`[contacts] "${templateName}" is a ${kind} template but no ${kind} phone numbers are configured - nothing sent`);
    const variables = internalVariables(templateName, contact, STAGE_LABELS[contact.stage ?? ""] ?? contact.stage ?? "");
    const wa = getWhatsAppService();
    for (const phone of phones) {
      const result = await wa.sendMessage({ phone, templateName, language, variables });
      await recordOutboundMessage({ phone, waMessageId: result.messageId, body: null, templateName, type: "TEMPLATE" });
    }
  } catch (err) {
    console.error(`[contacts] Failed to send template "${templateName}":`, err);
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, source, tag, stage, page = "1", pageSize = "10" } = req.query as Record<string, string>;

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(source ? { source: source as never } : {}),
      ...(tag ? { tags: { some: { name: tag } } } : {}),
      ...(stage ? { stage: stage as never } : {}),
    };

    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { tags: true } }),
      prisma.contact.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

router.get(
  "/tags",
  asyncHandler(async (req, res) => {
    const tags = await prisma.contactTag.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: tags });
  })
);

const contactInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal("")),
  source: z.enum(["MANUAL", "CRM_API", "EXHIBITION", "WEBSITE", "IMPORT"]).default("MANUAL"),
  stage: z.enum(["ENQUIRY","PROSPECT","VISIT_SCHEDULED","VISITED","NEGOTIATION","PI_CREATED","SALES_ORDER","PRODUCTION","READY_DISPATCH","DISPATCHED","INSTALLATION","HANDOVER","SERVICE_REQUEST","TICKET_OPEN","TICKET_CLOSED","ON_HOLD","LOST"]).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  budget: z.number().positive().optional(),
  referredBy: z.string().optional(),
});

async function connectTags(tagNames: string[] = []) {
  return Promise.all(
    tagNames.map(async (name) => {
      const tag = await prisma.contactTag.upsert({ where: { name }, update: {}, create: { name } });
      return { id: tag.id };
    })
  );
}

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = contactInputSchema.parse(req.body);
    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) throw new ApiError(400, "INVALID_PHONE", "Phone number must be in the format countrycode+number, e.g. 91XXXXXXXXXX");

    const existing = await prisma.contact.findUnique({ where: { phone } });
    if (existing) throw new ApiError(409, "DUPLICATE_CONTACT", "A contact with this phone number already exists");

    const tagConnections = await connectTags(input.tags);

    const contact = await prisma.contact.create({
      data: {
        name: input.name,
        phone,
        email: input.email || null,
        source: input.source,
        stage: input.stage ?? "ENQUIRY",
        notes: input.notes,
        budget: input.budget,
        referredBy: input.referredBy || null,
        tags: { connect: tagConnections },
      },
      include: { tags: true },
    });

    await recordAudit({ userId: req.user?.userId, action: "CONTACT_CREATED", description: `Contact "${contact.name}" created` });

    // Fire ENQUIRY_CREATED trigger + send onboarding stage template
    const ctx = { id: contact.id, name: contact.name, stage: "ENQUIRY", notes: contact.notes };
    void fireTriggerForStage("ENQUIRY", ctx, phone);
    const onboarding = await (prisma as any).stageTemplate.findUnique({ where: { stage: "ENQUIRY" } });
    if (onboarding?.enabled && onboarding.templateName) {
      void sendTemplateToContact(phone, ctx, onboarding.templateName, onboarding.language);
    }

    res.status(201).json({ success: true, data: contact });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = contactInputSchema.partial().parse(req.body);
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Contact not found");

    let phone = existing.phone;
    if (input.phone) {
      phone = normalizePhone(input.phone);
      if (!isValidPhone(phone)) throw new ApiError(400, "INVALID_PHONE", "Invalid phone number");
    }

    const tagConnections = input.tags ? await connectTags(input.tags) : undefined;

    const updated = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone,
        email: input.email || undefined,
        source: input.source,
        stage: input.stage,
        notes: input.notes,
        budget: input.budget,
        referredBy: input.referredBy || undefined,
        ...(tagConnections ? { tags: { set: tagConnections } } : {}),
      },
      include: { tags: true },
    });

    // Stage changed → fire trigger + send stage template
    if (input.stage && input.stage !== existing.stage) {
      const ctx = { id: updated.id, name: updated.name, stage: input.stage, notes: updated.notes };
      void fireTriggerForStage(input.stage, ctx, phone);
      const stageTpl = await (prisma as any).stageTemplate.findUnique({ where: { stage: input.stage } });
      if (stageTpl?.enabled && stageTpl.templateName) {
        void sendTemplateToContact(phone, ctx, stageTpl.templateName, stageTpl.language);
      }
      await recordAudit({
        userId: req.user?.userId,
        action: "CONTACT_STAGE_CHANGED",
        description: `Contact "${updated.name}" moved to ${STAGE_LABELS[input.stage] ?? input.stage}`,
      });
    }

    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Contact not found");

    await prisma.contact.delete({ where: { id: existing.id } });
    await recordAudit({ userId: req.user?.userId, action: "CONTACT_DELETED", description: `Contact "${existing.name}" deleted` });

    res.json({ success: true, data: { id: existing.id } });
  })
);

const importRowSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
});

router.post(
  "/import",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = z.array(importRowSchema).parse(req.body.rows ?? []);

    const seenPhones = new Set<string>();
    const valid: { name: string; phone: string; email?: string }[] = [];
    const invalid: { row: unknown; reason: string }[] = [];
    const duplicates: { row: unknown; reason: string }[] = [];

    const existingPhones = new Set((await prisma.contact.findMany({ select: { phone: true } })).map((c: { phone: string }) => c.phone));

    for (const row of rows) {
      const phone = normalizePhone(row.phone);
      if (!row.name || !row.name.trim()) {
        invalid.push({ row, reason: "Missing name" });
        continue;
      }
      if (!isValidPhone(phone)) {
        invalid.push({ row, reason: "Invalid phone number format" });
        continue;
      }
      if (seenPhones.has(phone) || existingPhones.has(phone)) {
        duplicates.push({ row, reason: "Duplicate phone number" });
        continue;
      }
      seenPhones.add(phone);
      valid.push({ name: row.name.trim(), phone, email: row.email });
    }

    if (valid.length > 0) {
      await prisma.contact.createMany({
        data: valid.map((v) => ({ name: v.name, phone: v.phone, email: v.email || null, source: "IMPORT" as const })),
        skipDuplicates: true,
      });
    }

    await recordAudit({
      userId: req.user?.userId,
      action: "CONTACTS_IMPORTED",
      description: `Imported ${valid.length} contacts (${invalid.length} invalid, ${duplicates.length} duplicates)`,
    });

    res.json({
      success: true,
      data: {
        total: rows.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        duplicateCount: duplicates.length,
        invalidRecords: [...invalid, ...duplicates],
      },
    });
  })
);

// Preview the stage assignment, automatic template and wallet cost before applying.
router.post("/bulk-stage/preview", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await previewBulkStage(bulkStageSchema.parse(req.body)) });
}));
router.post("/bulk-stage", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const extraVariables = req.body.extraVariables as Record<string, string> | undefined;
  res.json({ success: true, data: await applyBulkStage(bulkStageSchema.parse(req.body), req.user!.userId, extraVariables) });
}));

// Notification headings for the bulk dropdown. `stage` is set when the notification also moves contacts to a stage.
router.get("/notification-options", asyncHandler(async (_req, res) => {
  const stageFor: Record<string, string> = {};
  for (const [stage, event] of Object.entries(STAGE_TO_TRIGGER)) if (!stageFor[event]) stageFor[event] = stage;
  res.json({ success: true, data: TRIGGER_DEFS.map((d) => ({ event: d.event, label: d.label, recipient: d.recipient, stage: stageFor[d.event] ?? null })) });
}));

// Send a notification to the selected contacts without changing their stage.
router.post("/bulk-notify", asyncHandler(async (req, res) => {
  const { ids, event } = z.object({ ids: z.array(z.string().min(1)).min(1).max(200), event: z.string() }).parse(req.body);
  if (!TRIGGER_DEFS.some((d) => d.event === event)) throw new ApiError(400, "INVALID_EVENT", "Unknown notification");
  const cfg = await (prisma as any).triggerConfig.findUnique({ where: { event } });
  if (!cfg?.enabled || !cfg.templateName) throw new ApiError(400, "TRIGGER_NOT_CONFIGURED", "This notification has no enabled template. Set one in Settings > Triggers.");
  const contacts = await prisma.contact.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true, stage: true, notes: true } });
  let sent = 0, skipped = 0;
  for (const c of contacts) {
    const n = await fireTriggerEvent(event, { id: c.id, name: c.name, stage: c.stage, notes: c.notes }, normalizePhone(c.phone), STAGE_LABELS[c.stage] ?? c.stage);
    if (n > 0) sent += n; else skipped++;
  }
  res.json({ success: true, data: { contacts: contacts.length, sent, skipped, templateName: cfg.templateName } });
}));

// Stage templates config routes
router.get(
  "/stage-templates",
  asyncHandler(async (_req, res) => {
    const rows = await (prisma as any).stageTemplate.findMany({ orderBy: { stage: "asc" } });
    res.json({ success: true, data: rows });
  })
);

router.put(
  "/stage-templates/:stage",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { stage } = req.params;
    const { templateName, language, enabled, variables } = z.object({
      templateName: z.string(),
      language: z.string().default("en_US"),
      enabled: z.boolean().default(true),
      variables: z.record(z.string()).optional(),
    }).parse(req.body);

    const row = await (prisma as any).stageTemplate.upsert({
      where: { stage },
      update: { templateName, language, enabled, variables },
      create: { stage, templateName, language, enabled, variables },
    });

    res.json({ success: true, data: row });
  })
);

export default router;
