#!/usr/bin/env node
/**
 * Real-world benchmark CLI for MCP servers.
 *
 * Self-contained executor that runs MCP server tasks against
 * an LLM provider. Supports multiple targets (server-memory, server-everything).
 *
 * Usage:
 *   node benchmark/real-world/cli.mjs --provider glm-5.1
 *   node benchmark/real-world/cli.mjs --provider stub --limit 3 --variants mute
 *   node benchmark/real-world/cli.mjs --provider stub --target everything --limit 2
 *   node benchmark/real-world/cli.mjs --provider glm-5.1 --target all
 *   node benchmark/real-world/cli.mjs --provider glm-5.1 --parallel --max-concurrency 3
 *   node benchmark/real-world/cli.mjs --provider glm-5.1 --repeat 3
 *   node benchmark/real-world/cli.mjs --provider glm-5.1 --parallel --repeat 3 --max-concurrency 2
 *
 * Requires benchmark to be built first: npm run benchmark:build
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Checkers (CJS) ──────────────────────────────────────────────────────────
const memoryCheckers = require(resolve(__dirname, "checkers", "memory-checkers.cjs"));
const everythingCheckers = require(resolve(__dirname, "checkers", "everything-checkers.cjs"));
const atlasCheckers = require(resolve(__dirname, "checkers", "atlas-checkers.cjs"));
const filesystemCheckers = require(resolve(__dirname, "checkers", "filesystem-checkers.cjs"));
const fetchCheckers = require(resolve(__dirname, "checkers", "fetch-checkers.cjs"));

// ─── Target configurations ────────────────────────────────────────────────────
const TARGETS = {
  memory: {
    name: "server-memory",
    muteServer: resolve(
      __dirname,
      "servers/server-memory/mute/node_modules/@modelcontextprotocol/server-memory/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-memory/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/server-memory"),
    fullSkill: resolve(__dirname, "skills/memory-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/memory-lean-skill.md"),
    checkers: memoryCheckers,
    needsMemoryFile: true,
    clientName: "talking-cli-memory-bench",
  },
  everything: {
    name: "server-everything",
    muteServer: resolve(
      __dirname,
      "servers/server-everything/mute/node_modules/@modelcontextprotocol/server-everything/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-everything/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/server-everything"),
    fullSkill: resolve(__dirname, "skills/everything-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/everything-lean-skill.md"),
    checkers: everythingCheckers,
    needsMemoryFile: false,
    clientName: "talking-cli-everything-bench",
  },
  atlas: {
    name: "mcp-atlas-adapted",
    muteServer: resolve(
      __dirname,
      "servers/server-everything/mute/node_modules/@modelcontextprotocol/server-everything/dist/index.js",
    ),
    talkingServer: resolve(__dirname, "servers/server-everything/talking/index.mjs"),
    taskDir: resolve(__dirname, "tasks/mcp-atlas"),
    fullSkill: resolve(__dirname, "skills/everything-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/everything-lean-skill.md"),
    checkers: atlasCheckers,
    needsMemoryFile: false,
    clientName: "talking-cli-atlas-bench",
  },
  filesystem: {
    name: "server-filesystem",
    muteServer: resolve(
      __dirname,
      "servers/server-filesystem/mute/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
    ),
    talkingServer: null, // Will use proxy with getFilesystemHintConfig
    taskDir: resolve(__dirname, "tasks/server-filesystem"),
    fullSkill: resolve(__dirname, "skills/filesystem-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/filesystem-lean-skill.md"),
    checkers: filesystemCheckers,
    needsMemoryFile: false,
    needsSandbox: true,
    clientName: "talking-cli-filesystem-bench",
  },
  fetch: {
    name: "server-fetch",
    // Python MCP server — uses mcp-server-fetch CLI
    serverCommand: "mcp-server-fetch",
    serverArgs: [],
    muteServer: null, // Not a node script — use serverCommand/serverArgs instead
    talkingServer: null, // Will use proxy
    taskDir: resolve(__dirname, "tasks/server-fetch"),
    fullSkill: resolve(__dirname, "skills/fetch-full-skill.md"),
    leanSkill: resolve(__dirname, "skills/fetch-lean-skill.md"),
    checkers: fetchCheckers,
    needsMemoryFile: false,
    needsSandbox: false,
    clientName: "talking-cli-fetch-bench",
  },
};

// ─── Parse args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let provider = "stub";
let target = "memory";
let taskLimit;
let taskFilter;
let runVariants = ["full-skill+mute", "lean-skill+talking"];
let maxTurns = 20;
let verbose = false;
let parallel = false;
let maxConcurrency = 2;
let repeat = 1;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--provider" && argv[i + 1]) { provider = argv[++i]; }
  else if (argv[i] === "--target" && argv[i + 1]) { target = argv[++i]; }
  else if (argv[i] === "--limit" && argv[i + 1]) { taskLimit = parseInt(argv[++i], 10); }
  else if (argv[i] === "--tasks" && argv[i + 1]) { taskFilter = new Set(argv[++i].split(",").map(v => v.trim())); }
  else if (argv[i] === "--variants" && argv[i + 1]) {
    const raw = argv[++i].split(",").map(v => v.trim());
    // Backward compat: "mute" → "full-skill+mute", "talking" → "lean-skill+talking"
    runVariants = raw.map(v => {
      if (v === "mute") return "full-skill+mute";
      if (v === "talking") return "lean-skill+talking";
      return v;
    });
  }
  else if (argv[i] === "--max-turns" && argv[i + 1]) { maxTurns = parseInt(argv[++i], 10); }
  else if (argv[i] === "--verbose") { verbose = true; }
  else if (argv[i] === "--parallel") { parallel = true; }
  else if (argv[i] === "--max-concurrency" && argv[i + 1]) { maxConcurrency = parseInt(argv[++i], 10); }
  else if (argv[i] === "--repeat" && argv[i + 1]) { repeat = parseInt(argv[++i], 10); }
}

// Resolve target(s) to run
// Note: "atlas" is excluded from "all" because MCP-Atlas tasks require
// external APIs (Wikipedia, OSM, etc.) and cannot run against local MCP servers.
// Run explicitly with --target atlas to validate task/checker structure only.
const targetKeys = target === "all"
  ? Object.keys(TARGETS).filter(k => k !== "atlas")
  : [target];

if (!targetKeys.every(k => k in TARGETS)) {
  const invalid = targetKeys.filter(k => !(k in TARGETS));
  console.error(`Unknown target(s): ${invalid.join(", ")}. Available: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

if (targetKeys.includes("atlas")) {
  console.warn("⚠ MCP-Atlas tasks require external APIs (Wikipedia, OSM, Met Museum, etc.).");
  console.warn("  Running against server-everything will not produce valid results.");
  console.warn("  These tasks are external-validity artifacts, not runnable benchmark cells.");
}

// ─── Results output ───────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = resolve(__dirname, "results", `${today}-${provider}`);
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── MCP subprocess (simplified from standalone-executor) ─────────────────────
class McpSubprocess {
  constructor(command, args, env) {
    this.proc = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      windowsHide: true,
    });
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderrBuf = "";
    this.dead = false;
    this._initialized = false;

    this.proc.stderr?.on("data", (chunk) => {
      this.stderrBuf += chunk.toString("utf-8");
    });
    this.proc.on("exit", () => {
      this.dead = true;
      const err = new Error("Server exited");
      for (const [, entry] of this.pending) entry.reject(err);
      this.pending.clear();
    });
    this.proc.on("error", (err) => {
      this.dead = true;
      for (const [, entry] of this.pending) entry.reject(err);
      this.pending.clear();
    });
    this.proc.stdout?.on("data", (chunk) => this._onData(chunk));
    this.proc.stdout?.on("end", () => {
      if (!this.dead) {
        this.dead = true;
        const err = new Error("Server stdout closed");
        for (const [, entry] of this.pending) entry.reject(err);
        this.pending.clear();
      }
    });
  }

  async waitForReady(timeoutMs = 15000) {
    const READY_SIGNALS = ["running on stdio", "Starting default (STDIO) server"];
    const isReady = () => READY_SIGNALS.some(s => this.stderrBuf.includes(s));

    // Fast path: server already emitted a known ready signal
    if (isReady()) return;
    if (this.dead) throw new Error("Server died before ready");

    // Wait up to 3s for stderr ready signal
    const stderrReady = new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.proc?.stderr?.removeListener("data", onData);
        resolve(false);
      }, 3000);
      const onData = (chunk) => {
        this.stderrBuf += chunk.toString("utf-8");
        if (isReady()) {
          clearTimeout(timer);
          this.proc?.stderr?.removeListener("data", onData);
          resolve(true);
        }
      };
      this.proc?.stderr?.on("data", onData);
    });

    if (await stderrReady) return;

    // No stderr signal — try sending initialize as a readiness probe
    // (e.g., Python MCP servers like mcp-server-fetch don't emit stderr signals)
    if (this.dead) throw new Error("Server died before ready");
    try {
      await this._request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "readiness-probe", version: "1.0.0" },
      }, timeoutMs - 3500);
      // Server responded — it's ready. Mark this probe as the initialize call.
      this._notify("notifications/initialized");
      this._initialized = true;
    } catch (err) {
      throw new Error(`Server not ready in ${timeoutMs}ms: ${err.message}`);
    }
  }

  async initialize(timeoutMs = 10000, clientName = "talking-cli-bench") {
    // If waitForReady already sent initialize as probe, skip re-initialization
    if (this._initialized) return;
    const res = await this._request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    }, timeoutMs);
    if (res.error) throw new Error(`MCP init failed: ${res.error.message}`);
    this._notify("notifications/initialized");
  }

  async listTools(timeoutMs = 10000) {
    const res = await this._request("tools/list", {}, timeoutMs);
    if (res.error) throw new Error(`tools/list failed: ${res.error.message}`);
    return res.result.tools ?? [];
  }

  async callTool(name, args, timeoutMs = 30000) {
    const res = await this._request("tools/call", { name, arguments: args }, timeoutMs);
    if (res.error) {
      return { content: [{ type: "text", text: `Error: ${res.error.message}` }], isError: true };
    }
    const result = res.result;
    return {
      content: result?.content ?? [{ type: "text", text: "" }],
      isError: result?.isError ?? false,
    };
  }

  async close() {
    const proc = this.proc;
    this.proc = null;
    this.dead = true;
    // Reject any still-pending requests so their timers get cleared
    for (const [, entry] of this.pending) entry.reject(new Error("Server closed"));
    this.pending.clear();
    if (proc && !proc.killed) {
      // Remove all listeners to prevent event-loop accumulation across 100s of tasks
      proc.removeAllListeners();
      proc.stdout?.removeAllListeners();
      proc.stderr?.removeAllListeners();
      proc.stdin?.destroy();
      proc.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 2000);
        proc.once("exit", () => { clearTimeout(timer); resolve(); });
      });
    }
  }

  _request(method, params, timeoutMs = 10000) {
    if (this.dead) return Promise.reject(new Error(`Server dead, cannot ${method}`));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => { clearTimeout(timer); resolve(msg); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });
      this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  _notify(method) {
    this.proc?.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
  }

  _onData(chunk) {
    this.buffer += chunk.toString("utf-8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          entry?.resolve(msg);
        }
      } catch { /* ignore non-JSON */ }
    }
  }
}

