import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StandaloneExecutor } from "./runner/standalone-executor.js";
import { createProvider, listAvailableProviders, generateProviderConfigTemplate } from "./runner/providers.js";
import { runBenchmark } from "./runner/run-benchmark.js";

type CliOptions = {
  provider: string;
  taskLimit?: number;
  outputDir: string;
  variants?: string[];
  parallel?: boolean;
  maxConcurrency?: number;
  resume?: boolean;
  listProviders?: boolean;
  initConfig?: boolean;
};

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = basename(MODULE_DIR) === "dist" ? dirname(MODULE_DIR) : MODULE_DIR;

function parseArgs(args: string[]): CliOptions {
  const today = new Date().toISOString().slice(0, 10);
  let provider = "stub";
  let taskLimit: number | undefined;
  let outputDir = resolve(BENCHMARK_DIR, "results", today);
  let variants: string[] | undefined;
  let parallel = false;
  let maxConcurrency: number | undefined;
  let resume = false;
  let listProviders = false;
  let initConfig = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--provider") {
      provider = args[index + 1] ?? provider;
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const rawValue = args[index + 1];
      const parsedValue = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`Invalid --limit value: ${rawValue ?? "<missing>"}`);
      }
      taskLimit = parsedValue;
      index += 1;
      continue;
    }

    if (arg === "--output-dir") {
      outputDir = resolve(args[index + 1] ?? outputDir);
      index += 1;
      continue;
    }

    if (arg === "--variants") {
      const rawValue = args[index + 1];
      if (rawValue) {
        variants = rawValue.split(",").map((v) => v.trim());
      }
      index += 1;
      continue;
    }

    if (arg === "--parallel") {
      parallel = true;
      continue;
    }

    if (arg === "--max-concurrency") {
      const rawValue = args[index + 1];
      const parsedValue = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`Invalid --max-concurrency value: ${rawValue ?? "<missing>"}`);
      }
      maxConcurrency = parsedValue;
      index += 1;
      continue;
    }

    if (arg === "--resume") {
      resume = true;
      continue;
    }

    if (arg === "--list-providers") {
      listProviders = true;
      continue;
    }

    if (arg === "--init-config") {
      initConfig = true;
      continue;
    }
  }

  return { provider, taskLimit, outputDir, variants, parallel, maxConcurrency, resume, listProviders, initConfig };
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);

  // Handle --list-providers
  if (options.listProviders) {
    console.log("Available providers:");
    console.log("");
    const providers = listAvailableProviders();
    for (const name of providers) {
      const isDefault = ["stub", "deepseek", "openai", "minimax", "gemini"].includes(name);
      console.log(`  ${name}${isDefault ? " (built-in)" : " (custom)"}`);
    }
    console.log("");
    console.log("Usage: npm run benchmark -- --provider <name>");
    console.log("");
    console.log("Environment variables for built-in providers:");
    console.log("  DEEPSEEK_API_KEY  - for deepseek");
    console.log("  OPENAI_API_KEY    - for openai");
    console.log("  MINIMAX_API_KEY   - for minimax");
    console.log("  GEMINI_API_KEY    - for gemini");
    console.log("");
    console.log("Custom providers can be defined in:");
    console.log("  ~/.talking-cli/providers.json");
    console.log("  .talking-cli-providers.json (project-level)");
    return;
  }

  // Handle --init-config
  if (options.initConfig) {
    const configPath = resolve(process.cwd(), ".talking-cli-providers.json");
    writeFileSync(configPath, generateProviderConfigTemplate(), "utf-8");
    console.log(`✅ Created sample provider config: ${configPath}`);
    console.log("");
    console.log("Edit this file to add your custom providers, then run:");
    console.log("  npm run benchmark -- --provider <your-provider-name>");
    return;
  }

  const taskDir = resolve(BENCHMARK_DIR, "tasks");

  mkdirSync(options.outputDir, { recursive: true });

  const executor = new StandaloneExecutor(createProvider(options.provider));
  await runBenchmark(executor, taskDir, options.outputDir, {
    taskLimit: options.taskLimit,
    disableMcp: options.provider === "stub",
    provider: options.provider,
    variants: options.variants,
    parallel: options.parallel,
    maxConcurrency: options.maxConcurrency,
    resume: options.resume,
  });
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entryPath && fileURLToPath(import.meta.url) === entryPath) {
  main().then(
    () => { process.exit(0); },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    },
  );
}
