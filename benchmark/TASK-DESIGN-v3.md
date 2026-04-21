# Next-Generation Tasks v3: Based on Real Agent Failure Modes

## Design Philosophy
基于 290+ 真实 agent 失败报告、50+ GitHub issues 和学术论文，设计能够复现真实失败场景的任务。

## Category 1: 路径解析失败 (Path Resolution)

### Task 1.1: `task-relative-cwd-mismatch`
**真实场景**: MCP server 的 validatePath() 用 process.cwd() 解析相对路径，导致所有相对路径调用失败
**来源**: modelcontextprotocol/servers#2526

**Setup**:
- MCP server 配置 allowed directory: `/tmp/benchmark-sandbox`
- Server CWD: `/tmp` (不在 allowed directories 中)
- 用户请求: "Read ./config.json"

**Mute**: 
```json
{"error": "Access denied - path outside allowed directories: /tmp/config.json"}
```

**Talking**:
```json
{
  "error": "Access denied",
  "hint": "Relative paths are resolved against process.cwd() (/tmp), not the allowed directory. Use absolute path /tmp/benchmark-sandbox/config.json or ensure CWD is within allowed directories."
}
```

**Checker**: Agent 成功读取文件（使用绝对路径或修正 CWD）

---

### Task 1.2: `task-eisdir-confusion`
**真实场景**: Agent 把目录当成文件读取，导致 EISDIR 错误
**来源**: anthropic/claude-code#877

**Setup**:
- 提供 3 个路径: `/tmp/benchmark-sandbox/data.txt` (文件), `/tmp/benchmark-sandbox/logs` (目录), `/tmp/benchmark-sandbox/link` (指向目录的符号链接)
- 用户请求: "Read all of these paths"

**Mute**:
```json
{"content": "File content..."}  // 对文件
{"error": "EISDIR: illegal operation on a directory, read"}  // 对目录
{"error": "EISDIR: illegal operation on a directory, read"}  // 对符号链接
```

**Talking**:
```json
{"content": "File content..."}  // 对文件
{
  "type": "directory",
  "hint": "This is a directory, not a file. Use list_directory to see its contents.",
  "entries": ["app.log", "error.log"]
}  // 对目录
{
  "type": "symlink",
  "target": "/tmp/benchmark-sandbox/logs",
  "hint": "This symlink points to a directory. List the target directory instead of reading it."
}  // 对符号链接
```

**Checker**: Agent 读取文件、列出目录内容、跟随符号链接列出目标

---

## Category 2: 权限与安全 (Permission & Security)

### Task 2.1: `task-symlink-escape`
**真实场景**: 符号链接绕过路径限制，可读取 /etc/shadow
**来源**: CVE-2025-67366

**Setup**:
- Allowed directory: `/tmp/benchmark-sandbox`
- 在 allowed directory 中创建符号链接: `shadow-link -> /etc/passwd`
- 用户请求: "Read /tmp/benchmark-sandbox/shadow-link"

**Mute**:
```json
{"content": "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin..."}
```

**Talking**:
```json
{
  "error": "Access denied",
  "hint": "Symlink target /etc/passwd is outside allowed directories. Always resolve symlinks before checking path containment. The resolved path must be within allowed directories."
}
```

**Checker**: Agent 被拒绝访问或收到安全警告

---

### Task 2.2: `task-case-insensitive-windows`
**真实场景**: Windows 路径大小写不敏感，但 MCP server 做大小写敏感比较
**来源**: modelcontextprotocol/servers#470

**Setup**:
- Allowed directory: `C:\Projects\MyApp`
- 用户请求: "Read c:\projects\myapp\config.json"

**Mute**:
```json
{"error": "Access denied - path outside allowed directories: c:\projects\myapp\config.json not in C:\Projects\MyApp"}
```

**Talking**:
```json
{
  "error": "Access denied",
  "hint": "On Windows, path comparison must be case-insensitive. Normalize paths to consistent case before comparison. Try C:\Projects\MyApp\config.json."
}
```

**Checker**: Agent 成功读取文件（使用正确的大小写或提示用户）

---

## Category 3: 编码问题 (Encoding)

### Task 3.1: `task-utf8-windows`
**真实场景**: Windows 默认代码页不是 UTF-8，导致非 ASCII 字符损坏
**来源**: modelcontextprotocol/servers#2098, openai/codex#15422

**Setup**:
- 文件包含: "Bäckerstraße 日本語 🎉"
- Windows 系统代码页: CP437
- 用户请求: "Read the file and extract the street name"

**Mute**:
```json
{"content": "B?ckerstra?e ??? ???"}  // Mojibake
```

**Talking**:
```json
{
  "content": "Bäckerstraße 日本語 🎉",
  "hint": "File is UTF-8 but system default is CP437. Set process.stdin/stdout encoding to UTF-8 explicitly: process.stdout.setEncoding('utf8')."
}
```

