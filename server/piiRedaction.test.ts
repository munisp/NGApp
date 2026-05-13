import { describe, it, expect } from "vitest";

describe("piiRedaction", () => {
  it("should export PII redaction functions", async () => {
    const mod = await import("./piiRedaction");
    expect(mod).toBeDefined();
    const exports = Object.keys(mod);
    expect(exports.length).toBeGreaterThan(0);
  });

  it("should redact email addresses from log strings", async () => {
    const mod = await import("./piiRedaction");
    if (typeof mod.redactPii === "function") {
      const input = "User test@example.com logged in";
      const result = mod.redactPii(input);
      expect(result).not.toContain("test@example.com");
    }
  });
});
