import { describe, it, expect, vi } from "vitest";

describe("csrf", () => {
  it("should export csrfProtection middleware", async () => {
    const csrf = await import("./csrf");
    expect(csrf.csrfProtection).toBeDefined();
    expect(typeof csrf.csrfProtection).toBe("function");
  });

  it("should export generateCsrfToken", async () => {
    const csrf = await import("./csrf");
    expect(csrf.generateCsrfToken).toBeDefined();
    expect(typeof csrf.generateCsrfToken).toBe("function");
  });

  it("should generate unique tokens", async () => {
    const { generateCsrfToken } = await import("./csrf");
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    expect(token1).not.toBe(token2);
    expect(token1.length).toBeGreaterThan(20);
  });
});
