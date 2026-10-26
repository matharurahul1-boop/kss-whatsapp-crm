import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "./auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

export const requireBillingViewer = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { role: true } });
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) throw new ApiError(403, "FORBIDDEN", "Only admins and managers can view wallet alerts and totals");
  next();
});
