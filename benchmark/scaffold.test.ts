import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BENCHMARK = resolve(__dirname);
const SERVERS = resolve(BENCHMARK, "servers");

describe("Phase 1 Task 1.1 · Directory scaffold + pinned server fork", () => {
  it("has mute and talking server package.json files", () => {
    const mutePkg = resolve(SERVERS, "mute", "package.json");
    const talkingPkg = resolve(SERVERS, "talking", "package.json");

    expect(existsSync(mutePkg)).toBe(true);
    expect(existsSync(talkingPkg)).toBe(true);
  });

  it("uses the upstream package name in both variants", () => {
    const mutePkg = JSON.parse(
      readFileSync(resolve(SERVERS, "mute", "package.json"), "utf-8")
    );
    const talkingPkg = JSON.parse(
      readFileSync(resolve(SERVERS, "talking", "package.json"), "utf-8")
    );

    expect(mutePkg.name).toBe("@modelcontextprotocol/server-filesystem");
    expect(talkingPkg.name).toBe("@modelcontextprotocol/server-filesystem");
  });

  it("records the upstream sha in each variant's README", () => {
    const muteReadme = resolve(SERVERS, "mute", "README.md");
    const talkingReadme = resolve(SERVERS, "talking", "README.md");

    const muteText = readFileSync(muteReadme, "utf-8");
    const talkingText = readFileSync(talkingReadme, "utf-8");

    expect(muteText).toMatch(/\*\*upstream\*\*: [0-9a-f]{7,40}/);
    expect(talkingText).toMatch(/\*\*upstream\*\*: [0-9a-f]{7,40}/);
  });
});
