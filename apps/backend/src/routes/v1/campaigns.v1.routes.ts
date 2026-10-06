import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { enqueueCampaign } from "../../services/campaignQueue";
import { isValidPhone, normalizePhone } from "../../utils/phone";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  templateName: z.string().min(1),
  contactPhones: z.array(z.string()).min(1),
  variableMap: z.record(z.string()).default({}),
  autoStart: z.boolean().default(true),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);

    const template = await prisma.whatsAppTemplate.findUnique({ where: { name: input.templateName } });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    if (template.status !== "APPROVED") throw new ApiError(400, "TEMPLATE_NOT_APPROVED", "Only approved templates can be used in campaigns");

    const normalizedPhones = input.contactPhones.map(normalizePhone).filter(isValidPhone);
    if (normalizedPhones.length === 0) throw new ApiError(400, "NO_VALID_RECIPIENTS", "No valid recipient phone numbers provided");

    const contacts = await prisma.contact.findMany({ where: { phone: { in: normalizedPhones } } });

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        templateId: template.id,
        audienceType: "MANUAL_SELECTION",
        audienceFilter: { phones: normalizedPhones },
        variableMap: input.variableMap,
        totalRecipients: contacts.length,
        status: "DRAFT",
      },
    });

    await prisma.campaignRecipient.createMany({
      data: contacts.map((c) => ({ campaignId: campaign.id, contactId: c.id })),
    });

    if (input.autoStart && contacts.length > 0) {
      enqueueCampaign(campaign.id);
    }

    res.status(201).json({ success: true, data: { id: campaign.id, name: campaign.name, recipients: contacts.length } });
  })
);

export default router;
