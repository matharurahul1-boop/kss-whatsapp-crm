import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "./auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

// Consult the database so changing a role takes effect even for existing tokens.
export const requireManager = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { role: true } });
  if (user?.role !== "MANAGER") throw new ApiError(403, "MANAGER_ONLY", "Only managers can access this feature");
  next();
});
