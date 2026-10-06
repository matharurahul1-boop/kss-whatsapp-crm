import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";
import { isValidPhone, normalizePhone } from "../../utils/phone";
import { ApiError } from "../../middleware/errorHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);

    const [items, total] = await Promise.all([
      prisma.contact.findMany({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" }, include: { tags: true } }),
      prisma.contact.count(),
    ]);

    res.json({ success: true, data: { items, total, page, pageSize } });
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const phone = normalizePhone(input.phone);

    if (!isValidPhone(phone)) throw new ApiError(400, "INVALID_PHONE", "Phone number must include country code, e.g. 91XXXXXXXXXX");

    const existing = await prisma.contact.findUnique({ where: { phone } });
    if (existing) throw new ApiError(409, "DUPLICATE_CONTACT", "A contact with this phone number already exists");

    const contact = await prisma.contact.create({
      data: { name: input.name, phone, email: input.email, notes: input.notes, source: "CRM_API" },
    });

    res.status(201).json({ success: true, data: contact });
  })
);

export default router;
