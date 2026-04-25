# Hard-Tier Rubric Scoring

**Threshold**: 0.6 (pass = score ≥ 0.6)
**Score range**: 0.0–1.0

Hard-tier tasks use rubric-based scoring instead of binary pass/fail. Each checker evaluates 3–5 independent dimensions, each with a weight summing to 1.0. The final score is the weighted sum of passed dimensions.

---

## Schema Trigger Tasks

### task-batch-json-transform

**Checker**: `checkBatchJsonTransform`
**Trigger**: `schema` — complex field mapping and type conversion

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `field_mapping` | 0.3 | Agent correctly identifies field transformations | Text mentions source → target field names (firstName/fName, lastName/lName) |
| `format_consistency` | 0.3 | Output uses consistent format across files | JSON output files exist, or mentions ISO 8601 / YYYY-MM-DD formatting |
| `error_handling` | 0.2 | Agent handles malformed/unexpected input | Mentions skip, invalid, validation, or error handling; skipped-records file exists |
| `completeness` | 0.2 | All input files are processed | Mentions summary, "all 20", processed, or multiple output files exist |

**Score scenarios**:
- Full success (1.0): All 4 dimensions pass — complete transformation with field mapping, formatting, error handling, and summary
- Bare minimum (0.6): field_mapping + format_consistency pass — core transformation done, no error handling or completeness
- Total failure (0.0): Agent produces no recognizable output

---

### task-batch-markdown-transform

**Checker**: `checkBatchMarkdownTransform`
**Trigger**: `schema` — format conversion to markdown

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `field_mapping` | 0.3 | Agent correctly identifies field transformations | Mentions heading/header/title AND markdown/md/format |
| `format_consistency` | 0.3 | Output uses consistent markdown formatting | MD output files exist, or mentions consistent/format/template |
| `error_handling` | 0.2 | Agent handles malformed/unexpected input | Mentions skip, invalid, malformed, error, or fallback |
| `completeness` | 0.2 | All input files are processed | Mentions summary, complete, "all file", processed, or multiple output files |

**Score scenarios**:
- Full success (1.0): All dimensions pass — consistent markdown output with error handling and full coverage
- Bare minimum (0.6): field_mapping + format_consistency — basic conversion without error handling
- Total failure (0.0): No recognizable markdown transformation output

---

## Empty Trigger Tasks

### task-codebase-dead-code

**Checker**: `checkCodebaseDeadCode`
**Trigger**: `empty` — empty/no-results condition from analysis

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `detection` | 0.3 | Agent identifies the empty/no-results condition | Mentions unused, dead code, unreachable, "no results", or empty |
| `diagnosis` | 0.3 | Agent explains WHY results are empty | Mentions analysis, report, found/clean, "no dead code", or reason |
| `recovery_action` | 0.2 | Agent proposes action for empty results | Mentions recommend, suggest, cleanup, remove, refactor, or next step |
| `completeness` | 0.2 | Agent covers all expected files/scenarios | Mentions summary, overview, total, file, module, or directory |

**Score scenarios**:
- Full success (1.0): Detection + diagnosis + recovery + completeness — thorough analysis even when no dead code exists
- Bare minimum (0.6): detection + diagnosis — agent identifies the condition and explains it
- Total failure (0.0): Agent produces no analysis output

---

### task-error-recovery-batch

**Checker**: `checkErrorRecoveryBatch`
**Trigger**: `empty` — batch of errors with no immediate recovery

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `detection` | 0.3 | Agent identifies the error/batch failure condition | Mentions error, failed, failure, batch, or issue |
| `diagnosis` | 0.3 | Agent explains WHY errors occurred | Mentions root cause, reason, because, "caused by", "due to", or explanation |
| `recovery_action` | 0.2 | Agent proposes or takes corrective action | Mentions recovered, fixed, retry, resolved, corrected, or workaround |
| `completeness` | 0.2 | Agent covers all expected scenarios | Mentions summary, "all file", complete, total, processed, or overview |

**Score scenarios**:
- Full success (1.0): Detection + diagnosis + recovery + completeness — full error triage with resolution
- Bare minimum (0.6): detection + diagnosis — agent recognizes errors and explains them
- Total failure (0.0): Agent shows no awareness of errors

---

## Permission Trigger Tasks

### task-log-correlation-incident

**Checker**: `checkLogCorrelationIncident`
**Trigger**: `permission` — permission-gated log access

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `root_cause` | 0.3 | Agent identifies the actual root cause | Mentions root cause, "caused by", originated, trigger, or "source of" |
| `evidence_chain` | 0.3 | Agent builds a chain of evidence across services/files | Mentions correlation/linked/chain AND timeline/sequence/log |
| `scope_control` | 0.2 | Agent doesn't over-investigate irrelevant paths | Mentions relevant, scope, focused, incident, or specific |
| `resolution` | 0.2 | Agent proposes or implements a fix | Mentions resolution, fix, resolved, recommend, solution, or mitigation |

**Score scenarios**:
- Full success (1.0): root_cause + evidence_chain + scope_control + resolution — complete incident post-mortem
- Bare minimum (0.6): root_cause + evidence_chain — agent traces the incident even without proposing a fix
- Total failure (0.0): Agent shows no incident analysis

---

### task-multi-service-debug

**Checker**: `checkMultiServiceDebug`
**Trigger**: `permission` — cross-service debugging with access restrictions

| Dimension | Weight | Description | Passes when |
|-----------|--------|-------------|-------------|
| `root_cause` | 0.3 | Agent identifies the actual root cause | Mentions root cause, "caused by", originated, "source of", or underlying |
| `evidence_chain` | 0.3 | Agent builds evidence across services/files | Mentions timeline, sequence, service, log+trace, correlation, or chain |
| `scope_control` | 0.2 | Agent doesn't over-investigate irrelevant paths | Mentions relevant, scope, focused, incident, or "specific service" |
| `resolution` | 0.2 | Agent proposes or implements a fix | Mentions fix, resolved, recommend, solution, mitigation, or patch |

**Score scenarios**:
- Full success (1.0): root_cause + evidence_chain + scope_control + resolution — complete cross-service diagnosis
- Bare minimum (0.6): root_cause + evidence_chain — agent identifies the root cause with evidence
- Total failure (0.0): Agent shows no cross-service debugging behavior

---

## Design Principles

1. **At least one dimension is easy**: detection/field_mapping should pass for any agent that even mentions the task topic (≥50% baseline)
2. **0.6 threshold is meaningful**: an agent doing "bare minimum" (2 heaviest dimensions) scores exactly 0.6
3. **Dimensions are independently testable**: each can be triggered/faked in isolation for unit tests
4. **Weights reflect hint-relevant behavior**: dimensions that Distributed Prompting should improve (detection, recovery) are weighted appropriately
