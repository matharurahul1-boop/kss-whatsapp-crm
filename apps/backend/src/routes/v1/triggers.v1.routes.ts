import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { getWhatsAppService } from "../../services/whatsapp";
import { recordOutboundMessage } from "../../services/conversationService";
import { isValidPhone, normalizePhone } from "../../utils/phone";
import { recipientFromTemplateName, resolveRecipientPhones, getTeamContactLines, RecipientKind } from "../../services/internalRecipients";

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

// Friendly parameter names -> template variable numbers. Work in the JSON body and as URL (query) parameters.
// Contact details always use the same "Name: Number" format.
const ALIASES: Record<string, Record<string, string>> = {
  "enquiry-created":  { product: "2", contact1: "3", contact2: "4", contact3: "5", contact4: "6", contact5: "7" },
  "pi-created":       { project: "2", contact1: "3", contact2: "4", contact3: "5", contact4: "6", contact5: "7" },
  "ticket-open":      { concern: "2", ticket: "3", contact1: "4", contact2: "5", contact3: "6", contact4: "7", contact5: "8" },
  "order-dispatched": { order: "2", dispatchDate: "3", contact1: "4", contact2: "5", contact3: "6", contact4: "7", contact5: "8" },
};

// Contacts from Settings > Team Contacts fill the template automatically when the request does not send them
// (send contacts=none to skip this). `start` is the first contact variable of the template; the template has either
//  - five contact variables (start .. start+4): one contact per variable, unused ones become "N/A", or
//  - one contact variable (start): ALL contacts joined with ", " (a WhatsApp parameter cannot contain line breaks)
const CONTACT_START: Record<string, number> = { "enquiry-created": 3, "pi-created": 3, "ticket-open": 4, "order-dispatched": 4 };
const CONTACT_LINES = 5;

const ROLE_LABEL: Record<string, string> = { ADMIN: "admin", MANAGER: "manager", SALESPERSON: "sales manager" };

const phoneList = z.union([z.string(), z.array(z.string())]).optional();

const fireSchema = z.object({
  phone:     z.string().optional(), // customer triggers: the customer's number
  name:      z.string().optional(), // customer triggers: customer name ({{1}})
  variables: z.record(z.string()).optional(),
  // Admin / sales manager triggers: WhatsApp numbers to notify. If omitted, the numbers saved on the Users page are used.
  adminPhones:        phoneList,
  managerPhones:      phoneList,
  salesManagerPhones: phoneList,
  salespersonPhones:  phoneList, // old name, still accepted
  contacts:  z.string().optional(), // "none": do not fill contact lines from the app's Sales Managers
  test:      z.union([z.string(), z.boolean()]).optional(), // test mode: send only to the numbers in the request
}).passthrough();

const toList = (...vs: (string | string[] | undefined)[]): string[] =>
  vs.flatMap((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function badRequest(res: any, code: string, message: string) {
  return res.status(400).json({ success: false, error: { code, message } });
}

/* ── GET /api/v1/triggers
   List all available triggers, their status and required variables     */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const configs = await (prisma as any).triggerConfig.findMany({ orderBy: { event: "asc" } });
    const cfgMap = Object.fromEntries(configs.map((c: any) => [c.event, c]));

    const triggers = Object.entries(EVENT_SLUG_MAP).map(([slug, event]) => {
      const cfg = cfgMap[event];
      const kind: string = cfg?.templateName ? recipientFromTemplateName(cfg.templateName, cfg.recipient as RecipientKind) : (cfg?.recipient ?? "CUSTOMER");
      const field = kind === "SALESPERSON" ? "salesManagerPhones" : `${kind.toLowerCase()}Phones`;
      return {
        slug,
        event,
        label:        cfg?.label ?? event,
        recipient:    kind,
        enabled:      cfg?.enabled ?? false,
        templateName: cfg?.templateName || null,
        endpoint:     `POST /api/v1/triggers/${slug}`,
        parameters: kind === "CUSTOMER"
          ? {
              phone:     "customer phone, e.g. 919876543210 (10-digit Indian numbers get 91 added)",
              name:      "customer name (used as {{1}})",
              variables: "other template variables, e.g. { \"2\": \"value\" } — or pass v2, v3... as URL parameters",
              ...(ALIASES[slug] ? { shortcuts: Object.keys(ALIASES[slug]).join(", ") + " (body or URL parameters)" } : {}),
            }
          : {
              [field]:   `optional — WhatsApp numbers to notify (comma separated). Omit to use the ${ROLE_LABEL[kind] ?? kind} numbers saved on the Users page`,
              test:      "optional — true: never use saved numbers; send only to the number(s) in the request (use phone or " + field + ")",
              variables: "ALL template variables including \"1\" — or pass v1, v2... as URL parameters",
            },
      };
    });

    res.json({ success: true, data: triggers });
  })
);

