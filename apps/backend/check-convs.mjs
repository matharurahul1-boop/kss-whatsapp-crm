import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ path: "./apps/backend/.env" });
const prisma = new PrismaClient();
const convs = await prisma.conversation.findMany({
  select: { id: true, phone: true, lastMessageAt: true },
  orderBy: { lastMessageAt: "desc" },
});
console.log("Total conversations:", convs.length);
convs.forEach(c => console.log(` - ${c.phone} | last: ${c.lastMessageAt}`));
await prisma.$disconnect();
