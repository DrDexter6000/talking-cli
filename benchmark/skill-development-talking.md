---
name: Skill Development (Talking CLI)
description: This skill should be used when the user wants to "create a skill", "add a skill to plugin", "write a new skill", "improve skill description", "organize skill content", or needs guidance on skill structure, progressive disclosure, or skill development best practices for Claude Code plugins.
version: 0.1.0
---

# Skill Development for Claude Code Plugins

This skill provides guidance for creating effective skills for Claude Code plugins.

## About Skills

Skills are modular, self-contained packages that extend Claude's capabilities by providing
specialized knowledge, workflows, and tools.

### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code
    ├── references/       - Documentation loaded as needed
    └── assets/           - Files used in output
```

## Skill Creation Process

Follow these steps in order:

1. **Understand use cases** - Identify concrete examples of skill usage
2. **Plan resources** - Determine scripts/references/examples needed
3. **Create structure** - `mkdir -p skills/skill-name/{references,examples,scripts}`
4. **Write SKILL.md**:
   - Frontmatter with third-person description and trigger phrases
   - Lean body (1,500-2,000 words) in imperative form
   - Reference supporting files
5. **Add resources** - Create references/, examples/, scripts/ as needed
6. **Validate** - Check description, writing style, organization
7. **Test** - Verify skill loads on expected triggers
8. **Iterate** - Improve based on usage

## Writing Style

- **Imperative form**: "To create X, do Y" (not "You should do X")
- **Third-person description**: "This skill should be used when..."
- **Objective language**: Focus on what to do, not who should do it

## Progressive Disclosure

**SKILL.md** (always loaded): Core concepts, essential procedures, quick reference
**references/** (loaded as needed): Detailed patterns, API docs, migration guides
**examples/** (loaded as needed): Working code examples
**scripts/** (executed without loading): Utility scripts

## Validation Checklist

- [ ] SKILL.md has valid YAML frontmatter with name and description
- [ ] Description uses third person with specific trigger phrases
- [ ] Body is lean (1,500-2,000 words) in imperative form
- [ ] Detailed content moved to references/
- [ ] Referenced files actually exist
- [ ] Examples are complete and working

## Common Mistakes

1. **Weak triggers**: "Provides guidance for working with hooks" → "This skill should be used when the user asks to 'create a hook', 'add a PreToolUse hook'..."
2. **Too much in SKILL.md**: Move detailed content to references/
3. **Second person**: "You should start by..." → "Start by..."
4. **Missing references**: Always reference supporting files so Claude knows they exist

## Quick Reference

### Minimal Skill
```
skill-name/
└── SKILL.md
```

### Standard Skill (Recommended)
```
skill-name/
├── SKILL.md
├── references/
│   └── detailed-guide.md
└── examples/
    └── working-example.sh
```

### Complete Skill
```
skill-name/
├── SKILL.md
├── references/
│   ├── patterns.md
│   └── advanced.md
├── examples/
│   ├── example1.sh
│   └── example2.json
└── scripts/
    └── validate.sh
```

## Additional Resources

- **`references/skill-creator-original.md`** - Full original skill-creator content
- Study plugin-dev's skills for best practices: hook-development, agent-development, plugin-settings

---

## Tool Hints (Talking CLI)

When using filesystem tools to create or validate skills, pay attention to the hints in tool responses. They provide contextual guidance for common issues.

### Example: When `list_directory` returns empty

**Raw response:**
```json
{"entries": []}
```

**Talking response:**
```json
{
  "entries": [],
  "hint": "Directory is empty. For a new skill, create the structure: mkdir -p skills/skill-name/{references,examples,scripts}"
}
```

### Example: When `write_file` is blocked

**Raw response:**
```json
{"error": "File already exists"}
```

**Talking response:**
```json
{
  "error": "File already exists",
  "hint": "Use edit_file with oldText/newText for targeted changes, or read the file first to understand its structure before editing."
}
```

### Example: When `search_files` returns no matches

**Raw response:**
```json
{"results": []}
```

**Talking response:**
```json
{
  "results": [],
  "hint": "No matches found. Try broader patterns (e.g., '*.md' instead of 'SKILL.md') or check if you're in the correct directory."
}
```

---

**Note**: This skill uses the Talking CLI pattern. Detailed error handling guidance has been moved from SKILL.md into tool responses, reducing the initial prompt size while maintaining contextual guidance when needed.
