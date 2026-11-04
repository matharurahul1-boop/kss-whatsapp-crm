import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "./auth";
import { ApiError } from "./errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

// Reads the role from the database so a role change applies to existing tokens too.
export const requireAdminOrManager = asyncHandler(async (req: AuthenticatedRequest, _res, next) => {
  if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { role: true } });
  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") throw new ApiError(403, "FORBIDDEN", "Only admins and managers can view users");
  next();
});
