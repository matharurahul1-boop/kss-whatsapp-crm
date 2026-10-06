import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { getWhatsAppService } from "../../services/whatsapp";
import { scheduleMockDeliveryProgression } from "../../services/messageSimulator";
import { isValidPhone, normalizePhone } from "../../utils/phone";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();

const sendSchema = z.object({
  phone: z.string().min(6),
  template: z.string().min(1),
  language: z.string().default("en_US"),
  variables: z.record(z.string()).default({}),
});

router.post(
  "/send",
  asyncHandler(async (req, res) => {
    const input = sendSchema.parse(req.body);
    const phone = normalizePhone(input.phone);

    if (!isValidPhone(phone)) {
      throw new ApiError(400, "INVALID_PHONE", "Phone number must include country code, e.g. 91XXXXXXXXXX");
    }

    const template = await prisma.whatsAppTemplate.findUnique({ where: { name: input.template } });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", `Template "${input.template}" was not found`);
    if (template.status !== "APPROVED") {
      throw new ApiError(400, "TEMPLATE_NOT_APPROVED", `Template "${input.template}" is not approved for sending`);
    }

    const contact = await prisma.contact.findUnique({ where: { phone } });

    const service = getWhatsAppService();
    const result = await service.sendMessage({
      phone,
      templateName: template.name,
      language: input.language,
      variables: input.variables,
    });

    const notification = await prisma.notification.create({
      data: {
        contactId: contact?.id,
        phone,
        templateId: template.id,
        channel: "API",
        status: result.status === "failed" ? "FAILED" : "SENT",
        messageId: result.messageId || `failed_${Date.now()}`,
        variables: input.variables,
        failReason: result.failReason,
        sentAt: result.status === "sent" ? new Date() : undefined,
        failedAt: result.status === "failed" ? new Date() : undefined,
      },
    });

    if (result.status === "sent") {
      scheduleMockDeliveryProgression(result.messageId);
    }

    res.status(result.status === "failed" ? 422 : 200).json({
      success: result.status !== "failed",
      messageId: notification.messageId,
      status: notification.status,
    });
  })
);

export default router;
