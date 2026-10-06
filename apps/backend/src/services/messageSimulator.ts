import { nanoid } from "nanoid";
import { applyDeliveryEvent, DeliveryEventType } from "./notificationEvents";

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

// Simulates the asynchronous delivery status progression that would normally
// arrive via Meta webhook callbacks: sent -> delivered -> read, or a late failure.
export function scheduleMockDeliveryProgression(messageId: string): void {
  const sentDelay = randomDelay(500, 1500);
  setTimeout(() => {
    void applyDeliveryEvent({ eventKey: `mock-sent-${messageId}`, messageId, eventType: "sent" });

    const failsLate = Math.random() < 0.04;
    if (failsLate) {
      const failDelay = randomDelay(1000, 2500);
      setTimeout(() => {
        void applyDeliveryEvent({
          eventKey: `mock-failed-${messageId}`,
          messageId,
          eventType: "failed" as DeliveryEventType,
          failReason: "Recipient device unreachable after multiple delivery attempts.",
        });
      }, failDelay);
      return;
    }

    const deliveredDelay = randomDelay(800, 2000);
    setTimeout(() => {
      void applyDeliveryEvent({ eventKey: `mock-delivered-${messageId}`, messageId, eventType: "delivered" });

      const readsMessage = Math.random() < 0.7;
      if (!readsMessage) return;

      const readDelay = randomDelay(1500, 4000);
      setTimeout(() => {
        void applyDeliveryEvent({ eventKey: `mock-read-${messageId}-${nanoid(6)}`, messageId, eventType: "read" });
      }, readDelay);
    }, deliveredDelay);
  }, sentDelay);
}
