import express from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

const cfgFind = vi.fn();
const tplFind = vi.fn();
const userFindMany = vi.fn();
const send = vi.fn();
const record = vi.fn();

vi.mock("../lib/prisma", () => ({
  prisma: {
    triggerConfig: { findUnique: (...a: unknown[]) => cfgFind(...a), findMany: vi.fn(async () => []) },
    whatsAppTemplate: { findUnique: (...a: unknown[]) => tplFind(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
  },
}));
vi.mock("../services/whatsapp", () => ({ getWhatsAppService: () => ({ sendMessage: (...a: unknown[]) => send(...a) }) }));
vi.mock("../services/conversationService", () => ({ recordOutboundMessage: (...a: unknown[]) => record(...a) }));

import triggersV1 from "../routes/v1/triggers.v1.routes";
import { errorHandler } from "../middleware/errorHandler";

const app = express();
app.use(express.json());
app.use("/api/v1/triggers", triggersV1);
app.use(errorHandler);

const customerCfg = { enabled: true, templateName: "enquiry_created_customer", recipient: "CUSTOMER", language: "en_US", variables: null };
const adminCfg = { enabled: true, templateName: "enquiry_cancelled_or_on_hold_admin", recipient: "ADMIN", language: "en_US", variables: null };
const salesCfg = { enabled: true, templateName: "prebooked_sales_order_followup_sales", recipient: "SALESPERSON", language: "en_US", variables: null };

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({ messageId: "wamid.1", status: "sent" });
  userFindMany.mockResolvedValue([]);
});

