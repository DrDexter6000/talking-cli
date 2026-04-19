import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectServerCommand } from './detect-server-command.js';

describe('detectServerCommand', () => {
  it('detects Node.js from package.json with main field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test', main: 'server.js' }));
    writeFileSync(join(dir, 'server.js'), '');
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('node');
      expect(cmd.args[0]).toContain('server.js');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('detects Node.js with default index.js', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }));
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('node');
      expect(cmd.args[0]).toContain('index.js');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('detects Python from pyproject.toml with [project.scripts]', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(
      join(dir, 'pyproject.toml'),
      '[project]\nname = "my-server"\n\n[project.scripts]\nmy-server = "my_server.server:main"\n',
    );
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('python');
      expect(cmd.args).toContain('-m');
      expect(cmd.args).toContain('my_server');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('detects Python with uv when uv.lock exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(
      join(dir, 'pyproject.toml'),
      '[project]\nname = "my-server"\n\n[project.scripts]\nmy-server = "my_server.server:main"\n',
    );
    writeFileSync(join(dir, 'uv.lock'), '');
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('uv');
      expect(cmd.args).toEqual(['run', 'python', '-m', 'my_server']);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('detects Python from pyproject.toml name fallback', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "my-server"\n');
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('python');
      expect(cmd.args).toContain('my_server');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('falls back to server.py for Python', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    writeFileSync(join(dir, 'server.py'), '');
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('python');
      expect(cmd.args[0]).toContain('server.py');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('falls back to main.py for Python', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    writeFileSync(join(dir, 'pyproject.toml'), '[project]\nname = "x"\n');
    writeFileSync(join(dir, 'main.py'), '');
    try {
      const cmd = detectServerCommand(dir);
      expect(cmd.command).toBe('python');
      expect(cmd.args[0]).toContain('main.py');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it('throws for unrecognized directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'talking-cli-detect-'));
    try {
      expect(() => detectServerCommand(dir)).toThrow('Cannot detect server type');
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
