import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "../utils/phone";

describe("phone utils", () => {
  it("accepts a valid Indian E.164-ish phone number", () => {
    expect(isValidPhone("919876543210")).toBe(true);
  });

  it("normalizes phone numbers with symbols and spaces", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("919876543210");
  });

  it("rejects numbers that are too short", () => {
    expect(isValidPhone("12345")).toBe(false);
  });

  it("rejects numbers with letters", () => {
    expect(isValidPhone("91abc543210")).toBe(false);
  });

  it("strips leading zeros before validating", () => {
    expect(normalizePhone("0919876543210")).toBe("919876543210");
  });
});
