import { prisma } from "../lib/prisma";
import { isValidPhone, normalizePhone } from "../utils/phone";

export type RecipientKind = "CUSTOMER" | "ADMIN" | "MANAGER" | "SALESPERSON";

// Templates are named <purpose>_<audience>, e.g. enquiry_cancelled_or_on_hold_admin.
export function recipientFromTemplateName(templateName: string, fallback: RecipientKind = "CUSTOMER"): RecipientKind {
  if (templateName.endsWith("_admin")) return "ADMIN";
  if (templateName.endsWith("_manager")) return "MANAGER";
  if (templateName.endsWith("_sales") || templateName.endsWith("_salesperson")) return "SALESPERSON";
  if (templateName.endsWith("_customer")) return "CUSTOMER";
  return fallback;
}

/** WhatsApp numbers to deliver to: the customer's own number, or every user with that role who has a number saved. */
export async function resolveRecipientPhones(kind: RecipientKind, customerPhone: string): Promise<string[]> {
  if (kind === "CUSTOMER") return [customerPhone];
  const users: { phone: string | null }[] = await (prisma as any).user.findMany({ where: { role: kind }, select: { phone: true } });
  const phones = users.map((u) => normalizePhone(u.phone ?? "")).filter(isValidPhone);
  return [...new Set(phones)];
}

export interface ContactContext { id: string; name: string; stage?: string; notes?: string | null }

/** Variables for internal templates, filled from the contact. Customer templates only get {{1}} = name. */
export function internalVariables(templateName: string, c: ContactContext, stageLabel: string): Record<string, string> {
  const note = c.notes?.trim() || "-";
  switch (templateName) {
    case "enquiry_cancelled_or_on_hold_admin":
      return { "1": stageLabel, "2": c.id, "3": c.name, "4": note, "5": note };
    case "enquiry_converted_to_sales_order_admin":
      return { "1": c.id, "2": "-", "3": c.name, "4": "-" };
    default:
      return { "1": c.name };
  }
}