// ─── LLM provider (imports from compiled benchmark) ──────────────────────────
async function createLLMProvider(providerName) {
  const BENCHMARK_DIST = resolve(__dirname, "..", "dist");
  const providerPath = resolve(BENCHMARK_DIST, "runner/providers.js");
  const providerUrl = pathToFileURL(providerPath).href;
  const { createProvider } = await import(providerUrl);
  return createProvider(providerName);
}

// ─── Proxy + hint configs (imports from compiled benchmark) ──────────────────
let ProxyMcpServerClass = null;
let getMemoryHintConfigFn = null;
let getFilesystemHintConfigFn = null;

async function loadProxyModules() {
  if (ProxyMcpServerClass) return; // Already loaded
  const BENCHMARK_DIST = resolve(__dirname, "..", "dist");
  const proxyUrl = pathToFileURL(resolve(BENCHMARK_DIST, "runner/proxy.js")).href;
  const configsUrl = pathToFileURL(resolve(BENCHMARK_DIST, "runner/hint-configs.js")).href;
  const { ProxyMcpServer } = await import(proxyUrl);
  const { getMemoryHintConfig, getFilesystemHintConfig } = await import(configsUrl);
  ProxyMcpServerClass = ProxyMcpServer;
  getMemoryHintConfigFn = getMemoryHintConfig;
  getFilesystemHintConfigFn = getFilesystemHintConfig;
}

