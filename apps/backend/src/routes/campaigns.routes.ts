import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { enqueueCampaign } from "../services/campaignQueue";
import { ApiError } from "../middleware/errorHandler";
import { isValidPhone, normalizePhone } from "../utils/phone";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, page = "1", pageSize = "10" } = req.query as Record<string, string>;
    const where = status ? { status: status as never } : {};
    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, include: { template: true } }),
      prisma.campaign.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { status: recipientStatus, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id }, include: { template: true } });
    if (!campaign) throw new ApiError(404, "NOT_FOUND", "Campaign not found");

    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;
    const recipientWhere = { campaignId: campaign.id, ...(recipientStatus ? { status: recipientStatus as never } : {}) };

    const [recipients, recipientTotal] = await Promise.all([
      prisma.campaignRecipient.findMany({ where: recipientWhere, include: { contact: true }, skip, take, orderBy: { createdAt: "asc" } }),
      prisma.campaignRecipient.count({ where: recipientWhere }),
    ]);

    res.json({ success: true, data: { campaign, recipients, recipientTotal, page: Number(page), pageSize: take } });
  })
);

const audienceSchema = z.object({
  type: z.enum(["ALL", "TAGS", "IMPORTED_LIST", "MANUAL_SELECTION"]),
  tags: z.array(z.string()).optional(),
  contactIds: z.array(z.string()).optional(),
});

const campaignInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  templateId: z.string(),
  audience: audienceSchema,
  variableMap: z.record(z.string()).default({}),
  scheduledAt: z.string().datetime().optional(),
});

async function resolveAudienceContacts(audience: z.infer<typeof audienceSchema>) {
  if (audience.type === "ALL") {
    return prisma.contact.findMany();
  }
  if (audience.type === "TAGS") {
    return prisma.contact.findMany({ where: { tags: { some: { name: { in: audience.tags ?? [] } } } } });
  }
  if (audience.type === "IMPORTED_LIST") {
    return prisma.contact.findMany({ where: { source: "IMPORT" } });
  }
  return prisma.contact.findMany({ where: { id: { in: audience.contactIds ?? [] } } });
}

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = campaignInputSchema.parse(req.body);

    const template = await prisma.whatsAppTemplate.findUnique({ where: { id: input.templateId } });
    if (!template) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    if (template.status !== "APPROVED") throw new ApiError(400, "TEMPLATE_NOT_APPROVED", "Only approved templates can be used in campaigns");

    const contacts = await resolveAudienceContacts(input.audience);
    const validContacts = contacts.filter((c) => isValidPhone(normalizePhone(c.phone)));

    if (validContacts.length === 0) throw new ApiError(400, "EMPTY_AUDIENCE", "No valid recipients matched the selected audience");

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description,
        templateId: template.id,
        audienceType: input.audience.type,
        audienceFilter: input.audience,
        variableMap: input.variableMap,
        totalRecipients: validContacts.length,
        createdById: req.user?.userId,
        status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });

    await prisma.campaignRecipient.createMany({
      data: validContacts.map((c) => ({ campaignId: campaign.id, contactId: c.id })),
    });

    await recordAudit({ userId: req.user?.userId, action: "CAMPAIGN_CREATED", description: `Campaign "${campaign.name}" created with ${validContacts.length} recipients` });

    res.status(201).json({ success: true, data: campaign });
  })
);

router.post(
  "/:id/start",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) throw new ApiError(404, "NOT_FOUND", "Campaign not found");
    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      throw new ApiError(400, "INVALID_STATE", "Only draft or scheduled campaigns can be started");
    }

    enqueueCampaign(campaign.id);

    await recordAudit({ userId: req.user?.userId, action: "CAMPAIGN_STARTED", description: `Campaign "${campaign.name}" started` });

    res.json({ success: true, data: { id: campaign.id, status: "PROCESSING" } });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) throw new ApiError(404, "NOT_FOUND", "Campaign not found");
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(campaign.status)) {
      throw new ApiError(400, "INVALID_STATE", "Campaign has already finished and cannot be cancelled");
    }

    const updated = await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "CANCELLED" } });
    await recordAudit({ userId: req.user?.userId, action: "CAMPAIGN_CANCELLED", description: `Campaign "${campaign.name}" cancelled` });

    res.json({ success: true, data: updated });
  })
);

router.get(
  "/preview/audience-count",
  asyncHandler(async (req, res) => {
    const audience = audienceSchema.parse(JSON.parse((req.query.audience as string) ?? "{}"));
    const contacts = await resolveAudienceContacts(audience);
    const validCount = contacts.filter((c) => isValidPhone(normalizePhone(c.phone))).length;
    res.json({ success: true, data: { total: contacts.length, valid: validCount, invalid: contacts.length - validCount } });
  })
);

export default router;
