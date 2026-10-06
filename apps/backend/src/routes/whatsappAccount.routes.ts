import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { getWhatsAppService } from "../services/whatsapp";
import { recordAudit } from "../lib/audit";
import { env } from "../config/env";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    let account = await prisma.whatsAppAccount.findFirst();
    if (!account) {
      account = await prisma.whatsAppAccount.create({ data: {} });
    }
    res.json({ success: true, data: { ...account, mode: env.metaMode } });
  })
);

router.post(
  "/connect",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const service = getWhatsAppService();
    const result = await service.connectAccount();

    let account = await prisma.whatsAppAccount.findFirst();
    const data = {
      status: "CONNECTED" as const,
      businessName: result.businessName,
      wabaId: result.wabaId,
      phoneNumberId: result.phoneNumberId,
      displayPhoneNumber: result.displayPhoneNumber,
      qualityRating: result.qualityRating,
      lastConnectedAt: new Date(),
    };

    account = account
      ? await prisma.whatsAppAccount.update({ where: { id: account.id }, data })
      : await prisma.whatsAppAccount.create({ data });

    await recordAudit({ userId: req.user?.userId, action: "WHATSAPP_ACCOUNT_CONNECTED", description: `WhatsApp account connected (${env.metaMode} mode)` });

    res.json({ success: true, data: { ...account, mode: env.metaMode } });
  })
);

router.post(
  "/test",
  asyncHandler(async (req, res) => {
    const service = getWhatsAppService();
    const result = await service.testConnection();

    const account = await prisma.whatsAppAccount.findFirst();
    if (account) {
      await prisma.whatsAppAccount.update({ where: { id: account.id }, data: { lastTestedAt: new Date() } });
    }

    res.json({ success: true, data: { ...result, mode: env.metaMode } });
  })
);

export default router;
