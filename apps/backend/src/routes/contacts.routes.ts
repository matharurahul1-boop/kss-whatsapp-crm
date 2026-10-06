import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { isValidPhone, normalizePhone } from "../utils/phone";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { search, source, tag, page = "1", pageSize = "10" } = req.query as Record<string, string>;

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
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
        notes: input.notes,
        tags: { connect: tagConnections },
      },
      include: { tags: true },
    });

    await recordAudit({ userId: req.user?.userId, action: "CONTACT_CREATED", description: `Contact "${contact.name}" created` });

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
        notes: input.notes,
        ...(tagConnections ? { tags: { set: tagConnections } } : {}),
      },
      include: { tags: true },
    });

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

export default router;
