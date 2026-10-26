import { requireManager } from "../middleware/requireManager";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { getWhatsAppService } from "../services/whatsapp";
import { recordOutboundMessage } from "../services/conversationService";

const router = Router();
router.use(requireAuth, requireManager);

/* ── Trigger definitions (source of truth) ──────────────────────────── */
export const TRIGGER_DEFS = [
  // Customer-facing
  { event: "ENQUIRY_CREATED",           label: "Enquiry Created",                         recipient: "CUSTOMER"   },
  { event: "PI_CREATED",                label: "PI (Proforma Invoice) Created",            recipient: "CUSTOMER"   },
  { event: "SALES_ORDER_INITIATED",     label: "Sales Order Initiated",                   recipient: "CUSTOMER"   },
  { event: "SERVICE_REQUEST_REMINDER",  label: "Service Request Reminder",                recipient: "CUSTOMER"   },
  { event: "TICKET_OPEN",               label: "Ticket Opened",                           recipient: "CUSTOMER"   },
  { event: "TICKET_CLOSED",             label: "Ticket Closed",                           recipient: "CUSTOMER"   },
  { event: "ORDER_STATUS_PRODUCTION",   label: "Order Status → Production",               recipient: "CUSTOMER"   },
  { event: "ORDER_STATUS_READY_DISPATCH", label: "Order Status → Ready for Dispatch",     recipient: "CUSTOMER"   },
  { event: "ORDER_STATUS_DISPATCHED",   label: "Order Status → Dispatched",               recipient: "CUSTOMER"   },
  { event: "ORDER_STATUS_INSTALLATION", label: "Order Status → Installation Scheduled",   recipient: "CUSTOMER"   },
  { event: "ORDER_STATUS_HANDOVER",     label: "Order Status → Handover",                 recipient: "CUSTOMER"   },
  // Admin-facing
  { event: "ENQUIRY_CANCELLED_ADMIN",   label: "Enquiry Cancelled / On Hold",             recipient: "ADMIN"      },
  { event: "DELAY_ENQUIRY_ADMIN",       label: "Delay Enquiry Alert",                     recipient: "ADMIN"      },
  { event: "ENQUIRY_CONVERTED_ADMIN",   label: "Enquiry Converted to Sales Order",        recipient: "ADMIN"      },
  // Salesperson
  { event: "PREBOOKED_FOLLOWUP_SALES",  label: "Pre-booked Follow-up Reminder",           recipient: "SALESPERSON" },
] as const;

/* ── Seed missing rows so all 15 always exist ────────────────────────── */
async function seedTriggers() {
  const existing = await (prisma as any).triggerConfig.findMany({ select: { event: true } });
  const existingSet = new Set(existing.map((r: any) => r.event));
  const toCreate = TRIGGER_DEFS.filter((d) => !existingSet.has(d.event));
  if (toCreate.length) {
    await (prisma as any).triggerConfig.createMany({
      data: toCreate.map((d) => ({
        event:        d.event,
        label:        d.label,
        recipient:    d.recipient,
        templateName: "",
        language:     "en",
        enabled:      false,
      })),
      skipDuplicates: true,
    });
  }
}

/* GET /api/triggers — list all 15 triggers with their config */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    await seedTriggers();
    const rows = await (prisma as any).triggerConfig.findMany({ orderBy: { event: "asc" } });
    // Merge with TRIGGER_DEFS to guarantee label/recipient even if DB is stale
    const defMap = Object.fromEntries(TRIGGER_DEFS.map((d) => [d.event, d]));
    const merged = rows.map((r: any) => ({ ...r, ...defMap[r.event] }));
    res.json({ success: true, data: merged });
  })
);

/* PUT /api/triggers/:event — update a single trigger config */
router.put(
  "/:event",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { event } = req.params;
    const validEvents = TRIGGER_DEFS.map((d) => d.event) as string[];
    if (!validEvents.includes(event)) {
      return res.status(400).json({ success: false, error: "INVALID_EVENT", message: "Unknown trigger event" });
    }

    const body = z.object({
      templateName: z.string(),
      language:     z.string().default("en"),
      enabled:      z.boolean(),
    }).parse(req.body);

    const def = TRIGGER_DEFS.find((d) => d.event === event)!;
    const row = await (prisma as any).triggerConfig.upsert({
      where:  { event },
      update: { ...body, updatedAt: new Date() },
      create: { event, label: def.label, recipient: def.recipient, ...body },
    });

    res.json({ success: true, data: row });
  })
);

/* POST /api/triggers/fire — programmatically fire a trigger for a phone number */
router.post(
  "/fire",
  asyncHandler(async (req, res) => {
    const { event, phone, contactName, variables } = z.object({
      event:       z.string(),
      phone:       z.string(),
      contactName: z.string().optional(),
      variables:   z.record(z.string()).optional(),
    }).parse(req.body);

    const cfg = await (prisma as any).triggerConfig.findUnique({ where: { event } });
    if (!cfg || !cfg.enabled || !cfg.templateName) {
      return res.json({ success: true, data: { fired: false, reason: "Trigger disabled or not configured" } });
    }

    try {
      const wa = getWhatsAppService();
      const result = await wa.sendMessage({
        phone,
        templateName: cfg.templateName,
        language:     cfg.language,
        variables:    variables ?? (contactName ? { "1": contactName } : {}),
      });
      await recordOutboundMessage({
        phone,
        waMessageId:  result.messageId,
        body:         null,
        templateName: cfg.templateName,
        type:         "TEMPLATE",
      });
      res.json({ success: true, data: { fired: true, messageId: result.messageId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: "FIRE_FAILED", message: err.message });
    }
  })
);

export default router;
