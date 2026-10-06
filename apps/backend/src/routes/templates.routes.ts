import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { getWhatsAppService } from "../services/whatsapp";
import { extractVariableCount, isValidTemplateName } from "../utils/template";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

const buttonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "WEBSITE", "PHONE"]),
  label: z.string().min(1).max(25),
  value: z.string().optional(),
});

const templateInputSchema = z.object({
  name: z.string(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  language: z.string().default("en_US"),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).default("NONE"),
  headerContent: z.string().optional(),
  body: z.string().min(1).max(1024),
  footer: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).max(3).optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, status, category, language, page = "1", pageSize = "10" } = req.query as Record<string, string>;

    const where = {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(status ? { status: status as never } : {}),
      ...(category ? { category: category as never } : {}),
      ...(language ? { language } : {}),
    };

    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.whatsAppTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, skip, take }),
      prisma.whatsAppTemplate.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const template = await prisma.whatsAppTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) throw new ApiError(404, "NOT_FOUND", "Template not found");
    res.json({ success: true, data: template });
  })
);

function validateTemplateInput(input: z.infer<typeof templateInputSchema>): void {
  if (!isValidTemplateName(input.name)) {
    throw new ApiError(400, "INVALID_NAME", "Template name must be snake_case, 3-64 characters, letters/numbers/underscores only");
  }
  if (input.headerType !== "NONE" && !input.headerContent) {
    throw new ApiError(400, "INVALID_HEADER", "Header content is required when a header type is selected");
  }
  if (input.buttons && input.buttons.length > 3) {
    throw new ApiError(400, "TOO_MANY_BUTTONS", "A template can have at most 3 buttons");
  }
}

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = templateInputSchema.parse(req.body);
    validateTemplateInput(input);

    const existing = await prisma.whatsAppTemplate.findUnique({ where: { name: input.name } });
    if (existing) throw new ApiError(409, "DUPLICATE_NAME", "A template with this name already exists");

    const template = await prisma.whatsAppTemplate.create({
      data: {
        ...input,
        buttons: input.buttons ?? undefined,
        variableCount: extractVariableCount(input.body),
        status: "DRAFT",
      },
    });

    await recordAudit({ userId: req.user?.userId, action: "TEMPLATE_CREATED", description: `Template "${template.name}" created` });

    res.status(201).json({ success: true, data: template });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = templateInputSchema.partial().parse(req.body);
    const existing = await prisma.whatsAppTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Template not found");
    if (existing.status === "APPROVED") {
      throw new ApiError(400, "TEMPLATE_LOCKED", "Approved templates cannot be edited; duplicate it to make changes");
    }

    const merged = { ...existing, ...input };
    if (input.name) validateTemplateInput(merged as never);

    const updated = await prisma.whatsAppTemplate.update({
      where: { id: existing.id },
      data: {
        ...input,
        buttons: input.buttons ?? undefined,
        variableCount: input.body ? extractVariableCount(input.body) : undefined,
      },
    });

    await recordAudit({ userId: req.user?.userId, action: "TEMPLATE_UPDATED", description: `Template "${updated.name}" updated` });

    res.json({ success: true, data: updated });
  })
);

router.post(
  "/:id/duplicate",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const source = await prisma.whatsAppTemplate.findUnique({ where: { id: req.params.id } });
    if (!source) throw new ApiError(404, "NOT_FOUND", "Template not found");

    let copyName = `${source.name}_copy`;
    let suffix = 1;
    while (await prisma.whatsAppTemplate.findUnique({ where: { name: copyName } })) {
      suffix += 1;
      copyName = `${source.name}_copy_${suffix}`;
    }

    const copy = await prisma.whatsAppTemplate.create({
      data: {
        name: copyName,
        category: source.category,
        language: source.language,
        headerType: source.headerType,
        headerContent: source.headerContent,
        body: source.body,
        footer: source.footer,
        buttons: source.buttons ?? undefined,
        variableCount: source.variableCount,
        status: "DRAFT",
      },
    });

    res.status(201).json({ success: true, data: copy });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.whatsAppTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Template not found");

    await prisma.whatsAppTemplate.delete({ where: { id: existing.id } });
    await recordAudit({ userId: req.user?.userId, action: "TEMPLATE_DELETED", description: `Template "${existing.name}" deleted` });

    res.json({ success: true, data: { id: existing.id } });
  })
);

router.post(
  "/:id/submit",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const template = await prisma.whatsAppTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) throw new ApiError(404, "NOT_FOUND", "Template not found");

    await prisma.whatsAppTemplate.update({ where: { id: template.id }, data: { status: "PENDING" } });

    const service = getWhatsAppService();
    const result = await service.submitTemplate({
      name: template.name,
      category: template.category,
      language: template.language,
      body: template.body,
    });

    const updated = await prisma.whatsAppTemplate.update({
      where: { id: template.id },
      data: {
        status: result.status === "approved" ? "APPROVED" : result.status === "rejected" ? "REJECTED" : "PENDING",
        rejectionReason: result.rejectionReason ?? null,
      },
    });

    await recordAudit({ userId: req.user?.userId, action: "TEMPLATE_SUBMITTED", description: `Template "${template.name}" submitted for approval` });

    res.json({ success: true, data: updated });
  })
);

// Pull real templates from Meta API, replacing all local templates
router.post(
  "/pull",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const service = getWhatsAppService();
    if (!service.fetchTemplates) {
      throw new ApiError(400, "NOT_SUPPORTED", "Template pull is only available in live mode");
    }

    const metaTemplates = await service.fetchTemplates();

    // Delete all existing templates (clear demo/seeded data)
    await prisma.whatsAppTemplate.deleteMany();

    // Insert real templates from Meta
    const created = await Promise.all(
      metaTemplates.map((t) =>
        prisma.whatsAppTemplate.create({
          data: {
            name: t.name,
            category: t.category as never,
            language: t.language,
            status: (t.status === "APPROVED"
              ? "APPROVED"
              : t.status === "REJECTED"
              ? "REJECTED"
              : t.status === "PENDING"
              ? "PENDING"
              : "DRAFT") as never,
            rejectionReason: t.rejectionReason ?? null,
            headerType: (t.headerType ?? "NONE") as never,
            headerContent: t.headerContent ?? null,
            body: t.body,
            footer: t.footer ?? null,
            variableCount: t.variableCount,
          },
        })
      )
    );

    await recordAudit({
      userId: req.user?.userId,
      action: "TEMPLATES_SYNCED",
      description: `Pulled ${created.length} template(s) from Meta WhatsApp API`,
    });

    res.json({ success: true, data: { pulled: created.length, templates: created } });
  })
);

router.post(
  "/sync",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const pendingTemplates = await prisma.whatsAppTemplate.findMany({ where: { status: "PENDING" } });
    const service = getWhatsAppService();

    const updates = await Promise.all(
      pendingTemplates.map(async (template) => {
        const result = await service.submitTemplate({
          name: template.name,
          category: template.category,
          language: template.language,
          body: template.body,
        });
        return prisma.whatsAppTemplate.update({
          where: { id: template.id },
          data: {
            status: result.status === "approved" ? "APPROVED" : result.status === "rejected" ? "REJECTED" : "PENDING",
            rejectionReason: result.rejectionReason ?? null,
          },
        });
      })
    );

    await recordAudit({ userId: req.user?.userId, action: "TEMPLATES_SYNCED", description: `Synced ${updates.length} pending template(s) from Meta` });

    res.json({ success: true, data: { updated: updates.length, templates: updates } });
  })
);

export default router;
