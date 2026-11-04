import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requireAdminOrManager } from "../middleware/requireAdminOrManager";
import { ApiError } from "../middleware/errorHandler";
import { isValidPhone, normalizePhone } from "../utils/phone";

const router = Router();
router.use(requireAuth, requireAdminOrManager);

// GET /api/users — all users (never exposes password hashes or push subscriptions)
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, phone: true, pushSubscription: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      success: true,
      data: users.map(({ pushSubscription, ...u }) => ({ ...u, pushEnabled: Boolean(pushSubscription) })),
    });
  })
);

// PUT /api/users/:id/phone — WhatsApp number that receives this user's internal notifications ("" clears it)
router.put(
  "/:id/phone",
  asyncHandler(async (req, res) => {
    const { phone } = z.object({ phone: z.string().max(30) }).parse(req.body);
    const normalized = normalizePhone(phone);
    if (normalized && !isValidPhone(normalized)) throw new ApiError(400, "INVALID_PHONE", "Enter the number with country code, e.g. 919876543210");
    const exists = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) throw new ApiError(404, "NOT_FOUND", "User not found");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { phone: normalized || null }, select: { id: true, phone: true } });
    res.json({ success: true, data: user });
  })
);

export default router;
