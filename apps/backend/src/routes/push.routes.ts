import { Router } from "express";
import webpush from "web-push";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();
router.use(requireAuth);

// Only initialise VAPID when all three keys are present — missing keys just disable push
if (env.vapidPublicKey && env.vapidPrivateKey && env.vapidEmail) {
  try {
    webpush.setVapidDetails(`mailto:${env.vapidEmail}`, env.vapidPublicKey, env.vapidPrivateKey);
  } catch (err) {
    console.warn("[push] VAPID init failed — push notifications disabled:", err);
  }
}

// Save push subscription for current user
router.post(
  "/subscribe",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const subscription = req.body;
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pushSubscription: JSON.stringify(subscription) },
    });
    res.json({ success: true });
  })
);

// Remove push subscription
router.post(
  "/unsubscribe",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pushSubscription: null },
    });
    res.json({ success: true });
  })
);

// Get VAPID public key (needed by frontend to subscribe)
router.get(
  "/vapid-public-key",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { publicKey: env.vapidPublicKey } });
  })
);

export default router;

// Exported helper — called from webhook to notify all users
export async function sendPushToAllUsers(payload: { title: string; body: string; url?: string }) {
  try {
    const users = await prisma.user.findMany({
      where: { pushSubscription: { not: null } },
      select: { id: true, pushSubscription: true },
    });

    for (const user of users) {
      if (!user.pushSubscription) continue;
      try {
        await webpush.sendNotification(
          JSON.parse(user.pushSubscription),
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        // Subscription expired/invalid — remove it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await prisma.user.update({ where: { id: user.id }, data: { pushSubscription: null } });
        }
      }
    }
  } catch (err) {
    console.error("[push] sendPushToAllUsers error:", err);
  }
}