/* ── POST /api/v1/triggers/:slug
   Fire a specific trigger. Every field may be sent in the JSON body or as a URL (query) parameter. */
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

    // Body and URL parameters are merged (URL parameters win).
    const q = req.query as Record<string, unknown>;
    const reqBody = (isObj(req.body) ? req.body : {}) as Record<string, unknown>;
    const body = fireSchema.parse({
      ...reqBody, ...q,
      variables: { ...(isObj(reqBody.variables) ? reqBody.variables : {}), ...(isObj(q.variables) ? q.variables : {}) },
    });
    const testMode = ["true", "1", "yes", "on"].includes(String(body.test ?? "").toLowerCase());

    const cfg = await (prisma as any).triggerConfig.findUnique({ where: { event } });
    if (!cfg?.enabled || !cfg.templateName) {
      return res.json({
        success: true,
        data: { fired: false, reason: cfg ? "Trigger is disabled or has no template assigned. Enable it in Settings → Triggers." : "Trigger not configured." },
      });
    }

    // Who receives it: the customer, or admins / managers / sales managers
    const kind = recipientFromTemplateName(cfg.templateName, cfg.recipient as RecipientKind);
    const roleLabel = ROLE_LABEL[kind] ?? kind.toLowerCase();
    let phones: string[];
    if (kind === "CUSTOMER") {
      const phone = normalizePhone(body.phone ?? "");
      if (!isValidPhone(phone)) {
        return badRequest(res, "INVALID_PHONE", `Invalid phone number "${body.phone ?? ""}". Use country code + number, e.g. 919876543210.`);
      }
      if (!body.name?.trim()) return badRequest(res, "MISSING_NAME", "name is required for customer notifications (it fills {{1}}).");
      phones = [phone];
    } else {
      const roleField = kind === "ADMIN" ? [body.adminPhones] : kind === "MANAGER" ? [body.managerPhones] : [body.salesManagerPhones, body.salespersonPhones];
      // In test mode the plain `phone` is also accepted as the only recipient
      const given = toList(...roleField, ...(testMode ? [body.phone] : []));
      if (given.length) {
        const bad = given.filter((p) => !isValidPhone(normalizePhone(p)));
        if (bad.length) return badRequest(res, "INVALID_PHONE", `Invalid phone number(s): ${bad.join(", ")}.`);
        phones = [...new Set(given.map(normalizePhone))];
      } else if (testMode) {
        return badRequest(res, "TEST_MODE_NEEDS_PHONE", `Test mode never uses the saved ${roleLabel} numbers. Pass the number to test with in "phone".`);
      } else {
        phones = await resolveRecipientPhones(kind, "");
      }
      if (!phones.length) {
        return res.json({
          success: true,
          data: { fired: false, reason: `No ${roleLabel} WhatsApp numbers: pass them in the request ("phone" with test=true), or save them on the Users page.` },
        });
      }
    }

    // Use Meta-registered language from WhatsAppTemplate
    const tpl = await prisma.whatsAppTemplate.findUnique({ where: { name: cfg.templateName }, select: { language: true, variableCount: true } });
    const language = tpl?.language || cfg.language || "en_US";

    // Variables: {1: name} + saved defaults + body "variables" + shortcuts (product, contact1...) + v1, v2... parameters
    const staticVars: Record<string, string> = cfg.variables && typeof cfg.variables === "object" ? { ...(cfg.variables as Record<string, string>) } : {};
    // Which variables carry the team contacts for this trigger and template
    const tplVars = tpl?.variableCount ?? 0;
    const start = CONTACT_START[slug];
    let lineSlots: number[] = [];
    let joinedSlot: number | undefined;
    if (start) {
      if (tplVars >= start + CONTACT_LINES - 1) lineSlots = Array.from({ length: CONTACT_LINES }, (_, i) => start + i); // five contact variables
      else if (tplVars === start) joinedSlot = start;                                                                   // one variable, all contacts
      else if (tplVars === 0) { if (slug === "enquiry-created") lineSlots = Array.from({ length: CONTACT_LINES }, (_, i) => start + i); else joinedSlot = start; }
    }
    // Contacts come from the request or Settings > Team Contacts, never from the trigger's own saved defaults
    if (start) for (let i = 0; i < CONTACT_LINES; i++) delete staticVars[String(start + i)];
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v !== "string") continue;
      const m = /^v(\d+)$/.exec(k);
      if (m) extra[m[1]] = v;
      const alias = ALIASES[slug]?.[k];
      if (alias) extra[alias] = v;
    }
    let variables: Record<string, string> = { ...(body.name?.trim() ? { "1": body.name.trim() } : {}), ...staticVars, ...(body.variables ?? {}), ...extra };
    // Contacts: if the request sends any (contact1, contact2...), only those are used and the rest become N/A.
    // If it sends none, ALL contacts saved in Settings > Team Contacts are used.
    const useSaved = String(body.contacts ?? "").toLowerCase() !== "none";
    const isEmpty = (n: number) => !String(variables[String(n)] ?? "").trim();
    const sentByRequest = lineSlots.some((n) => !isEmpty(n)) || (joinedSlot !== undefined && !isEmpty(joinedSlot));
    if (useSaved && !sentByRequest && (lineSlots.length || joinedSlot)) {
      const team = await getTeamContactLines();
      lineSlots.forEach((n, i) => { if (team[i]) variables[String(n)] = team[i]; });
      if (joinedSlot && team.length) variables[String(joinedSlot)] = team.join(", ");
    }
    // Contact lines nobody supplied are delivered as N/A
    for (const n of lineSlots) if (isEmpty(n)) variables[String(n)] = "N/A";

    // WhatsApp rejects a message whose variable count differs from the template, so check before sending.
    if (tpl?.variableCount) {
      const missing: number[] = [];
      const exact: Record<string, string> = {};
      for (let n = 1; n <= tpl.variableCount; n++) {
        const v = String(variables[String(n)] ?? "").trim();
        if (!v) missing.push(n); else exact[String(n)] = v;
      }
      if (missing.length) {
        return badRequest(res, "MISSING_VARIABLES",
          `Template "${cfg.templateName}" needs ${tpl.variableCount} variables. Missing: ${missing.map((n) => `{{${n}}}`).join(", ")}. Send them as "variables": {"${missing[0]}": "value"} or the URL parameter v${missing[0]}=value.`);
      }
      variables = exact; // drop any extra keys the template doesn't use
    }

    try {
      const wa = getWhatsAppService();
      const messageIds: string[] = [];
      const failures: string[] = [];
      for (const to of phones) {
        const result = await wa.sendMessage({ phone: to, templateName: cfg.templateName, language, variables });
        if (result.status === "failed" || !result.messageId) {
          failures.push(`${to}: ${result.failReason ?? "WhatsApp rejected the message"}`);
          continue;
        }
        await recordOutboundMessage({ phone: to, waMessageId: result.messageId, body: null, templateName: cfg.templateName, variables, type: "TEMPLATE" });
        messageIds.push(result.messageId);
      }
      if (!messageIds.length) {
        return res.status(502).json({ success: false, error: { code: "SEND_FAILED", message: failures.join(" | ") } });
      }
      res.json({
        success: true,
        data: {
          fired: true, messageId: messageIds[0], messageIds, templateName: cfg.templateName,
          recipient: kind, sentTo: messageIds.length,
          ...(testMode ? { testMode: true } : {}),
          ...(failures.length ? { failed: failures } : {}),
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: "SEND_FAILED", message: err?.message ?? "Failed to send WhatsApp message." } });
    }
  })
);

export default router;
