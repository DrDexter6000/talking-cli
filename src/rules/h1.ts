export const MAX_SKILL_LINES = 150;

export function stripFrontmatter(content: string): string {
  if (!content.startsWith('---')) {
    return content;
  }

  // Find the second --- delimiter, requiring it to be at the start of a line
  const firstNewline = content.indexOf('\n', 3);
  if (firstNewline === -1) {
    return content; // No closing delimiter
  }

  const secondDelimiter = content.indexOf('\n---', firstNewline);
  if (secondDelimiter === -1) {
    return content; // No closing delimiter
  }

  // Slice after the closing delimiter + its trailing newline
  let after = content.slice(secondDelimiter + 4); // +4 for '\n---'
  // Strip one leading newline if present so body doesn't start with an empty line
  if (after.startsWith('\r\n')) {
    after = after.slice(2);
  } else if (after.startsWith('\n')) {
    after = after.slice(1);
  }

  return after;
}

export function countSkillLines(content: string): number {
  const withoutFrontmatter = stripFrontmatter(content);
  if (withoutFrontmatter === '') {
    return 0;
  }
  const lines = withoutFrontmatter.split(/\r?\n/);
  return lines.length;
}

export function evaluateH1(content: string): {
  verdict: 'PASS' | 'FAIL';
  score: number;
  raw: { lineCount: number; maxLines: number };
} {
  const lineCount = countSkillLines(content);
  const passed = lineCount <= MAX_SKILL_LINES;
  return {
    verdict: passed ? 'PASS' : 'FAIL',
    score: passed ? 100 : 0,
    raw: { lineCount, maxLines: MAX_SKILL_LINES },
  };
}
