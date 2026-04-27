import { describe, expect, it } from 'vitest';
import type { ScenarioResult } from '../runtime/types.js';
import { evaluateM4, M4_ACTIONABLE_PATTERNS } from './m4.js';

describe('evaluateM4', () => {
  it('returns NOT_APPLICABLE when no errors', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'search', args: {}, expectedType: 'empty', description: '' },
        result: { content: [{ type: 'text', text: 'OK' }], isError: false },
        responseText: 'OK',
      },
    ];
    const r = evaluateM4(results);
    expect(r.verdict).toBe('NOT_APPLICABLE');
    expect(r.score).toBe(100);
  });

  it('PASS when all errors are actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'read', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'File not found. Check that the path exists.' }],
          isError: true,
        },
        responseText: 'File not found. Check that the path exists.',
      },
    ];
    const r = evaluateM4(results);
    expect(r.verdict).toBe('PASS');
    expect(r.score).toBe(100);
  });

  it('FAIL when error is not actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'api', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Error' }], isError: true },
        responseText: 'Error',
      },
    ];
    const r = evaluateM4(results);
    expect(r.verdict).toBe('FAIL');
    expect(r.score).toBe(0);
  });

  it('detects stack traces as non-actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'api', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'Error at foo (/src/index.ts:10:5)' }],
          isError: true,
        },
        responseText: 'Error at foo (/src/index.ts:10:5)',
      },
    ];
    const r = evaluateM4(results);
    const raw = r.raw as { errors: Array<{ isStackTrace: boolean }> };
    expect(raw.errors[0].isStackTrace).toBe(true);
    expect(r.score).toBe(0);
  });

  it('detects HTTP dumps as non-actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'api', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'HTTP/1.1 404 Not Found' }], isError: true },
        responseText: 'HTTP/1.1 404 Not Found',
      },
    ];
    const r = evaluateM4(results);
    const raw = r.raw as { errors: Array<{ isHttpDump: boolean }> };
    expect(raw.errors[0].isHttpDump).toBe(true);
    expect(r.score).toBe(0);
  });

  it('PARTIAL when some errors actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'read', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Check that the file exists.' }], isError: true },
        responseText: 'Check that the file exists.',
      },
      {
        scenario: { toolName: 'write', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Error' }], isError: true },
        responseText: 'Error',
      },
    ];
    const r = evaluateM4(results);
    expect(r.verdict).toBe('PARTIAL');
    expect(r.score).toBe(50);
  });

  it('requires minimum length for actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'api', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Try again' }], isError: true },
        responseText: 'Try again',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('treats bare "Required" as SDK validation error, not actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Required' }], isError: true },
        responseText: 'Required',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('treats short "X is required" as SDK error, not actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'name is required' }], isError: true },
        responseText: 'name is required',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('still scores "X is required. Please provide..." as actionable', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'name is required. Please provide a valid name.' }],
          isError: true,
        },
        responseText: 'name is required. Please provide a valid name.',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(100);
  });
  it('excludes Pydantic "Input validation error" as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Input validation error' }], isError: true },
        responseText: 'Input validation error',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('excludes Pydantic "Input validation error: field required" as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: "Input validation error: field 'path' is required" }],
          isError: true,
        },
        responseText: "Input validation error: field 'path' is required",
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('excludes Zod "required property" as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'required property: path' }],
          isError: true,
        },
        responseText: 'required property: path',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('excludes "Field required" as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: { content: [{ type: 'text', text: 'Field required' }], isError: true },
        responseText: 'Field required',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('excludes "Expected X, received Y" as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'Expected string, received number' }],
          isError: true,
        },
        responseText: 'Expected string, received number',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('excludes "invalid_type" Zod error as SDK boilerplate', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [{ type: 'text', text: 'invalid_type: expected string, received number' }],
          isError: true,
        },
        responseText: 'invalid_type: expected string, received number',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(0);
  });

  it('still scores real guidance with "required" as actionable (SDK boundary)', () => {
    const results: ScenarioResult[] = [
      {
        scenario: { toolName: 'get', args: {}, expectedType: 'error', description: '' },
        result: {
          content: [
            {
              type: 'text',
              text: 'name is required. Please provide a valid name.',
            },
          ],
          isError: true,
        },
        responseText: 'name is required. Please provide a valid name.',
      },
    ];
    const r = evaluateM4(results);
    expect(r.score).toBe(100);
  });
});

describe('M4_ACTIONABLE_PATTERNS', () => {
  it('matches "check that"', () => {
    expect(M4_ACTIONABLE_PATTERNS.some((p) => p.test('Check that the path exists'))).toBe(true);
  });

  it('matches "expected format"', () => {
    expect(M4_ACTIONABLE_PATTERNS.some((p) => p.test('Expected format: YYYY-MM-DD'))).toBe(true);
  });

  it('does not match bare "Error"', () => {
    expect(M4_ACTIONABLE_PATTERNS.some((p) => p.test('Error'))).toBe(false);
  });
});
