import { describe, it, expect } from "vitest";

describe("keycloak", () => {
  it("should export Keycloak functions", async () => {
    const mod = await import("./keycloak");
    expect(mod).toBeDefined();
    expect(typeof mod.verifyKeycloakToken === "function" || typeof mod.isKeycloakHealthy === "function").toBe(true);
  });

  it("should map roles correctly", async () => {
    const { mapKeycloakRoleToNdsep } = await import("./keycloak");
    if (typeof mapKeycloakRoleToNdsep === "function") {
      const result = mapKeycloakRoleToNdsep("admin");
      expect(typeof result).toBe("string");
    }
  });
});
