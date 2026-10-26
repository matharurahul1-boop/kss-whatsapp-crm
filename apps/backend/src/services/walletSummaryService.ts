import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getOrCreateWallet } from "./walletService";

export async function getWalletSummary() {
  const current = await getOrCreateWallet();
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: current.id } });
    const groups = await tx.walletTransaction.groupBy({ by: ["type"], where: { walletId: wallet.id }, _sum: { amount: true } });
    const sum = (type: "TOPUP" | "DEBIT" | "REFUND") => new Prisma.Decimal(groups.find((group) => group.type === type)?._sum.amount ?? 0);
    const topUps = sum("TOPUP");
    const grossUsage = sum("DEBIT").negated();
    const refunds = sum("REFUND");
    return {
      walletId: wallet.id, currency: wallet.currency, totalTopUps: Number(topUps),
      totalUsed: Number(grossUsage.minus(refunds)), grossUsage: Number(grossUsage),
      totalRefunds: Number(refunds), balance: Number(wallet.balance),
    };
  }, { isolationLevel: "RepeatableRead" });
}
