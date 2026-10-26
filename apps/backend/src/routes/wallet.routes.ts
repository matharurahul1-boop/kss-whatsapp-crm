import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { getOrCreateWallet, topUpWallet } from "../services/walletService";

const router = Router();
router.use(requireAuth);

// GET /api/wallet
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const wallet = await getOrCreateWallet();
    const transactions = await (prisma as any).walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const rates = await (prisma as any).messageRate.findMany({ orderBy: { category: "asc" } });
    res.json({ success: true, data: { wallet, transactions, rates } });
  })
);

// GET /api/wallet/transactions (paginated)
router.get(
  "/transactions",
  asyncHandler(async (req, res) => {
    const { page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const wallet = await getOrCreateWallet();
    const take = Number(pageSize);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      (prisma as any).walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      (prisma as any).walletTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    res.json({ success: true, data: { items, total, page: Number(page), pageSize: take } });
  })
);

// POST /api/wallet/topup
router.post(
  "/topup",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { amount, note } = z.object({
      amount: z.number().positive().max(100000),
      note: z.string().optional(),
    }).parse(req.body);

    const result = await topUpWallet(amount, req.user!.userId, note);
    res.json({ success: true, data: result });
  })
);

// GET /api/wallet/rates
router.get(
  "/rates",
  asyncHandler(async (_req, res) => {
    const rates = await (prisma as any).messageRate.findMany({ orderBy: { category: "asc" } });
    res.json({ success: true, data: rates });
  })
);

// PUT /api/wallet/rates
router.put(
  "/rates",
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const rates = z.array(z.object({
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
      hasMedia: z.boolean(),
      rateInr: z.number().min(0).max(100),
    })).parse(_req.body);

    const updated = await Promise.all(
      rates.map((r) =>
        (prisma as any).messageRate.upsert({
          where: { category_hasMedia: { category: r.category, hasMedia: r.hasMedia } },
          update: { rateInr: r.rateInr },
          create: r,
        })
      )
    );

    res.json({ success: true, data: updated });
  })
);

// GET /api/wallet/users
router.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ success: true, data: users });
  })
);

// PUT /api/wallet/users/:id/role
router.put(
  "/users/:id/role",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { role } = z.object({
      role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new ApiError(404, "NOT_FOUND", "User not found");

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    res.json({ success: true, data: updated });
  })
);

export default router;
