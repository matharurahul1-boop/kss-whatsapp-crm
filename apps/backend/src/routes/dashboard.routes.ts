import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const [account, templatesByStatus, notificationsByStatus, campaignsByStatus, recentCampaigns, recentNotifications] = await Promise.all([
      prisma.whatsAppAccount.findFirst(),
      prisma.whatsAppTemplate.groupBy({ by: ["status"], _count: true }),
      prisma.notification.groupBy({ by: ["status"], _count: true }),
      prisma.campaign.groupBy({ by: ["status"], _count: true }),
      prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { template: true } }),
      prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { contact: true, template: true } }),
    ]);

    res.json({
      success: true,
      data: {
        account,
        templatesByStatus: templatesByStatus.map((t) => ({ status: t.status, count: t._count })),
        notificationsByStatus: notificationsByStatus.map((n) => ({ status: n.status, count: n._count })),
        campaignsByStatus: campaignsByStatus.map((c) => ({ status: c.status, count: c._count })),
        recentCampaigns,
        recentNotifications,
      },
    });
  })
);

router.get(
  "/delivery-overview",
  asyncHandler(async (req, res) => {
    const days = 14;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const notifications = await prisma.notification.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, status: true },
    });

    const buckets = new Map<string, { date: string; sent: number; delivered: number; read: number; failed: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, sent: 0, delivered: 0, read: 0, failed: 0 });
    }

    for (const notification of notifications) {
      const key = notification.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (notification.status === "SENT") bucket.sent += 1;
      if (notification.status === "DELIVERED") bucket.delivered += 1;
      if (notification.status === "READ") bucket.read += 1;
      if (notification.status === "FAILED") bucket.failed += 1;
    }

    res.json({ success: true, data: Array.from(buckets.values()) });
  })
);

export default router;
