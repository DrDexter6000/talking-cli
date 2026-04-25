import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BENCHMARK = resolve(__dirname);
const SERVERS = resolve(BENCHMARK, "servers");

describe("Server structure: shared core + mute/talking variants", () => {
  it("has shared package.json and both variant entry points", () => {
    const sharedPkg = resolve(SERVERS, "package.json");
    const muteEntry = resolve(SERVERS, "variants", "mute", "index.ts");
    const talkingEntry = resolve(SERVERS, "variants", "talking", "index.ts");

    expect(existsSync(sharedPkg)).toBe(true);
    expect(existsSync(muteEntry)).toBe(true);
    expect(existsSync(talkingEntry)).toBe(true);
  });

  it("has shared core modules imported by both variants", () => {
    const coreLib = resolve(SERVERS, "core", "lib.ts");
    const corePathUtils = resolve(SERVERS, "core", "path-utils.ts");
    const corePathValidation = resolve(SERVERS, "core", "path-validation.ts");

    expect(existsSync(coreLib)).toBe(true);
    expect(existsSync(corePathUtils)).toBe(true);
    expect(existsSync(corePathValidation)).toBe(true);
  });

  it("records the upstream pinned commit in servers README", () => {
    const readme = resolve(SERVERS, "README.md");
    const text = readFileSync(readme, "utf-8");

    expect(text).toMatch(/4503e2d/);
  });
});
