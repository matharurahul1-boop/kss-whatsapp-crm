import { describe, expect, it, beforeEach, vi } from "vitest";

interface FakeNotification {
  id: string;
  messageId: string;
  status: string;
  campaignId: string | null;
  contactId: string | null;
  failReason: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
}

const webhookEvents = new Map<string, unknown>();
let notification: FakeNotification;

vi.mock("../lib/prisma", () => {
  const tx = {
    webhookEvent: {
      create: vi.fn(async ({ data }: { data: { eventKey: string } }) => {
        webhookEvents.set(data.eventKey, data);
        return data;
      }),
    },
    notification: {
      update: vi.fn(async ({ data }: { data: Partial<FakeNotification> }) => {
        Object.assign(notification, data);
        return notification;
      }),
    },
    campaignRecipient: { findUnique: vi.fn(async () => null) },
    campaign: { update: vi.fn(async () => ({})) },
  };

  return {
    prisma: {
      webhookEvent: {
        findUnique: vi.fn(async ({ where }: { where: { eventKey: string } }) => webhookEvents.get(where.eventKey) ?? null),
      },
      notification: {
        findUnique: vi.fn(async () => notification),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn(tx)),
    },
  };
});

import { applyDeliveryEvent } from "../services/notificationEvents";

describe("webhook delivery event idempotency", () => {
  beforeEach(() => {
    webhookEvents.clear();
    notification = {
      id: "notif_1",
      messageId: "wamid.123",
      status: "SENT",
      campaignId: null,
      contactId: null,
      failReason: null,
      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,
      failedAt: null,
    };
  });

  it("applies a delivered event the first time it is received", async () => {
    const result = await applyDeliveryEvent({ eventKey: "evt-delivered-1", messageId: "wamid.123", eventType: "delivered" });
    expect(result.applied).toBe(true);
    expect(notification.status).toBe("DELIVERED");
    expect(notification.deliveredAt).not.toBeNull();
  });

  it("ignores a duplicate delivery of the same event key", async () => {
    await applyDeliveryEvent({ eventKey: "evt-delivered-1", messageId: "wamid.123", eventType: "delivered" });
    const before = { ...notification };

    const result = await applyDeliveryEvent({ eventKey: "evt-delivered-1", messageId: "wamid.123", eventType: "delivered" });

    expect(result.applied).toBe(false);
    expect(notification).toEqual(before);
  });

  it("does not downgrade a read notification back to delivered", async () => {
    await applyDeliveryEvent({ eventKey: "evt-delivered-1", messageId: "wamid.123", eventType: "delivered" });
    await applyDeliveryEvent({ eventKey: "evt-read-1", messageId: "wamid.123", eventType: "read" });
    expect(notification.status).toBe("READ");

    await applyDeliveryEvent({ eventKey: "evt-delivered-replay", messageId: "wamid.123", eventType: "delivered" });
    expect(notification.status).toBe("READ");
  });
});
