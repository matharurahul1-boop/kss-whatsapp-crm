import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../lib/jwt";

describe("password hashing", () => {
  it("hashes a password and verifies the correct plaintext", async () => {
    const hash = await bcrypt.hash("Admin@123", 10);
    expect(await bcrypt.compare("Admin@123", hash)).toBe(true);
  });

  it("rejects an incorrect password against the stored hash", async () => {
    const hash = await bcrypt.hash("Admin@123", 10);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });

  it("never stores the plaintext password in the hash", async () => {
    const hash = await bcrypt.hash("Admin@123", 10);
    expect(hash).not.toContain("Admin@123");
  });
});

describe("jwt session tokens", () => {
  it("round-trips a signed token", () => {
    const token = signToken({ userId: "user_1", email: "admin@kssinteriors.com", role: "ADMIN" });
    const payload = verifyToken(token);
    expect(payload.userId).toBe("user_1");
    expect(payload.email).toBe("admin@kssinteriors.com");
    expect(payload.role).toBe("ADMIN");
  });

  it("throws for a tampered token", () => {
    const token = signToken({ userId: "user_1", email: "admin@kssinteriors.com", role: "ADMIN" });
    expect(() => verifyToken(`${token}tampered`)).toThrow();
  });
});
