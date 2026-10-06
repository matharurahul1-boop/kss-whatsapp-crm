import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

const templateFindUnique = vi.fn();
const contactFindUnique = vi.fn();
const notificationCreate = vi.fn();

vi.mock("../lib/prisma", () => ({
  prisma: {
    whatsAppTemplate: { findUnique: (...args: unknown[]) => templateFindUnique(...args) },
    contact: { findUnique: (...args: unknown[]) => contactFindUnique(...args) },
    notification: { create: (...args: unknown[]) => notificationCreate(...args) },
  },
}));

vi.mock("../services/whatsapp", () => ({
  getWhatsAppService: () => ({
    sendMessage: vi.fn(async () => ({ messageId: "wamid.test.1", status: "sent" as const })),
  }),
}));

vi.mock("../services/messageSimulator", () => ({
  scheduleMockDeliveryProgression: vi.fn(),
}));

import whatsappV1Routes from "../routes/v1/whatsapp.v1.routes";
import { errorHandler } from "../middleware/errorHandler";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/whatsapp", whatsappV1Routes);
  app.use(errorHandler);
  return app;
}

describe("POST /api/v1/whatsapp/send", () => {
  beforeEach(() => {
    templateFindUnique.mockReset();
    contactFindUnique.mockReset();
    notificationCreate.mockReset();
    notificationCreate.mockResolvedValue({ id: "notif_1", status: "SENT", messageId: "wamid.test.1" });
  });

  it("rejects sending with a template that is not approved", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", name: "delivery_scheduled", status: "PENDING", language: "en_US" });

    const res = await request(buildApp())
      .post("/api/v1/whatsapp/send")
      .send({ phone: "919876543210", template: "delivery_scheduled", variables: {} });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("TEMPLATE_NOT_APPROVED");
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown template name", async () => {
    templateFindUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/v1/whatsapp/send")
      .send({ phone: "919876543210", template: "does_not_exist", variables: {} });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TEMPLATE_NOT_FOUND");
  });

  it("rejects an invalid phone number", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", name: "quotation_ready", status: "APPROVED", language: "en_US" });

    const res = await request(buildApp())
      .post("/api/v1/whatsapp/send")
      .send({ phone: "1234567", template: "quotation_ready", variables: {} });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PHONE");
  });

  it("sends successfully with an approved template and valid phone", async () => {
    templateFindUnique.mockResolvedValue({ id: "tpl_1", name: "quotation_ready", status: "APPROVED", language: "en_US" });
    contactFindUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/v1/whatsapp/send")
      .send({ phone: "919876543210", template: "quotation_ready", variables: { "1": "Aarav" } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messageId).toBe("wamid.test.1");
    expect(res.body.status).toBe("SENT");
    expect(notificationCreate).toHaveBeenCalledTimes(1);
  });
});
