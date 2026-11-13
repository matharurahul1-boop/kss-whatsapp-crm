import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";
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

// PUT /api/users/:id — admins edit a user's name, role and WhatsApp number ("" clears the number)
router.put(
  "/:id",
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = z.object({
      name: z.string().trim().min(1).max(100).optional(),
      role: z.enum(["ADMIN", "MANAGER", "SALESPERSON"]).optional(),
      phone: z.string().max(30).optional(),
    }).parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "User not found");
    if (input.role && input.role !== target.role && target.id === req.user!.userId) {
      throw new ApiError(400, "CANNOT_CHANGE_OWN_ROLE", "You cannot change your own role. Ask another admin.");
    }

    let phone: string | null | undefined;
    if (input.phone !== undefined) {
      const normalized = normalizePhone(input.phone);
      if (normalized && !isValidPhone(normalized)) throw new ApiError(400, "INVALID_PHONE", "Enter the number with country code, e.g. 919876543210");
      phone = normalized || null;
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { ...(input.name ? { name: input.name } : {}), ...(input.role ? { role: input.role } : {}), ...(phone !== undefined ? { phone } : {}) },
      select: { id: true, name: true, email: true, role: true, phone: true },
    });
    res.json({ success: true, data: user });
  })
);

export default router;
