import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Response } from "express";
import { generateApiKey, hashApiKey } from "../utils/apiKey";

const findUnique = vi.fn();
const update = vi.fn();

vi.mock("../lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { requireApiKey, ApiKeyRequest } from "../middleware/apiKey";

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("API key generation", () => {
  it("produces a key whose hash matches hashApiKey", () => {
    const { fullKey, hash } = generateApiKey();
    expect(hashApiKey(fullKey)).toBe(hash);
  });

  it("generates unique keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.fullKey).not.toBe(b.fullKey);
  });
});

describe("requireApiKey middleware", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("rejects requests with no Authorization header", async () => {
    const req = { headers: {} } as ApiKeyRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an unknown API key", async () => {
    findUnique.mockResolvedValue(null);
    const req = { headers: { authorization: "Bearer kss_live_unknown" } } as ApiKeyRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a disabled API key", async () => {
    findUnique.mockResolvedValue({ id: "key_1", enabled: false, revokedAt: null });
    const req = { headers: { authorization: "Bearer kss_live_disabled" } } as ApiKeyRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a valid, enabled API key and records last-used time", async () => {
    findUnique.mockResolvedValue({ id: "key_1", enabled: true, revokedAt: null });
    update.mockResolvedValue({});
    const req = { headers: { authorization: "Bearer kss_live_valid" } } as ApiKeyRequest;
    const res = mockRes();
    const next = vi.fn();

    await requireApiKey(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.apiKeyId).toBe("key_1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "key_1" } }));
  });
});
