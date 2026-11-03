import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { getWhatsAppService } from "../../services/whatsapp";
import { recordOutboundMessage } from "../../services/conversationService";
import { isValidPhone, normalizePhone } from "../../utils/phone";

const router = Router();

// All 15 trigger events with friendly slugs for the URL
const EVENT_SLUG_MAP: Record<string, string> = {
  "enquiry-created":          "ENQUIRY_CREATED",
  "pi-created":               "PI_CREATED",
  "sales-order":              "SALES_ORDER_INITIATED",
  "order-production":         "ORDER_STATUS_PRODUCTION",
  "order-ready-dispatch":     "ORDER_STATUS_READY_DISPATCH",
  "order-dispatched":         "ORDER_STATUS_DISPATCHED",
  "order-installation":       "ORDER_STATUS_INSTALLATION",
  "order-handover":           "ORDER_STATUS_HANDOVER",
  "service-request":          "SERVICE_REQUEST_REMINDER",
  "ticket-open":              "TICKET_OPEN",
  "ticket-closed":            "TICKET_CLOSED",
  "enquiry-cancelled":        "ENQUIRY_CANCELLED_ADMIN",
  "delay-enquiry":            "DELAY_ENQUIRY_ADMIN",
  "enquiry-converted":        "ENQUIRY_CONVERTED_ADMIN",
  "prebooked-followup":       "PREBOOKED_FOLLOWUP_SALES",
};

const fireSchema = z.object({
  phone:     z.string().min(6),
  name:      z.string().min(1),
  variables: z.record(z.string()).optional(), // extra vars beyond {1: name}
});

/* ── GET /api/v1/triggers
   List all available triggers, their status and required variables     */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const configs = await (prisma as any).triggerConfig.findMany({ orderBy: { event: "asc" } });
    const cfgMap = Object.fromEntries(configs.map((c: any) => [c.event, c]));

    const triggers = Object.entries(EVENT_SLUG_MAP).map(([slug, event]) => {
      const cfg = cfgMap[event];
      return {
        slug,
        event,
        label:        cfg?.label ?? event,
        enabled:      cfg?.enabled ?? false,
        templateName: cfg?.templateName || null,
        endpoint:     `POST /api/v1/triggers/${slug}`,
        body: {
          phone:     "string — customer phone with country code, e.g. 919876543210",
          name:      "string — customer name (used as {{1}})",
          variables: "object (optional) — extra variables, e.g. { \"2\": \"your order\", \"3\": \"+91 88003 49401\" }",
        },
      };
    });

    res.json({ success: true, data: triggers });
  })
);

/* ── POST /api/v1/triggers/:slug
   Fire a specific trigger for a customer phone number                   */
router.post(
  "/:slug",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const event = EVENT_SLUG_MAP[slug];
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: "UNKNOWN_TRIGGER", message: `Unknown trigger slug "${slug}". Call GET /api/v1/triggers to see all available slugs.` },
      });
    }

    const body = fireSchema.parse(req.body);
    const phone = normalizePhone(body.phone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_PHONE", message: `Invalid phone number "${body.phone}". Use country code + number, e.g. 919876543210.` },
      });
    }

    const cfg = await (prisma as any).triggerConfig.findUnique({ where: { event } });
    if (!cfg?.enabled || !cfg.templateName) {
      return res.json({
        success: true,
        data: { fired: false, reason: cfg ? "Trigger is disabled or has no template assigned. Enable it in Settings → Triggers." : "Trigger not configured." },
      });
    }

    // Use Meta-registered language from WhatsAppTemplate
    const tpl = await prisma.whatsAppTemplate.findUnique({ where: { name: cfg.templateName }, select: { language: true, variableCount: true } });
    const language = tpl?.language || cfg.language || "en_US";

    // Merge variables: {1: name} + config static vars + caller-supplied vars
    const staticVars: Record<string, string> = cfg.variables && typeof cfg.variables === "object" ? cfg.variables as Record<string, string> : {};
    const variables: Record<string, string> = { "1": body.name, ...staticVars, ...(body.variables ?? {}) };

    try {
      const wa = getWhatsAppService();
      const result = await wa.sendMessage({ phone, templateName: cfg.templateName, language, variables });
      await recordOutboundMessage({ phone, waMessageId: result.messageId, body: null, templateName: cfg.templateName, type: "TEMPLATE" });
      res.json({ success: true, data: { fired: true, messageId: result.messageId, templateName: cfg.templateName, phone } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: "SEND_FAILED", message: err?.message ?? "Failed to send WhatsApp message." } });
    }
  })
);

export default router;