describe("POST /api/v1/triggers/:slug", () => {
  it("enquiry-created goes only to the customer, never to admins or salespeople", async () => {
    cfgFind.mockResolvedValue(customerCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 7 });
    const vars = { "2": "Kitchen", "3": "A: 1", "4": "B: 2", "5": "-", "6": "-", "7": "-" };
    const res = await request(app).post("/api/v1/triggers/enquiry-created").send({ phone: "9876543210", name: "Rahul", variables: vars });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fired: true, recipient: "CUSTOMER", sentTo: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].phone).toBe("919876543210");
    expect(send.mock.calls[0][0].variables["1"]).toBe("Rahul");
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("tells the caller which template variables are missing instead of sending", async () => {
    cfgFind.mockResolvedValue({ ...customerCfg, templateName: "proforma_invoice_created_customer" });
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 3 });
    const res = await request(app).post("/api/v1/triggers/pi-created").send({ phone: "919876543210", name: "Rahul", variables: { "2": "PI-1" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_VARIABLES");
    expect(res.body.error.message).toContain("{{3}}");
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a WhatsApp rejection instead of claiming it was fired", async () => {
    cfgFind.mockResolvedValue(customerCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 2 });
    send.mockResolvedValue({ messageId: "", status: "failed", failReason: "Template name does not exist" });
    const res = await request(app).post("/api/v1/triggers/enquiry-created").send({ phone: "919876543210", name: "Rahul", variables: { "2": "Kitchen" } });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("SEND_FAILED");
    expect(res.body.error.message).toContain("Template name does not exist");
    expect(record).not.toHaveBeenCalled();
  });

  it("sends N/A for contact lines that nobody supplies (request or Team Contacts)", async () => {
    cfgFind.mockResolvedValue(customerCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 7 });
    const res = await request(app).post("/api/v1/triggers/enquiry-created?product=Kitchen&contact1=Amit:%209876500001")
      .send({ phone: "919876543210", name: "Rahul" });
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].variables).toEqual({ "1": "Rahul", "2": "Kitchen", "3": "Amit: 9876500001", "4": "N/A", "5": "N/A", "6": "N/A", "7": "N/A" });
  });

  it("fills contact lines from Settings > Team Contacts when the request sends none", async () => {
    cfgFind.mockResolvedValue(customerCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 7 });
    cfgFind.mockImplementation(async ({ where }: { where: { event: string } }) =>
      where.event === "ENQUIRY_CREATED" ? { ...customerCfg, variables: { "3": "Amit: 7010016537", "4": "Riya: 9876500002" } } : null);
    const res = await request(app).post("/api/v1/triggers/enquiry-created?product=Kitchen").send({ phone: "919876543210", name: "Rahul" });
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].variables).toMatchObject({ "3": "Amit: 7010016537", "4": "Riya: 9876500002", "5": "N/A", "6": "N/A", "7": "N/A" });
  });

  it("contacts=none sends N/A instead of the saved team contacts", async () => {
    cfgFind.mockResolvedValue(customerCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 7 });
    cfgFind.mockResolvedValue({ ...customerCfg, variables: { "3": "Amit: 7010016537" } });
    await request(app).post("/api/v1/triggers/enquiry-created?contacts=none&product=Kitchen").send({ phone: "919876543210", name: "Rahul" });
    expect(send.mock.calls[0][0].variables["3"]).toBe("N/A");
  });

  it("a contact sent in the request wins over the saved team contacts", async () => {
    cfgFind.mockResolvedValue({ ...customerCfg, templateName: "proforma_invoice_created_customer" });
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 3 });
    cfgFind.mockImplementation(async ({ where }: { where: { event: string } }) =>
      where.event === "ENQUIRY_CREATED" ? { ...customerCfg, variables: { "3": "Amit: 7010016537" } } : { ...customerCfg, templateName: "proforma_invoice_created_customer" });
    await request(app).post("/api/v1/triggers/pi-created").send({ phone: "919876543210", name: "Rahul", project: "PI-1", contact1: "Sam: 9000000000" });
    expect(send.mock.calls[0][0].variables["3"]).toBe("Sam: 9000000000");
  });

  const TEAM = { "3": "Prashant Saini: 9899851091", "4": "Arjun Chawla: 9899679669", "5": "Kunal Singh Saini: 8929855811", "6": "Vikas Kharb: 97188 99882", "7": "Vicky Sharma: 92893 66579" };
  const ALL = Object.values(TEAM).join(", ");
  const withTeam = (tplName: string) => cfgFind.mockImplementation(async ({ where }: { where: { event: string } }) =>
    where.event === "ENQUIRY_CREATED" ? { ...customerCfg, variables: TEAM } : { ...customerCfg, templateName: tplName });

  it("PI Created puts ALL saved contacts, joined, into {{3}}", async () => {
    withTeam("proforma_invoice_created_customer");
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 3 });
    const res = await request(app).post("/api/v1/triggers/pi-created").send({ phone: "919876543210", name: "Rahul", project: "PI-1" });
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0].variables).toEqual({ "1": "Rahul", "2": "PI-1", "3": ALL });
  });

  it("Ticket Opened and Order Dispatched put all contacts into {{4}}", async () => {
    withTeam("service_ticket_open_customer");
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 4 });
    await request(app).post("/api/v1/triggers/ticket-open").send({ phone: "919876543210", name: "Rahul", concern: "Door", ticket: "T-1" });
    expect(send.mock.calls[0][0].variables["4"]).toBe(ALL);
    send.mockClear();
    withTeam("order_status_dispatched_customer");
    await request(app).post("/api/v1/triggers/order-dispatched").send({ phone: "919876543210", name: "Rahul", order: "SO-1", dispatchDate: "12 Nov" });
    expect(send.mock.calls[0][0].variables).toEqual({ "1": "Rahul", "2": "SO-1", "3": "12 Nov", "4": ALL });
  });

  it("Enquiry Created with a 2-variable template sends only {{1}} and {{2}}", async () => {
    withTeam("enquiry_created_customer");
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 2 });
    await request(app).post("/api/v1/triggers/enquiry-created").send({ phone: "919876543210", name: "Rahul", product: "Kitchen" });
    expect(send.mock.calls[0][0].variables).toEqual({ "1": "Rahul", "2": "Kitchen" });
  });

  it("accepts every field as URL parameters", async () => {
    cfgFind.mockResolvedValue({ ...customerCfg, templateName: "sales_order_booked_customer" });
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 2 });
    const res = await request(app).post("/api/v1/triggers/sales-order?phone=9876543210&name=Rahul&v2=SO-9");
    expect(res.status).toBe(200);
    expect(send.mock.calls[0][0]).toMatchObject({ phone: "919876543210", variables: { "1": "Rahul", "2": "SO-9" } });
  });

  it("test mode sends an admin trigger only to the phone in the request, never to saved admins", async () => {
    cfgFind.mockResolvedValue(adminCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 5 });
    userFindMany.mockResolvedValue([{ phone: "919222222222" }]);
    const res = await request(app).post("/api/v1/triggers/enquiry-cancelled?test=true").send({
      phone: "9000000009", variables: { "1": "On Hold", "2": "E1", "3": "R", "4": "K", "5": "P" },
    });
    expect(res.body.data).toMatchObject({ fired: true, testMode: true, sentTo: 1 });
    expect(send.mock.calls.map((c) => c[0].phone)).toEqual(["919000000009"]);
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("test mode without a phone refuses instead of falling back to saved numbers", async () => {
    cfgFind.mockResolvedValue(adminCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 5 });
    const res = await request(app).post("/api/v1/triggers/enquiry-cancelled?test=true").send({ variables: {} });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TEST_MODE_NEEDS_PHONE");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends an admin trigger to the adminPhones passed in the request", async () => {
    cfgFind.mockResolvedValue(adminCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 5 });
    const res = await request(app).post("/api/v1/triggers/enquiry-cancelled").send({
      adminPhones: ["9000000001", "919000000002"],
      variables: { "1": "On Hold", "2": "ENQ-1", "3": "Rahul", "4": "Kitchen", "5": "Postponed" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ fired: true, recipient: "ADMIN", sentTo: 2 });
    expect(send.mock.calls.map((c) => c[0].phone)).toEqual(["919000000001", "919000000002"]);
  });

  it("sends a salesperson trigger to the numbers saved on the Users page when none are passed", async () => {
    cfgFind.mockResolvedValue(salesCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 5 });
    userFindMany.mockResolvedValue([{ phone: "919111111111" }]);
    const res = await request(app).post("/api/v1/triggers/prebooked-followup").send({
      variables: { "1": "SO-1", "2": "Kitchen", "3": "Rahul", "4": "Mon", "5": "Call" },
    });
    expect(res.body.data).toMatchObject({ fired: true, recipient: "SALESPERSON", sentTo: 1 });
    expect(send.mock.calls[0][0].phone).toBe("919111111111");
  });

  it("explains how to pass numbers when nobody has one saved", async () => {
    cfgFind.mockResolvedValue(salesCfg);
    tplFind.mockResolvedValue({ language: "en_US", variableCount: 5 });
    const res = await request(app).post("/api/v1/triggers/prebooked-followup").send({ variables: { "1": "a", "2": "b", "3": "c", "4": "d", "5": "e" } });
    expect(res.body.data.fired).toBe(false);
    expect(res.body.data.reason).toContain("sales manager");
    expect(send).not.toHaveBeenCalled();
  });
});
