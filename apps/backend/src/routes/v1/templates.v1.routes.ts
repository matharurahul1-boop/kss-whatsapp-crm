import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string>;
    const templates = await prisma.whatsAppTemplate.findMany({
      where: status ? { status: status as never } : { status: "APPROVED" },
      select: { id: true, name: true, category: true, language: true, status: true, body: true, variableCount: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: templates });
  })
);

export default router;
