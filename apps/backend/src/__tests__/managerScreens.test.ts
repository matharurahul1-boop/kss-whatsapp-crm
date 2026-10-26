import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
 user: { findUnique: vi.fn() }, metaConfig: { findFirst: vi.fn() },
 auditLog: { findMany: vi.fn(), count: vi.fn() }, apiKey: { findMany: vi.fn(), create: vi.fn() },
 triggerConfig: { count: vi.fn(), findMany: vi.fn(), createMany: vi.fn() }, stageTemplate: { findMany: vi.fn() },
}));
vi.mock("../lib/prisma", () => ({ prisma: db }));
vi.mock("../middleware/auth", () => ({ requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: "user1", role: "ADMIN" }; next(); } }));
vi.mock("../services/whatsapp", () => ({ getWhatsAppService: vi.fn() }));
import settings from "../routes/settings.routes";
import apiKeys from "../routes/apiKeys.routes";
import triggers from "../routes/triggers.routes";
import contacts from "../routes/contacts.routes";
import { errorHandler } from "../middleware/errorHandler";
import { requireManager } from "../middleware/requireManager";
const app = express(); app.use(express.json());
app.use("/settings", settings); app.use("/api-keys", apiKeys); app.use("/triggers", triggers); app.use("/contacts", contacts); app.use(errorHandler);
const paths = ["/settings/system-mode", "/settings/meta-config", "/settings/audit-logs", "/api-keys", "/triggers", "/contacts/stage-templates"];
beforeEach(() => {
 vi.clearAllMocks(); db.user.findUnique.mockResolvedValue({ role: "MANAGER" });
 db.metaConfig.findFirst.mockResolvedValue(null); db.auditLog.findMany.mockResolvedValue([]); db.auditLog.count.mockResolvedValue(0);
 db.apiKey.findMany.mockResolvedValue([]); db.triggerConfig.count.mockResolvedValue(15); db.triggerConfig.findMany.mockResolvedValue([]); db.stageTemplate.findMany.mockResolvedValue([]);
});
describe("Manager-only Settings, API Integration and Logs", () => {
 it.each(paths)("allows a current Manager to read %s despite an old Admin claim", async (path) => {
  expect((await request(app).get(path)).status).toBe(200);
 });
 it.each(paths)("denies Admin direct API access to %s", async (path) => {
  db.user.findUnique.mockResolvedValue({ role: "ADMIN" });
  const res = await request(app).get(path); expect(res.status).toBe(403); expect(res.body.error.code).toBe("MANAGER_ONLY");
 });
 it.each(paths)("denies Agent direct API access to %s", async (path) => {
  db.user.findUnique.mockResolvedValue({ role: "AGENT" });
  expect((await request(app).get(path)).status).toBe(403);
 });
 it.each(["ADMIN", "AGENT"])("blocks %s from creating or modifying settings and API keys", async (role) => {
  db.user.findUnique.mockResolvedValue({ role });
  expect((await request(app).post("/api-keys").send({ name: "blocked" })).status).toBe(403);
  expect((await request(app).put("/settings/meta-config").send({ appId: "blocked" })).status).toBe(403);
  expect((await request(app).put("/contacts/stage-templates/ENQUIRY").send({ templateName: "blocked" })).status).toBe(403);
  expect(db.apiKey.create).not.toHaveBeenCalled();
 });
 it("rejects a deleted account", async () => {
  db.user.findUnique.mockResolvedValue(null);
  expect((await request(app).get("/api-keys")).status).toBe(403);
 });
 it("requires authentication before checking a role", async () => {
  const unauthenticated = express();
  unauthenticated.get("/manager", requireManager, (_req, res) => res.json({ success: true }));
  unauthenticated.use(errorHandler);
  expect((await request(unauthenticated).get("/manager")).status).toBe(401);
 });
});
