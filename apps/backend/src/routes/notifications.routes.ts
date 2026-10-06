import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { getWhatsAppService } from "../services/whatsapp";
import { scheduleMockDeliveryProgression } from "../services/messageSimulator";
import { ApiError } from "../middleware/errorHandler";
import { env } from "../config/env";
import { recordOutboundMessage } from "../services/conversationService";
import { isValidPhone, normalizePhone } from "../utils/phone";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const {
      search,
      status,
      templateId,
      campaignId,
      contactId,
      dateFrom,
      dateTo,
      page = "1",
      pageSize = "15",
    } = req.query as Record<string, string>;

    const where = {
      ...(status ? { status: status as never } : {}),
      ...(templateId ? { templateId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(contactId ? { contactId } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { phone: { contains: search } },
              { messageId: { contains: search } },
              { contact: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { contact: true, template: true, campaign: true },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

const sendSchema = z.object({
  contactId: z.string().optional(),
  phone: z.string().optional(),
  templateId: z.string(),
  variables: z.record(z.string()).default({}),
});

router.post(
  "/send",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = sendSchema.parse(req.body);

    const template = await prisma.whatsAppTemplate.findUnique({ where: { id: input.templateId } });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    if (template.status !== "APPROVED") throw new ApiError(400, "TEMPLATE_NOT_APPROVED", "Only approved templates can be used to send messages");

    let contact = input.contactId ? await prisma.contact.findUnique({ where: { id: input.contactId } }) : null;
    let phone = contact?.phone ?? (input.phone ? normalizePhone(input.phone) : undefined);

    if (!phone) throw new ApiError(400, "MISSING_RECIPIENT", "A contact or phone number is required");
    if (!isValidPhone(phone)) throw new ApiError(400, "INVALID_PHONE", "Invalid recipient phone number");

    const service = getWhatsAppService();
    const result = await service.sendMessage({
      phone,
      templateName: template.name,
      language: template.language,
      variables: input.variables,
    });

    const notification = await prisma.notification.create({
      data: {
        contactId: contact?.id,
        phone,
        templateId: template.id,
        channel: "SINGLE",
        status: result.status === "failed" ? "FAILED" : "SENT",
        messageId: result.messageId || `failed_${Date.now()}`,
        variables: input.variables,
        failReason: result.failReason,
        sentAt: result.status === "sent" ? new Date() : undefined,
        failedAt: result.status === "failed" ? new Date() : undefined,
      },
    });

    if (result.status === "sent" && env.metaMode === "mock") {
      scheduleMockDeliveryProgression(result.messageId);
    }

    if (result.status === "sent") {
      void recordOutboundMessage({
        phone,
        waMessageId: result.messageId,
        body: template.body,
        templateName: template.name,
        type: "TEMPLATE",
      });
    }

    await recordAudit({
      userId: req.user?.userId,
      action: "NOTIFICATION_SENT",
      description: `Sent "${template.name}" to ${phone}`,
    });

    res.json({ success: true, data: { notification, messageId: result.messageId, status: result.status } });
  })
);

export default router;
