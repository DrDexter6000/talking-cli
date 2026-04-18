import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFixture, type FixtureRunResult } from './fixture-runner.js';
import type { Fixture } from '../types.js';

function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    tool: 'search',
    scenario: 'test',
    command: ['node', '-e', 'console.log(JSON.stringify({hints:["x"]}))'],
    assert: { output_has_field: 'hints' },
    ...overrides,
  };
}

function assertPassed(result: FixtureRunResult): void {
  expect(result.status).toBe('passed');
}

function assertAssertionFailed(result: FixtureRunResult, reasonContains: string): void {
  expect(result.status).toBe('assertion-failed');
  expect(result.reason).toContain(reasonContains);
}

function assertBroken(result: FixtureRunResult, reasonContains: string): void {
  expect(result.status).toBe('broken');
  expect(result.reason).toContain(reasonContains);
}

describe('runFixture', () => {
  const cwd = process.cwd();

  it('passes when hint field exists and is non-empty', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log(JSON.stringify({hints:["check date"]}))'],
    });
    const result = await runFixture(fixture, cwd);
    assertPassed(result);
  });

  it('fails assertion when field is missing', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log(JSON.stringify({data:[]}))'],
    });
    const result = await runFixture(fixture, cwd);
    assertAssertionFailed(result, 'null or undefined');
  });

  it('fails assertion when field is null', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log(JSON.stringify({hints:null}))'],
    });
    const result = await runFixture(fixture, cwd);
    assertAssertionFailed(result, 'null or undefined');
  });

  it('fails assertion when field is an empty array', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log(JSON.stringify({hints:[]}))'],
    });
    const result = await runFixture(fixture, cwd);
    assertAssertionFailed(result, 'empty array');
  });

  it('marks broken on timeout', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'setTimeout(()=>{},10000)'],
      timeout_ms: 100,
    });
    const result = await runFixture(fixture, cwd);
    assertBroken(result, 'timed out');
  });

  it('marks broken on non-zero exit', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'process.exit(1)'],
    });
    const result = await runFixture(fixture, cwd);
    assertBroken(result, 'exited with code');
  });

  it('marks broken on non-JSON stdout', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log("not json")'],
    });
    const result = await runFixture(fixture, cwd);
    assertBroken(result, 'not valid JSON');
  });

  it('passes with env override', async () => {
    const fixture = makeFixture({
      command: ['node', '-e', 'console.log(JSON.stringify({hints:[process.env.TCL_TEST_VAR]}))'],
      env: { TCL_TEST_VAR: 'from-fixture' },
    });
    const result = await runFixture(fixture, cwd);
    assertPassed(result);
  });

  it('marks broken on spawn error (nonexistent executable)', async () => {
    const fixture = makeFixture({
      command: ['this-executable-does-not-exist-12345'],
    });
    const result = await runFixture(fixture, cwd);
    assertBroken(result, 'Spawn error');
  });
});
