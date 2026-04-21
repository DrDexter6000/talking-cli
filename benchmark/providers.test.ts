import { describe, expect, it } from "vitest";
import { createProvider } from "./runner/providers.js";

describe("benchmark provider factory", () => {
  it("creates a stub provider by default", () => {
    const provider = createProvider("stub");
    expect(provider).toHaveProperty("call");
    expect(typeof provider.call).toBe("function");
  });

  it("creates a deepseek provider when configured", () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const provider = createProvider("deepseek");
    expect(provider).toHaveProperty("call");
    expect(typeof provider.call).toBe("function");
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("throws for unsupported providers", () => {
    expect(() => createProvider("unsupported")).toThrow(/Unsupported benchmark provider/);
  });
});
