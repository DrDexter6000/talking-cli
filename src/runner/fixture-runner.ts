import { spawn } from 'node:child_process';
import type { Fixture } from '../types.js';

export type FixtureRunResult =
  | { status: 'passed'; fixture: Fixture }
  | { status: 'assertion-failed'; fixture: Fixture; reason: string }
  | { status: 'broken'; fixture: Fixture; reason: string };

export function runFixture(fixture: Fixture, cwd: string): Promise<FixtureRunResult> {
  return new Promise((resolve) => {
    const timeoutMs = fixture.timeout_ms ?? 5000;
    const child = spawn(fixture.command[0], fixture.command.slice(1), {
      cwd,
      env: { ...process.env, ...fixture.env },
      timeout: timeoutMs,
    });

    let stdout = '';
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    child.on('error', (err: Error) => {
      resolve({
        status: 'broken',
        fixture,
        reason: `Spawn error: ${err.message}`,
      });
    });

    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      if (signal === 'SIGTERM' && code === null) {
        resolve({
          status: 'broken',
          fixture,
          reason: `Fixture timed out after ${timeoutMs}ms`,
        });
        return;
      }

      if (code !== 0) {
        resolve({
          status: 'broken',
          fixture,
          reason: `Process exited with code ${code}`,
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        resolve({
          status: 'broken',
          fixture,
          reason: 'stdout is not valid JSON',
        });
        return;
      }

      const fieldName = fixture.assert.output_has_field;
      const field = (parsed as Record<string, unknown>)?.[fieldName];

      if (field === undefined || field === null) {
        resolve({
          status: 'assertion-failed',
          fixture,
          reason: `Field "${fieldName}" is null or undefined`,
        });
        return;
      }

      if (Array.isArray(field) && field.length === 0) {
        resolve({
          status: 'assertion-failed',
          fixture,
          reason: `Field "${fieldName}" is an empty array`,
        });
        return;
      }

      resolve({ status: 'passed', fixture });
    });
  });
}