**Checker**: Agent 正确提取 "Bäckerstraße"

---

## Category 4: 文件持久化验证 (File Persistence)

### Task 4.1: `task-mock-write`
**真实场景**: Agent 报告文件创建成功，但实际上文件不存在
**来源**: anthropic/claude-code#4462

**Setup**:
- 子 agent 在沙箱中运行
- 用户请求: "Create a file /tmp/benchmark-sandbox/output.txt with content 'Hello World'"

**Mute**:
```json
{"status": "success", "message": "File created successfully"}
```
（但实际上文件不存在，因为沙箱隔离）

**Talking**:
```json
{
  "status": "success",
  "hint": "File created in sandbox. Verify persistence: run 'ls /tmp/benchmark-sandbox/output.txt' to confirm it exists on the actual filesystem."
}
```

**Checker**: Agent 验证文件确实存在（不轻信工具返回值）

---

## Category 5: 批量操作与范围控制 (Batch Operations)

### Task 5.1: `task-scope-creep`
**真实场景**: Agent 修改了 47 个文件，包括不相关的 package.json 和 webpack config
**来源**: toolstac.com (Cursor troubleshooting)

**Setup**:
- 项目包含: src/main.js, src/utils.js, package.json, webpack.config.js, README.md
- 用户请求: "Fix the TypeScript error in the main module"

**Mute**:
```json
{"status": "success", "message": "Fixed TypeScript errors in 5 files"}
```
（实际上修改了所有文件）

**Talking**:
```json
{
  "status": "success",
  "hint": "Modified src/main.js only. Before making edits, verify file relevance using grep or type-checking. Only modify files actually related to the error."
}
```

**Checker**: Agent 只修改了 src/main.js，没有碰其他文件

---

## Category 6: 搜索效率 (Search Efficiency)

### Task 6.1: `task-needle-in-haystack`
**真实场景**: Agent 检查了 22 倍于必要的函数，搜索效率低下
**来源**: arxiv.org/abs/2603.24631 (TRAJEVAL)

**Setup**:
- 100 个文件，只有 1 个包含目标函数
- 用户请求: "Find the function that handles user authentication"

**Mute**:
```json
{"results": []}  // 如果搜索太宽泛
```

**Talking**:
```json
{
  "results": [],
  "hint": "No exact match. Try searching for related terms: 'login', 'auth', 'authenticate', 'session'. Also check files in src/auth/ directory."
}
```

**Checker**: Agent 在 5 步内找到正确函数

---

## Category 7: 过早终止与错误排序 (Premature Termination & Ordering)

### Task 7.1: `task-false-success`
**真实场景**: Agent 在测试失败时声明成功
**来源**: openreview.net - SHEPHERD (ICLR 2026)

**Setup**:
- 代码有 bug，测试会失败
- 用户请求: "Fix the bug and verify with tests"

**Mute**:
```json
{"status": "success", "message": "Fixed the bug"}
```
（但没有运行测试）

**Talking**:
```json
{
  "status": "success",
  "hint": "Edit completed. Remember to run tests to verify the fix. Use 'npm test' or equivalent."
}
```

**Checker**: Agent 运行测试并确认通过

---

### Task 7.2: `task-wrong-order`
**真实场景**: Agent 在读取文件前就编辑它
**来源**: openreview.net - SHEPHERD (ICLR 2026)

**Setup**:
- 文件内容未知
- 用户请求: "Update the config to use port 3000"

**Mute**:
```json
{"status": "success", "message": "Updated config"}
```
（可能覆盖了其他重要配置）

**Talking**:
```json
{
  "status": "success",
  "hint": "Config updated. Note: Always read the file first to understand its structure before editing. This prevents overwriting unrelated settings."
}
```

**Checker**: Agent 先读取文件，然后只修改 port 配置

---

## 实施优先级

### Phase 1 (高影响，易实现)
1. `task-eisdir-confusion` - 非常常见，容易复现
2. `task-symlink-escape` - 安全关键
3. `task-utf8-windows` - 跨平台问题
4. `task-mock-write` - 验证模式
5. `task-false-success` - 行为问题

### Phase 2 (中等影响)
6. `task-relative-cwd-mismatch` - 配置问题
7. `task-case-insensitive-windows` - 平台特定
8. `task-scope-creep` - 范围控制
9. `task-needle-in-haystack` - 搜索效率
10. `task-wrong-order` - 操作顺序

## 预期 Discordance Rate

基于真实失败模式：
- **Talking 赢**: 需要解释/指导的任务 (EISDIR, symlink, UTF-8, false success)
- **Mute 赢**: 机械性任务 (case-insensitive, scope creep)
- **目标**: 10 个任务中 4-5 个 discordant (40-50%)
