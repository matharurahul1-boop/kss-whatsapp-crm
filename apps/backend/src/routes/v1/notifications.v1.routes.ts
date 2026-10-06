import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Math.min(Number(req.query.pageSize ?? 20), 100);
    const { phone, status } = req.query as Record<string, string>;

    const where = {
      ...(phone ? { phone } : {}),
      ...(status ? { status: status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, phone: true, status: true, messageId: true, createdAt: true, sentAt: true, deliveredAt: true, readAt: true, failReason: true },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ success: true, data: { items, total, page, pageSize } });
  })
);

export default router;
