import { mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StandaloneExecutor } from "./runner/standalone-executor.js";
import { createProvider } from "./runner/providers.js";
import { runBenchmark } from "./runner/run-benchmark.js";

type CliOptions = {
  provider: string;
  taskLimit?: number;
  outputDir: string;
};

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = basename(MODULE_DIR) === "dist" ? dirname(MODULE_DIR) : MODULE_DIR;

function parseArgs(args: string[]): CliOptions {
  const today = new Date().toISOString().slice(0, 10);
  let provider = "stub";
  let taskLimit: number | undefined;
  let outputDir = resolve(BENCHMARK_DIR, "results", today);

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
    }
  }

  return { provider, taskLimit, outputDir };
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args);
  const taskDir = resolve(BENCHMARK_DIR, "tasks");

  mkdirSync(options.outputDir, { recursive: true });

  const executor = new StandaloneExecutor(createProvider(options.provider));
  await runBenchmark(executor, taskDir, options.outputDir, {
    taskLimit: options.taskLimit,
    disableMcp: options.provider === "stub",
    provider: options.provider,
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
