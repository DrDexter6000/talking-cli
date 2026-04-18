import { describe, it, expect } from 'vitest';
import { countSkillLines, evaluateH1, MAX_SKILL_LINES } from './h1.js';

describe('countSkillLines', () => {
  it('counts lines with no frontmatter', () => {
    const content = 'line1\nline2\nline3';
    expect(countSkillLines(content)).toBe(3);
  });

  it('excludes frontmatter', () => {
    const frontmatter = '---\ntitle: test\n---\n';
    const body = Array.from({ length: 140 }, (_, i) => `line${i}`).join('\n');
    expect(countSkillLines(frontmatter + body)).toBe(140);
  });

  it('counts code blocks', () => {
    const lines = [
      '# Title',
      '```js',
      'const x = 1;',
      'const y = 2;',
      '```',
      'end',
    ];
    expect(countSkillLines(lines.join('\n'))).toBe(6);
  });

  it('counts empty lines', () => {
    const content = 'a\n\n\nb';
    expect(countSkillLines(content)).toBe(4);
  });

  it('handles CRLF line endings', () => {
    const content = 'line1\r\nline2\r\nline3';
    expect(countSkillLines(content)).toBe(3);
  });

  it('treats unclosed frontmatter as body', () => {
    const content = '---\ntitle: test\n' + Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n');
    expect(countSkillLines(content)).toBe(12);
  });

  it('treats body --- as body content', () => {
    const lines = ['# Title', '---', 'Some text', '---', 'End'];
    expect(countSkillLines(lines.join('\n'))).toBe(5);
  });

  it('counts whitespace-only lines', () => {
    const content = 'a\n   \n\t\nb';
    expect(countSkillLines(content)).toBe(4);
  });
});

describe('evaluateH1', () => {
  it('PASS at exactly MAX_SKILL_LINES', () => {
    const body = Array.from({ length: MAX_SKILL_LINES }, (_, i) => `line${i}`).join('\n');
    const result = evaluateH1(body);
    expect(result.verdict).toBe('PASS');
    expect(result.score).toBe(100);
    expect(result.raw.lineCount).toBe(MAX_SKILL_LINES);
  });

  it('FAIL when over MAX_SKILL_LINES', () => {
    const body = Array.from({ length: MAX_SKILL_LINES + 1 }, (_, i) => `line${i}`).join('\n');
    const result = evaluateH1(body);
    expect(result.verdict).toBe('FAIL');
    expect(result.score).toBe(0);
    expect(result.raw.lineCount).toBe(MAX_SKILL_LINES + 1);
  });

  it('includes maxLines in raw', () => {
    const result = evaluateH1('short');
    expect(result.raw.maxLines).toBe(MAX_SKILL_LINES);
  });
});
