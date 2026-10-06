import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

const templateFindUnique = vi.fn();
const contactFindMany = vi.fn();
const campaignCreate = vi.fn();
const recipientCreateMany = vi.fn();

vi.mock("../lib/prisma", () => ({
  prisma: {
    whatsAppTemplate: { findUnique: (...args: unknown[]) => templateFindUnique(...args) },
    contact: { findMany: (...args: unknown[]) => contactFindMany(...args) },
    campaign: { create: (...args: unknown[]) => campaignCreate(...args), findMany: vi.fn(), count: vi.fn() },
    campaignRecipient: { createMany: (...args: unknown[]) => recipientCreateMany(...args) },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: { user: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: "user_1", email: "admin@kssinteriors.com", role: "ADMIN" };
    next();
  },
}));

vi.mock("../services/campaignQueue", () => ({
  enqueueCampaign: vi.fn(),
}));

import campaignsRoutes from "../routes/campaigns.routes";
import { errorHandler } from "../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/campaigns", campaignsRoutes);
  app.use(errorHandler);
  return app;
}

describe("POST /api/campaigns", () => {
  beforeEach(() => {
    templateFindUnique.mockReset();
    contactFindMany.mockReset();
    campaignCreate.mockReset();
    recipientCreateMany.mockReset();
  });

  it("refuses to create a campaign with a non-approved template", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", status: "PENDING" });

    const res = await request(buildApp())
      .post("/api/campaigns")
      .send({ name: "Test Campaign", templateId: "tpl_1", audience: { type: "ALL" }, variableMap: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TEMPLATE_NOT_APPROVED");
    expect(campaignCreate).not.toHaveBeenCalled();
  });

  it("refuses to create a campaign when the audience has no valid recipients", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", status: "APPROVED" });
    contactFindMany.mockResolvedValue([]);

    const res = await request(buildApp())
      .post("/api/campaigns")
      .send({ name: "Test Campaign", templateId: "tpl_1", audience: { type: "ALL" }, variableMap: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("EMPTY_AUDIENCE");
  });

  it("filters out contacts with invalid phone numbers before creating recipients", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", status: "APPROVED" });
    contactFindMany.mockResolvedValue([
      { id: "c1", phone: "919876543210", name: "Aarav Sharma" },
      { id: "c2", phone: "123", name: "Bad Number" },
    ]);
    campaignCreate.mockResolvedValue({ id: "camp_1", name: "Test Campaign", totalRecipients: 1 });
    recipientCreateMany.mockResolvedValue({ count: 1 });

    const res = await request(buildApp())
      .post("/api/campaigns")
      .send({ name: "Test Campaign", templateId: "tpl_1", audience: { type: "ALL" }, variableMap: {} });

    expect(res.status).toBe(201);
    expect(campaignCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalRecipients: 1 }) }));
    expect(recipientCreateMany).toHaveBeenCalledWith({ data: [{ campaignId: "camp_1", contactId: "c1" }] });
  });
});
