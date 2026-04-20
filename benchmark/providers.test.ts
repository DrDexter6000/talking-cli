import { afterEach, describe, expect, it } from "vitest";
import { createProvider } from "./runner/providers.js";

const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

describe("benchmark provider factory", () => {
  afterEach(() => {
    if (ORIGINAL_ANTHROPIC_API_KEY === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_API_KEY;
    }
  });

  it("throws a clear error when the Anthropic key is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createProvider("anthropic")).toThrow(/ANTHROPIC_API_KEY/i);
  });

  it("creates an Anthropic-backed provider when the key is present", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const provider = createProvider("anthropic");
    expect(provider).toHaveProperty("call");
    expect(typeof provider.call).toBe("function");
  });
});
