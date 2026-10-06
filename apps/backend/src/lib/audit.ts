import { prisma } from "./prisma";

export async function recordAudit(params: {
  userId?: string | null;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      description: params.description,
      metadata: params.metadata ? (params.metadata as object) : undefined,
    },
  });
}
