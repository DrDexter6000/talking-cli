import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ServerCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export function detectServerCommand(serverDir: string): ServerCommand {
  // --- Node.js ---
  const packageJsonPath = resolve(serverDir, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;
    const entry =
      typeof pkg.main === 'string'
        ? pkg.main
        : typeof pkg.module === 'string'
          ? pkg.module
          : 'index.js';
    return { command: 'node', args: [resolve(serverDir, entry)] };
  }

  // --- Python (pyproject.toml) ---
  const pyprojectPath = resolve(serverDir, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    const content = readFileSync(pyprojectPath, 'utf-8');
    const hasUv = existsSync(resolve(serverDir, 'uv.lock'));

    // 1. Try [project.scripts]
    const scriptsMatch = content.match(/\[project\.scripts\]\s*\n((?:.+\n)*)/);
    if (scriptsMatch) {
      const firstScript = scriptsMatch[1].match(/^(\w+)\s*=\s*["']?([^"'\n]+)["']?/m);
      if (firstScript) {
        const scriptValue = firstScript[2].trim();
        const moduleMatch = scriptValue.match(/^([^:]+)/);
        if (moduleMatch) {
          const moduleName = moduleMatch[1].trim();
          if (hasUv) {
            return { command: 'uv', args: ['run', 'python', '-m', moduleName] };
          }
          return { command: 'python', args: ['-m', moduleName] };
        }
      }
    }

    // 2. Fallback: look for server.py / main.py / app.py
    for (const file of ['server.py', 'main.py', 'app.py']) {
      const filePath = resolve(serverDir, file);
      if (existsSync(filePath)) {
        if (hasUv) {
          return { command: 'uv', args: ['run', 'python', file] };
        }
        return { command: 'python', args: [filePath] };
      }
    }

    // 3. Last resort: [project] name → python -m name
    const nameMatch = content.match(/^name\s*=\s*["']([^"']+)["']/m);
    if (nameMatch) {
      const moduleName = nameMatch[1].replace(/-/g, '_');
      if (hasUv) {
        return { command: 'uv', args: ['run', 'python', '-m', moduleName] };
      }
      return { command: 'python', args: ['-m', moduleName] };
    }
  }

  // --- Python (setup.py) ---
  const setupPyPath = resolve(serverDir, 'setup.py');
  if (existsSync(setupPyPath)) {
    for (const file of ['server.py', 'main.py', 'app.py']) {
      const filePath = resolve(serverDir, file);
      if (existsSync(filePath)) {
        return { command: 'python', args: [filePath] };
      }
    }
  }

  throw new Error(
    `Cannot detect server type in ${serverDir}. Expected package.json, pyproject.toml, or setup.py.`,
  );
}
