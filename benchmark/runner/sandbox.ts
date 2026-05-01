/**
 * FilesystemSandbox — temp directory for filesystem task verification.
 *
 * Creates a temporary directory that can be used as the server-filesystem
 * root, and provides verification of actual filesystem state after task
 * execution. This eliminates the "hallucination pass" attack vector.
 *
 * Uses mkdtempSync(join(tmpdir(), 'talking-cli-fs-*')) with try/finally rmSync
 * cleanup, matching project convention.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface FileExpectation {
  /** Whether the file should exist */
  exists: boolean;
  /** If exists=true, substrings that the file content must contain */
  contains?: string[];
}

export type ExpectedState = Record<string, FileExpectation>;

export interface VerificationResult {
  /** Whether all expectations were met */
  pass: boolean;
  /** Human-readable reason for pass/fail */
  reason: string;
  /** Per-file details */
  details: Array<{ path: string; pass: boolean; reason: string }>;
}

// ─── FilesystemSandbox class ────────────────────────────────────────────────────

/**
 * Creates and manages a temporary filesystem sandbox for benchmark tasks.
 *
 * Usage:
 * ```typescript
 * const sandbox = new FilesystemSandbox();
 * try {
 *   // Pass sandbox.path to server-filesystem as --root
 *   // Run task...
 *   const result = sandbox.verify({ "report.txt": { exists: true, contains: ["revenue"] } });
 *   expect(result.pass).toBe(true);
 * } finally {
 *   sandbox.cleanup();
 * }
 * ```
 */
export class FilesystemSandbox {
  readonly path: string;
  private cleaned = false;

  constructor() {
    this.path = mkdtempSync(join(tmpdir(), "talking-cli-fs-"));
  }

  /**
   * Verify filesystem state against expected state.
   *
   * @param expectedState - Map of relative file paths to expectations
   * @returns Verification result with pass/fail and per-file details
   */
  verify(expectedState: ExpectedState): VerificationResult {
    const details: Array<{ path: string; pass: boolean; reason: string }> = [];
    const failures: string[] = [];

    for (const [relativePath, expectation] of Object.entries(expectedState)) {
      const fullPath = join(this.path, relativePath);
      const fileResult = this.verifyFile(fullPath, relativePath, expectation);
      details.push(fileResult);
      if (!fileResult.pass) {
        failures.push(fileResult.reason);
      }
    }

    return {
      pass: failures.length === 0,
      reason: failures.length === 0
        ? `All ${Object.keys(expectedState).length} file expectations met`
        : `${failures.length} failure(s): ${failures.join("; ")}`,
      details,
    };
  }

  /**
   * List all files in the sandbox (recursively).
   */
  listFiles(): string[] {
    const files: string[] = [];
    this.walkDir(this.path, files);
    return files;
  }

  /**
   * Read a file from the sandbox.
   */
  readFile(relativePath: string): string | null {
    const fullPath = join(this.path, relativePath);
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, "utf-8");
  }

  /**
   * Clean up the sandbox directory. Safe to call multiple times.
   */
  cleanup(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    try {
      rmSync(this.path, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors — temp dirs are cleaned by OS eventually
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private verifyFile(
    fullPath: string,
    relativePath: string,
    expectation: FileExpectation,
  ): { path: string; pass: boolean; reason: string } {
    const fileExists = existsSync(fullPath) && statSync(fullPath).isFile();

    if (expectation.exists && !fileExists) {
      return {
        path: relativePath,
        pass: false,
        reason: `${relativePath} does not exist`,
      };
    }

    if (!expectation.exists && fileExists) {
      return {
        path: relativePath,
        pass: false,
        reason: `${relativePath} exists but was expected not to`,
      };
    }

    if (!expectation.exists) {
      return {
        path: relativePath,
        pass: true,
        reason: `${relativePath} correctly absent`,
      };
    }

    // File exists — check content patterns
    if (expectation.contains && expectation.contains.length > 0) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        const missingPatterns = expectation.contains.filter(
          pattern => !content.includes(pattern),
        );
        if (missingPatterns.length > 0) {
          return {
            path: relativePath,
            pass: false,
            reason: `${relativePath} missing patterns: ${missingPatterns.map(p => `"${p}"`).join(", ")}`,
          };
        }
      } catch {
        return {
          path: relativePath,
          pass: false,
          reason: `${relativePath} could not be read for content verification`,
        };
      }
    }

    return {
      path: relativePath,
      pass: true,
      reason: `${relativePath} verified${expectation.contains ? ` (${expectation.contains.length} pattern(s) matched)` : ""}`,
    };
  }

  private walkDir(dir: string, files: string[]): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, files);
      } else if (entry.isFile()) {
        files.push(fullPath.slice(this.path.length + 1));
      }
    }
  }
}
