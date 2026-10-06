import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { generateApiKey } from "../utils/apiKey";
import { ApiError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
    res.json({
      success: true,
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        enabled: k.enabled,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
        revokedAt: k.revokedAt,
      })),
    });
  })
);

const createSchema = z.object({ name: z.string().min(1) });

router.post(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { name } = createSchema.parse(req.body);
    const { fullKey, prefix, hash } = generateApiKey();

    const record = await prisma.apiKey.create({
      data: { name, keyPrefix: prefix, keyHash: hash, createdById: req.user?.userId },
    });

    await recordAudit({ userId: req.user?.userId, action: "API_KEY_GENERATED", description: `API key "${name}" generated` });

    res.status(201).json({
      success: true,
      data: { id: record.id, name: record.name, key: fullKey, keyPrefix: record.keyPrefix, createdAt: record.createdAt },
    });
  })
);

router.post(
  "/:id/regenerate",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "API key not found");

    const { fullKey, prefix, hash } = generateApiKey();
    const updated = await prisma.apiKey.update({
      where: { id: existing.id },
      data: { keyPrefix: prefix, keyHash: hash, enabled: true, revokedAt: null },
    });

    await recordAudit({ userId: req.user?.userId, action: "API_KEY_REGENERATED", description: `API key "${existing.name}" regenerated` });

    res.json({ success: true, data: { id: updated.id, name: updated.name, key: fullKey, keyPrefix: updated.keyPrefix } });
  })
);

router.patch(
  "/:id/toggle",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "API key not found");

    const updated = await prisma.apiKey.update({ where: { id: existing.id }, data: { enabled: !existing.enabled } });
    res.json({ success: true, data: { id: updated.id, enabled: updated.enabled } });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const existing = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "API key not found");

    const updated = await prisma.apiKey.update({ where: { id: existing.id }, data: { enabled: false, revokedAt: new Date() } });

    await recordAudit({ userId: req.user?.userId, action: "API_KEY_REVOKED", description: `API key "${existing.name}" revoked` });

    res.json({ success: true, data: { id: updated.id } });
  })
);

export default router;
