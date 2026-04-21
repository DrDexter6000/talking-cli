---
name: gh-issues
description: "Fetch GitHub issues, spawn sub-agents to implement fixes and open PRs, then monitor and address PR review comments. Usage: /gh-issues [owner/repo] [--label bug] [--limit 5] [--milestone v1.0] [--assignee @me] [--fork user/repo] [--watch] [--interval 5] [--reviews-only] [--cron] [--dry-run] [--model glm-5] [--notify-channel -1002381931352]"
user-invocable: true
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["curl", "git", "gh"] },
        "primaryEnv": "GH_TOKEN",
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gh",
              "bins": ["gh"],
              "label": "Install GitHub CLI (brew)",
            },
          ],
      },
  }
---

# gh-issues — Auto-fix GitHub Issues with Parallel Sub-agents

You are an orchestrator. Follow these 6 phases exactly. Do not skip phases.

**IMPORTANT**: This skill uses the Talking CLI pattern. When tools return errors or empty results, **pay close attention to the hints in the tool response**. The hints provide contextual guidance for recovery.

---

## Phase 1 — Parse Arguments

Parse the arguments string provided after /gh-issues.

Positional:

- owner/repo — optional. Detect from current git remote if omitted.

Flags (all optional):
| Flag | Default | Description |
|------|---------|-------------|
| --label | _(none)_ | Filter by label |
| --limit | 10 | Max issues to fetch |
| --milestone | _(none)_ | Filter by milestone |
| --assignee | _(none)_ | Filter by assignee |
| --fork | _(none)_ | Your fork for branches/PRs |
| --watch | false | Keep polling |
| --interval | 5 | Minutes between polls |
| --dry-run | false | Fetch only, no sub-agents |
| --yes | false | Auto-process all |
| --reviews-only | false | Skip issues, only handle reviews |
| --cron | false | Fire-and-forget mode |
| --model | _(none)_ | Model for sub-agents |
| --notify-channel | _(none)_ | Telegram channel for notifications |

**If `--reviews-only`**: Skip to Phase 6.
**If `--cron`**: Force `--yes`, exit after spawning.

---

## Phase 2 — Fetch Issues

**Token Resolution:**
Ensure GH_TOKEN is available. Check environment, then config files.

Build curl request to GitHub Issues API. Filter out pull requests.

**Error handling** (hints provided by tools):
- HTTP 401/403 → tool response will hint about checking apiKey
- Empty array → tool response will hint about adjusting filters
- Other errors → tool response will include error details

Parse JSON response. Extract: number, title, body, labels, html_url.

---

## Phase 3 — Present & Confirm

Display markdown table of fetched issues.

If `--dry-run`: Display and stop.
If `--yes`: Auto-process all.
Otherwise: Ask user to confirm ("all", comma-separated, or "cancel").

---

## Phase 4 — Pre-flight Checks

Run checks sequentially:

1. **Dirty working tree** → tool hint will suggest committing or stashing
2. **Record base branch** → `git rev-parse --abbrev-ref HEAD`
3. **Verify remote access** → tool hint will suggest checking network/config
4. **Verify GH_TOKEN** → tool hint will suggest checking apiKey location
5. **Check existing PRs** → tool hint will show existing PR URL
6. **Check in-progress branches** → tool hint will show branch status
7. **Check claims** → tool hint will show claim age/timeout

---

## Phase 5 — Spawn Sub-agents (Parallel)

**Cron mode**: Sequential cursor tracking, spawn one agent, exit.
**Normal mode**: Launch up to 8 concurrently.

**Sub-agent prompt**: (see references/sub-agent-prompt.md)

---

## Phase 6 — PR Review Handler

Monitor open PRs for review comments and spawn sub-agents to address them.

**When this runs:**
- After Results Collection
- When `--reviews-only` is set
- In watch mode every poll cycle

**Steps:**
1. Discover PRs to monitor
2. Fetch review comments (reviews, inline, issue comments, embedded)
3. Analyze actionability → tool hints will classify comments
4. Present actionable comments
5. Spawn review fix sub-agents
6. Collect results

---

## Watch Mode

After each batch:
1. Add to PROCESSED_ISSUES
2. Sleep for interval
3. Loop back to Phase 2

**Context hygiene**: Only retain processed sets, PR list, and config. Discard bodies/transcripts.

---

## Talking CLI Integration

This skill relies on the Talking CLI pattern for error handling and guidance:

### When `list_directory` returns empty
**Raw**: `{"entries": []}`
**Talking**: `{"entries": [], "hint": "Directory empty. For gh-issues, ensure you're in a git repo with GitHub remote."}`

### When `exec` returns error
**Raw**: `{"error": "git: not a repository"}`
**Talking**: `{"error": "git: not a repository", "hint": "Not in a git repo. Run `git init` or navigate to a repo directory."}`

### When `curl` returns 401
**Raw**: `{"status": 401, "body": "Bad credentials"}`
**Talking**: `{"status": 401, "body": "Bad credentials", "hint": "GH_TOKEN invalid. Check OpenClaw dashboard or ~/.openclaw/openclaw.json under skills.entries.gh-issues"}`

### When `search_files` finds no matches
**Raw**: `{"results": []}`
**Talking**: `{"results": [], "hint": "No fix/issue-* branches found. All issues may be processed or no issues match filters."}`

---

## Additional Resources

- **`references/sub-agent-prompt.md`** - Full sub-agent task prompt
- **`references/review-handler-prompt.md`** - Review fix sub-agent prompt
- **`references/error-handling-guide.md`** - Detailed error scenarios and recovery