/**
 * Get hint config for a target. Returns null if target has no config.
 */
function getHintConfigForTarget(targetKey) {
  if (!getMemoryHintConfigFn) return null;
  if (targetKey === "memory") return getMemoryHintConfigFn();
  if (targetKey === "filesystem") return getFilesystemHintConfigFn ? getFilesystemHintConfigFn() : null;
  return null;
}

// ─── Convert MCP tools to LLM tool format ─────────────────────────────────────
function mcpToolsToLlmFormat(mcpTools) {
  return mcpTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

// ─── Run a single task ────────────────────────────────────────────────────────
async function runTask(task, variant, llm, targetCfg) {
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turnCount = 0;
  let errorRecoveries = 0;

  // Parse variant: "full-skill+mute", "full-skill+talking", "lean-skill+mute", "lean-skill+talking"
  const [skillVariant, serverVariant] = variant.includes("+")
    ? variant.split("+")
    : [variant === "mute" ? "full-skill" : "lean-skill", variant];
  const fullSkill = readFileSync(targetCfg.fullSkill, "utf-8");
  const leanSkill = readFileSync(targetCfg.leanSkill, "utf-8");
  const skill = skillVariant === "full-skill" ? fullSkill : leanSkill;

  // Prepare env — memory targets need a temp file
  let memoryFile;
  let sandboxDir;
  const env = { ...process.env };
  if (targetCfg.needsMemoryFile) {
    memoryFile = resolve(
      tmpdir(),
      `talking-cli-mem-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`,
    );
    env.MEMORY_FILE_PATH = memoryFile;
  }
  // Filesystem targets need a temp sandbox directory passed as CLI arg
  if (targetCfg.needsSandbox) {
    sandboxDir = resolve(
      tmpdir(),
      `talking-cli-sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(sandboxDir, { recursive: true });
  }

  // Build server spawn command and args
  // Node-based servers: "node [script] [sandbox?]"
  // Python/other servers: serverCommand + serverArgs from target config
  const isNodeServer = !!targetCfg.muteServer;
  let spawnCmd, spawnArgs;
  if (isNodeServer) {
    spawnCmd = "node";
    spawnArgs = [targetCfg.muteServer];
    if (sandboxDir) {
      spawnArgs.push(sandboxDir);
    }
  } else {
    spawnCmd = targetCfg.serverCommand;
    spawnArgs = targetCfg.serverArgs || [];
  }

  // For hinting variant: use ProxyMcpServer wrapping mute server + hint config
  // For mute variant: use direct McpSubprocess (unchanged behavior)
  const useProxy = serverVariant !== "mute" && ProxyMcpServerClass && isNodeServer;
  let mcp;
  const targetKey = Object.keys(TARGETS).find(k => TARGETS[k] === targetCfg) || "memory";

  if (useProxy) {
    // Proxy mode: wrap the original mute server with hint injection
    const hintConfig = getHintConfigForTarget(targetKey);
    mcp = new ProxyMcpServerClass(
      spawnCmd,
      spawnArgs,
      env,
      { hintConfig, verbose },
    );
    await mcp.start();
  } else if (serverVariant !== "mute" && !ProxyMcpServerClass && targetCfg.talkingServer) {
    // Fallback: proxy modules not loaded (not built yet), use talking server directly
    const serverPath = targetCfg.talkingServer;
    mcp = new McpSubprocess("node", [serverPath], env);
  } else {
    // Mute variant: direct spawn
    mcp = new McpSubprocess(spawnCmd, spawnArgs, env);
  }

  let mcpTools = [];
  try {
    await mcp.waitForReady(15000);
    await mcp.initialize(10000, targetCfg.clientName);
    mcpTools = await mcp.listTools(10000);
  } catch (err) {
    console.error(`[MCP-ERROR] ${task.id} ${variant}:`, err.message);
    try { await mcp.close(); } catch { /* ignore */ }
    if (memoryFile) { try { unlinkSync(memoryFile); } catch { /* ignore */ } }
    if (sandboxDir && existsSync(sandboxDir)) { try { rmSync(sandboxDir, { recursive: true }); } catch { /* ignore */ } }
    return {
      taskId: task.id, variant, turns: 0, inputTokens: 0, outputTokens: 0,
      walltime: Date.now() - startTime, outcome: "error", pass: false,
      checkerReason: `MCP init failed: ${err.message}`,
    };
  }

  const llmTools = mcpToolsToLlmFormat(mcpTools);
  const messages = [
    { role: "user", content: skill + "\n\nUser request: " + task.prompt },
  ];

  try {
    let finalText = "";
    for (let turn = 0; turn < maxTurns; turn++) {
      turnCount = turn + 1;

      let response;
      try {
        response = await llm.call(messages, turn, llmTools);
      } catch (llmErr) {
        console.error(`[LLM-ERROR] ${task.id} ${variant} turn=${turnCount}:`, llmErr?.message || llmErr);
        return {
          taskId: task.id, variant, turns: turnCount,
          inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
          walltime: Date.now() - startTime, outcome: "error", pass: false,
          checkerReason: `LLM call failed: ${llmErr?.message || "unknown"}`,
        };
      }

      const inputToks = response.usage?.input_tokens ?? 0;
      const outputToks = response.usage?.output_tokens ?? 0;
      totalInputTokens += inputToks;
      totalOutputTokens += outputToks;

      const toolUses = response.content.filter(b => b.type === "tool_use");

      if (toolUses.length === 0) {
        finalText = response.content
          .filter(b => b.type === "text")
          .map(b => b.text)
          .join("\n");
        break;
      }

      // Add assistant response to conversation (include reasoning_content for DeepSeek thinking mode)
      const assistantMsg = { role: "assistant_content", content: response.content };
      if (response.reasoning_content) {
        assistantMsg.reasoning_content = response.reasoning_content;
      }
      messages.push(assistantMsg);

      // Execute tool calls
      for (const tool of toolUses) {
        try {
          const result = await mcp.callTool(tool.name, tool.input, 30000);
          const text = result.content
            .filter(c => c.type === "text")
            .map(c => c.text ?? "")
            .join("\n");
          messages.push({
            role: "tool", toolUseId: tool.id, name: tool.name,
            content: text, isError: result.isError,
          });
          if (result.isError) errorRecoveries++;
        } catch (err) {
          messages.push({
            role: "tool", toolUseId: tool.id, name: tool.name,
            content: err.message, isError: true,
          });
          errorRecoveries++;
        }
      }
    }

    // Evaluate using target checkers
    const checkerFn = targetCfg.checkers[task.checker];
    const checkerResult = checkerFn
      ? checkerFn(finalText, {})
      : { pass: false, reason: `Unknown checker: ${task.checker}` };

    return {
      taskId: task.id, variant, turns: turnCount,
      inputTokens: totalInputTokens, outputTokens: totalOutputTokens,
      walltime: Date.now() - startTime,
      outcome: turnCount >= maxTurns ? "timeout" : "completed",
      pass: checkerResult.pass,
      score: checkerResult.score ?? (checkerResult.pass ? 1 : 0),
      checkerReason: checkerResult.reason,
      errorRecoveries,
      target: targetCfg.name,
    };
  } finally {
    try { await mcp.close(); } catch { /* ignore close errors */ }
    if (memoryFile) { try { unlinkSync(memoryFile); } catch { /* ignore */ } }
    if (sandboxDir && existsSync(sandboxDir)) { try { rmSync(sandboxDir, { recursive: true }); } catch { /* ignore */ } }
  }
}

// ─── Watchdog: 5min progress heartbeat + 30min deep analysis ──────────────────
let watchdogHandle = null;
let lastDeepAnalysis = Date.now();

function startWatchdog(results, total, startTime) {
  const LIGHT_INTERVAL = 5 * 60 * 1000;   // 5 minutes
  const DEEP_INTERVAL = 30 * 60 * 1000;   // 30 minutes

  watchdogHandle = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const elapsedMin = (elapsed / 60000).toFixed(1);
    const count = results.length;
    const pct = ((count / total) * 100).toFixed(1);
    const passed = results.filter(r => r.pass).length;
    const passRate = count > 0 ? ((passed / count) * 100).toFixed(0) : "N/A";

    // 5-min light poll — always runs
    console.log(`\n⏱️  Progress heartbeat: ${count}/${total} (${pct}%)`);
    console.log(`   Elapsed: ${elapsedMin}min | Pass rate: ${passRate}%`);
    console.log(`   Speed: ${(count / (elapsed / 60000)).toFixed(1)} tasks/min`);
    if (count > 0 && count < total) {
      const remaining = (total - count) / (count / (elapsed / 60000));
      console.log(`   ETA: ~${remaining.toFixed(0)}min`);
    }

    // Timeout-rate advisory — detect provider concurrency throttling
    if (count >= 5) {
      const recentWindow = results.slice(-Math.min(10, count));
      const recentTimeouts = recentWindow.filter(r => r.checkerReason?.includes("LLM call timed out")).length;
      const recentTimeoutRate = recentTimeouts / recentWindow.length;
      if (recentTimeoutRate >= 0.4) {
        console.log(`\n   ⚠ High timeout rate (${(recentTimeoutRate * 100).toFixed(0)}% of last ${recentWindow.length} runs).`);
        console.log(`     Provider may be throttling concurrent requests.`);
        console.log(`     Consider re-running with --max-concurrency 1 for this provider.`);
      }
    }

    // 30-min deep analysis
    if (Date.now() - lastDeepAnalysis >= DEEP_INTERVAL && results.length > 0) {
      lastDeepAnalysis = Date.now();
      console.log(`\n📊 Deep Analysis (30-min interval):`);
      for (const variant of runVariants) {
        const vr = results.filter(r => r.variant === variant);
        const vPassed = vr.filter(r => r.pass).length;
        const avgTokens = vr.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0) / (vr.length || 1);
        const avgTurns = vr.reduce((s, r) => s + r.turns, 0) / (vr.length || 1);
        console.log(`  ${variant}: ${vPassed}/${vr.length} pass, avg ${Math.round(avgTokens)} tok, ${avgTurns.toFixed(1)} turns`);
      }
      // Control vs treatment comparison
      if (runVariants.length >= 2) {
        const ctrl = results.filter(r => r.variant === runVariants[0]);
        const treat = results.filter(r => r.variant === runVariants[runVariants.length - 1]);
        const ctrlRate = ctrl.filter(r => r.pass).length / (ctrl.length || 1);
        const treatRate = treat.filter(r => r.pass).length / (treat.length || 1);
        const delta = ((treatRate - ctrlRate) * 100).toFixed(0);
        console.log(`  Control vs Treatment: ${delta >= 0 ? "+" : ""}${delta}pp`);
      }
    }
  }, LIGHT_INTERVAL);
}

function stopWatchdog() {
  if (watchdogHandle) {
    clearInterval(watchdogHandle);
    watchdogHandle = null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const targetLabel = targetKeys.length === 1
    ? TARGETS[targetKeys[0]].name
    : `${targetKeys.length} targets (${targetKeys.join(", ")})`;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║     TALKING CLI — REAL-WORLD BENCHMARK                      ║");
  console.log(`║     Target: ${targetLabel.padEnd(48)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Provider: ${provider}`);
  console.log(`Variants: ${runVariants.join(", ")} | Max turns: ${maxTurns}`);
  console.log(`Parallel: ${parallel ? `Yes (max ${maxConcurrency})` : "No"}`);
  if (repeat > 1) console.log(`Repeat: ${repeat} trials per (task, variant)`);
  if (taskLimit) console.log(`Task limit: ${taskLimit} per target`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log("");

  const llm = await createLLMProvider(provider);

  // Load proxy modules for hinting variant support
  try {
    await loadProxyModules();
    if (verbose) console.log("Proxy modules loaded (ProxyMcpServer + hint configs)");
  } catch (err) {
    // Proxy modules not available (benchmark not built?) — will fallback to talking/ reimplementation
    if (verbose) console.log(`Proxy modules not loaded: ${err.message}`);
  }

  const allResults = [];

  for (const tKey of targetKeys) {
    const tCfg = TARGETS[tKey];
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Target: ${tCfg.name}`);
    console.log(`${"─".repeat(60)}`);

    // Load tasks for this target
    let tasks = readdirSync(tCfg.taskDir)
      .filter(f => f.endsWith(".json"))
      .sort()
      .map(f => JSON.parse(readFileSync(resolve(tCfg.taskDir, f), "utf-8")));
    if (taskFilter) tasks = tasks.filter(t => taskFilter.has(t.id));
    const limitedTasks = taskLimit ? tasks.slice(0, taskLimit) : tasks;

    if (limitedTasks.length === 0) {
      console.error(`No tasks found in ${tCfg.taskDir}`);
      continue;
    }

    console.log(`Tasks: ${limitedTasks.length} | Total runs: ${limitedTasks.length * runVariants.length * repeat}`);
    console.log("");

    const results = [];
    let completed = 0;
    const total = limitedTasks.length * runVariants.length * repeat;
    const startTime = Date.now();
    lastDeepAnalysis = Date.now();

    startWatchdog(results, total, startTime);

    try {
      if (parallel) {
        // Build all (task, variant, trial) jobs
        const jobs = [];
        for (let trial = 0; trial < repeat; trial++) {
          for (const task of limitedTasks) {
            for (const variant of runVariants) {
              jobs.push({ task, variant, trial });
            }
          }
        }

        // Process in batches of maxConcurrency
        for (let i = 0; i < jobs.length; i += maxConcurrency) {
          const batch = jobs.slice(i, i + maxConcurrency);
          const batchResults = await Promise.all(
            batch.map(({ task, variant, trial }) => {
              completed++;
              const trialLabel = repeat > 1 ? ` [trial ${trial + 1}]` : "";
              console.log(`[${completed}/${total}] ${task.id} (${variant})${trialLabel}...`);
              return runTask(task, variant, llm, tCfg).then(result => {
                result.trial = trial;
                return result;
              });
            }),
          );
          results.push(...batchResults);
          // Print results for batch
          for (const result of batchResults) {
            const status = result.pass ? "✅ PASS" : "❌ FAIL";
            console.log(`  ${status}: ${result.checkerReason}`);
            if (verbose) {
              console.log(
                `    turns=${result.turns} tokens=${result.inputTokens + result.outputTokens}` +
                ` walltime=${result.walltime}ms`,
              );
            }
          }
        }
      } else {
        // Sequential execution (original behavior)
        for (let trial = 0; trial < repeat; trial++) {
          for (const task of limitedTasks) {
            for (const variant of runVariants) {
              completed++;
              const trialLabel = repeat > 1 ? ` [trial ${trial + 1}]` : "";
              console.log(`[${completed}/${total}] ${task.id} (${variant})${trialLabel}...`);

              const result = await runTask(task, variant, llm, tCfg);
              result.trial = trial;
              results.push(result);
              const status = result.pass ? "✅ PASS" : "❌ FAIL";
              console.log(`  ${status}: ${result.checkerReason}`);
              if (verbose) {
                console.log(
                  `    turns=${result.turns} tokens=${result.inputTokens + result.outputTokens}` +
                  ` walltime=${result.walltime}ms`,
                );
              }
            }
          }
        }
      }
    } finally {
      stopWatchdog();
    }

    // Save results for this target
    const targetResultsPath = resolve(OUTPUT_DIR, `results-${tKey}.jsonl`);
    writeFileSync(targetResultsPath, results.map(r => JSON.stringify(r)).join("\n") + "\n", "utf-8");

    // Print summary for this target
    console.log(`\n  ${tCfg.name} Results:`);
    for (const variant of runVariants) {
      const vr = results.filter(r => r.variant === variant);
      const passed = vr.filter(r => r.pass).length;
      const count = vr.length;
      const avgTokens = vr.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0) / (count || 1);
      const avgWalltime = vr.reduce((s, r) => s + r.walltime, 0) / (count || 1);

      console.log(`    ${variant}: ${passed}/${count} (${((passed / (count || 1)) * 100).toFixed(0)}%) — avg tokens: ${Math.round(avgTokens).toLocaleString()}, avg walltime: ${(avgWalltime / 1000).toFixed(1)}s`);
    }

    // Per-task comparison — show first and last cell (control vs treatment)
    const controlVariant = runVariants.includes("full-skill+mute") ? "full-skill+mute" : runVariants[0];
    const treatmentVariant = runVariants.includes("lean-skill+talking") ? "lean-skill+talking" : runVariants[runVariants.length - 1];
    if (controlVariant !== treatmentVariant) {
      console.log(`\n  Per-task comparison (${controlVariant} vs ${treatmentVariant}):`);
      console.log("  " + "-".repeat(72));
      console.log("  " + "Task".padEnd(40) + controlVariant.padEnd(16) + treatmentVariant);
      console.log("  " + "-".repeat(72));
      for (const task of limitedTasks) {
        if (repeat > 1) {
          // With repeats, show pass rate across trials (e.g. "2/3")
          const ctrlAll = results.filter(r => r.taskId === task.id && r.variant === controlVariant);
          const treatAll = results.filter(r => r.taskId === task.id && r.variant === treatmentVariant);
          const ctrlPass = ctrlAll.filter(r => r.pass).length;
          const treatPass = treatAll.filter(r => r.pass).length;
          const ctrlS = `${ctrlPass}/${ctrlAll.length}`;
          const treatS = `${treatPass}/${treatAll.length}`;
          console.log(`  ${task.id.padEnd(40)}${ctrlS.padEnd(16)}${treatS}`);
        } else {
          const ctrlR = results.find(r => r.taskId === task.id && r.variant === controlVariant);
          const treatR = results.find(r => r.taskId === task.id && r.variant === treatmentVariant);
          const ctrlS = ctrlR ? (ctrlR.pass ? "PASS" : "FAIL") : "-";
          const treatS = treatR ? (treatR.pass ? "PASS" : "FAIL") : "-";
          console.log(`  ${task.id.padEnd(40)}${ctrlS.padEnd(16)}${treatS}`);
        }
      }
    }

    console.log(`\n  Results saved to: ${targetResultsPath}`);
    allResults.push(...results);
  }

  // Overall summary if multiple targets
  if (targetKeys.length > 1) {
    console.log(`\n${"═".repeat(60)}`);
    console.log("OVERALL SUMMARY");
    console.log("═".repeat(60));
    for (const tKey of targetKeys) {
      const tCfg = TARGETS[tKey];
      const tResults = allResults.filter(r => r.target === tCfg.name);
      for (const variant of runVariants) {
        const vr = tResults.filter(r => r.variant === variant);
        const passed = vr.filter(r => r.pass).length;
        const count = vr.length;
        console.log(`  ${tCfg.name} (${variant}): ${passed}/${count} (${((passed / (count || 1)) * 100).toFixed(0)}%)`);
      }
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => { console.error("Fatal error:", err); process.exit(1); },
);
