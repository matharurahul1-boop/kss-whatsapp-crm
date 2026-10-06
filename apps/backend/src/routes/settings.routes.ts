import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { maskSecret } from "../utils/mask";
import { recordAudit } from "../lib/audit";
import { env } from "../config/env";

const router = Router();
router.use(requireAuth);

router.get(
  "/meta-config",
  asyncHandler(async (req, res) => {
    const config = await prisma.metaConfig.findFirst();
    res.json({
      success: true,
      data: config
        ? {
            appId: config.appId,
            appSecretMasked: config.appSecretMasked,
            wabaId: config.wabaId,
            phoneNumberId: config.phoneNumberId,
            accessTokenMasked: config.accessTokenMasked,
            webhookVerifyToken: config.webhookVerifyToken,
            mode: env.metaMode,
            updatedAt: config.updatedAt,
          }
        : { mode: env.metaMode },
    });
  })
);

const metaConfigSchema = z.object({
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  accessToken: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
});

router.put(
  "/meta-config",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = metaConfigSchema.parse(req.body);
    const existing = await prisma.metaConfig.findFirst();

    const data = {
      appId: body.appId ?? existing?.appId,
      wabaId: body.wabaId ?? existing?.wabaId,
      phoneNumberId: body.phoneNumberId ?? existing?.phoneNumberId,
      webhookVerifyToken: body.webhookVerifyToken ?? existing?.webhookVerifyToken,
      mode: env.metaMode,
      ...(body.appSecret
        ? { appSecretMasked: maskSecret(body.appSecret), appSecretHash: crypto.createHash("sha256").update(body.appSecret).digest("hex") }
        : {}),
      ...(body.accessToken
        ? { accessTokenMasked: maskSecret(body.accessToken), accessTokenHash: crypto.createHash("sha256").update(body.accessToken).digest("hex") }
        : {}),
    };

    const saved = existing
      ? await prisma.metaConfig.update({ where: { id: existing.id }, data })
      : await prisma.metaConfig.create({ data });

    await recordAudit({ userId: req.user?.userId, action: "META_CONFIG_UPDATED", description: "Meta WhatsApp configuration updated" });

    res.json({
      success: true,
      data: {
        appId: saved.appId,
        appSecretMasked: saved.appSecretMasked,
        wabaId: saved.wabaId,
        phoneNumberId: saved.phoneNumberId,
        accessTokenMasked: saved.accessTokenMasked,
        webhookVerifyToken: saved.webhookVerifyToken,
        mode: env.metaMode,
      },
    });
  })
);

router.get("/system-mode", (req, res) => {
  res.json({ success: true, data: { mode: env.metaMode } });
});

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

router.put(
  "/profile",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = profileSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
      return;
    }

    const data: { name?: string; passwordHash?: string } = {};
    if (body.name) data.name = body.name;

    if (body.newPassword) {
      if (!body.currentPassword || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
        res.status(400).json({ success: false, error: { code: "INVALID_PASSWORD", message: "Current password is incorrect" } });
        return;
      }
      data.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    await recordAudit({ userId: user.id, action: "PROFILE_UPDATED", description: "Account profile updated" });

    res.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ success: true, data: { items, total, page, pageSize } });
  })
);

export default router;
