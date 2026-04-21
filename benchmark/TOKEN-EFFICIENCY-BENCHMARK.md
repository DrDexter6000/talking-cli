# Token Efficiency Benchmark Design

## 核心问题

**Talking CLI 声称的价值**：
> "将本来需要集中在 SKILL.md 中的 prompt，以分布式的、prompt-on-call 的形式放到 CLI tool response 里面"

**这意味着**：
1. SKILL.md 可以更小（只保留核心逻辑，不保留错误处理指导）
2. 错误处理指导在需要时才出现（通过 tool hints）
3. 总体 token 消耗应该更少

## 当前问题

我们的 benchmark 测量的是 **mute vs talking 的 tool response**，但没有测量 **SKILL.md 的体积差异**。

**正确的对照组应该是**：
- **Baseline**：完整的 SKILL.md（包含所有错误处理场景的指导）
- **Talking**：精简的 SKILL.md + tool hints

## Benchmark 设计

### Variant A: Bloated SKILL.md (Baseline)

```markdown
# Filesystem Skill

## Error Handling Guide

### When search returns no results
1. Try broader search patterns
2. Check if the directory exists
3. Verify file permissions
4. Use list_directory to see available files

### When read fails with EISDIR
1. The path is a directory, not a file
2. Use list_directory instead
3. If it's a symlink, follow it

### When permission denied
1. Check file permissions with get_file_info
2. Try running with elevated permissions
3. Check if file is owned by another user

### When file not found
1. Check for typos in the path
2. Search for similar filenames
3. Check if file was moved or deleted

### When encoding errors occur
1. Try UTF-8 encoding
2. Check file type (binary vs text)
3. Use read_media_file for binary files

### When edit fails (exact match not found)
1. Read the file first to see current content
2. Check whitespace/indentation
3. Use write_file for complete replacement

### When move fails (destination exists)
1. Backup the existing file
2. Use force overwrite if safe
3. Choose a different destination

### When write blocked (file exists)
1. Use edit_file instead of write_file
2. Read the file first
3. Make targeted changes

[... 200+ more lines ...]
```

### Variant B: Talking CLI (精简 SKILL.md + Hints)

```markdown
# Filesystem Skill (精简版)

## Core Instructions
- Use available filesystem tools
- Always verify operations succeeded
- When tools return errors or empty results, 
  **pay attention to the hints in the tool response**

## Available Tools
- read_file, write_file, edit_file
- list_directory, search_files
- move_file, create_directory
```

**Tool hints** (只在需要时触发):
```json
{
  "error": "No matches found",
  "hint": "Try broader patterns or check if directory exists"
}
```

## 测量指标

### 1. 初始 Prompt 体积
- Bloated SKILL.md 的 token 数
- 精简 SKILL.md 的 token 数
- 差异 = 节省的 token

### 2. 运行时 Token 消耗
- 每个任务的 input tokens（包含 tool responses）
- 每个任务的 output tokens
- 累计差异

### 3. 总成本效益
- (初始节省 + 运行时节省) / 总 token 消耗
- 如果运行时消耗增加，是否被初始节省抵消？

## 实施计划

### Phase 1: 创建对照 SKILL.md
1. 编写 bloated SKILL.md（200+ 行，包含所有错误处理）
2. 编写精简 SKILL.md（50 行，依赖 tool hints）
3. 测量两者的 token 数

### Phase 2: 修改 Executor
1. 让 executor 接受不同的 system prompt
2. 运行相同任务集，记录 token 消耗

### Phase 3: 分析
1. 比较初始 prompt 体积
2. 比较运行时 token 消耗
3. 计算总成本效益

## 预期结果

**理想情况**：
- 初始 prompt：精简版节省 60-80% token
- 运行时：talking 增加 10-20%（因为 hint 在 response 中）
- 总体：节省 40-60% token

**可接受情况**：
- 初始 prompt：精简版节省 40-60%
- 运行时：talking 增加 20-30%
- 总体：节省 20-40%

**需要改进的情况**：
- 初始 prompt：精简版节省 <30%
- 运行时：talking 增加 >50%
- 总体：没有节省或反而增加
