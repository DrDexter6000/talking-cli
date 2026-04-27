# Adversarial Case Study: Where Distributed Prompting Fails

Every methodology has a boundary. Distributed Prompting is no exception. This document is a candid audit of the failure modes that emerge when the Four Rules of Talk are violated, misapplied, or taken beyond their intended scope. The goal is not to undermine the methodology but to define its operating envelope honestly.

The five anti-patterns documented in PHILOSOPHY.md (The Stoic Tool, The Oracle SKILL.md, The Preacher CLI, The Hallucinating Handshake, The Ghost Ambiguity) are failure modes at the design level. The four cases below go deeper: they are concrete failure modes that can emerge even when a developer is trying to follow the rules correctly.

---

## Failure Mode 1: Over-Hinting — When the Voice Becomes a Lecture

**Rule violated**: Rule 3 — "The Voice whispers, it does not lecture."

### Description

The Preacher CLI anti-pattern is the obvious case. But there is a subtler variant: a tool that technically follows the hint format but emits so many hints, or hints so verbose, that they become a second `SKILL.md` living inside the response. This violates Heuristic 3 (cap at three hints) and Rule 3 (whisper, don't lecture), but it can slip past the linter if each individual hint is technically well-formed.

The damage is asymmetric: hints cost tokens on every turn, not just on the turns where they matter. A 500-token hint payload that earns its place once but wastes 50 tokens on 99 other calls has a per-call cost profile that rivals the `SKILL.md` bloat the methodology is trying to escape.

### Concrete Example

A search tool returns this response on every call, including successful ones:

```json
{
  "results": [...],
  "hints": [
    "This search covers all indexed documents in the repository.",
    "If results seem incomplete, verify your query terms are spelled correctly.",
    "Boolean operators (AND, OR, NOT) are supported for advanced queries.",
    "Date filters use ISO-8601 format (YYYY-MM-DD).",
    "Results are ranked by relevance score, not chronological order.",
    "The search index updates every 15 minutes; recent changes may not appear immediately.",
    "Consider broadening your query if you receive zero results.",
    "Special characters in query terms may need escaping."
  ]
}
```

Eight hints on every call. The first six apply to every invocation regardless of outcome. Only the last two are invocation-scoped. The agent pays for six hints of universal guidance on every single turn.

### Impact Analysis

The 2×2 ablation benchmark did not surface this failure mode because the benchmark tasks were simple single-step queries. Over-hinting would inflate tokens on task-relevant turns AND on the majority of turns where the hints are noise. The methodology's token savings claim depends on hints being sparse and specific. Over-hinting reverts to the prompt flood it was designed to prevent.

### Mitigation

Enforce the H3 budget strictly: `talking-cli audit` flags responses with more than three hints. Beyond the count check, audit for hint universality: if a hint would apply unchanged to every call of this tool, it belongs in `SKILL.md`, not in the Voice.

---

## Failure Mode 2: H4's Actionability Proxy Is Imprecise

**Heuristic under pressure**: H4 — "Hints must be actionable (specific, non-empty, ≥ 10 chars)."

### Description

H4 uses character length as a proxy for actionability. A hint with fewer than 10 characters fails H4 even if it is perfectly actionable. A hint with 57 characters of generic filler passes H4 even if it tells the agent nothing it could not infer from the data alone. The character-length check is a necessary simplification — a semantic classifier would be more accurate but requires an API call per hint, which is not acceptable for a local linter. The imprecision is a deliberate tradeoff, not a bug.

The failure case is clear: the most actionable hint in a recovery scenario is often the shortest.

### Concrete Example

A database tool hits a unique constraint violation. The tool returns:

```json
{
  "error": "UNIQUE_CONSTRAINT_VIOLATION",
  "hints": [
    "retry",
    "constraint_name",
    "conflicting_value"
  ]
}
```

H4 evaluation:
- `"retry"` — 5 chars. Fails H4. But the agent knows exactly what to do.
- `"constraint_name"` — 16 chars. Passes H4. But this is a field name, not guidance.
- `"conflicting_value"` — 18 chars. Passes H4. Again a field name, not guidance.

Compare with a tool that passes H4 cleanly:

```json
{
  "hints": [
    "The tool has completed processing your request successfully."
  ]
}
```

57 characters. Passes H4. Tells the agent nothing it could not infer from `error: null`.

### Impact Analysis

The H4 stub creates two systematic errors: it rejects short actionable hints (false negative) and it accepts long generic filler (false positive). In practice, the false negatives are more damaging because the most urgent recovery hints tend to be terse ("retry", "rollback", "escalate"). The false positives are mostly a waste of the agent's attention, not a source of wrong behavior.

### Mitigation

The roadmap (G9 / P4.3) plans to replace the character-length check with a lightweight semantic classifier. Until then, manual review is the mitigation. The linter flags H4 failures for human inspection; do not treat a passing H4 score as proof of quality.

---

## Failure Mode 3: The 3-Hint Cap Punishes Complex Recovery

**Rule under pressure**: Rule 3 + Heuristic 3 — three hints per response.

### Description

The three-hint cap is the methodology's enforcement mechanism for keeping the Voice surgical. But it is a blunt instrument. Some error scenarios are genuinely multi-dimensional: a database tool that hits a unique constraint violation needs to communicate (1) which constraint failed, (2) what value caused the conflict, (3) how to look up the conflicting record, (4) what the resolution options are. Four distinct, non-redundant hints. The cap forces a choice between completeness and compliance.

The cap also creates an incentive to game H3 by merging related hints into a single compound hint that technically counts as one but is harder for the agent to parse.

### Concrete Example

A database tool returns on a unique constraint violation:

```json
{
  "error": "UNIQUE_CONSTRAINT_VIOLATION",
  "constraint": "idx_user_email",
  "conflicting_value": "user@example.com",
  "hints": [
    "idx_user_email constraint violated by 'user@example.com' — email already registered",
    "Query users with email 'user@example.com' to find the existing record",
    "Resolve by using a different email address or updating the existing record"
  ]
}
```

Three hints, all substantive, all invocation-scoped. This is a legitimate use of the Voice on a complex error. But consider a more granular error that needs four distinct pieces of guidance:

```json
{
  "error": "FOREIGN_KEY_VIOLATION",
  "constraint": "fk_orders_customer_id",
  "referenced_table": "customers",
  "conflicting_value": 99999,
  "hints": [
    "fk_orders_customer_id constraint violated: customer_id 99999 does not exist in customers table",
    "The customers table currently has 1500 rows with ids 1 through 1500",
    "Verify the customer_id value or create the referenced customer record first",
    "If inserting multiple orders, check that all customer_ids reference existing customers"
  ]
}
```

Four hints, each adding distinct information. The 3-hint cap forces the tool author to either drop useful guidance or merge hints in ways that reduce parseability.

### Impact Analysis

The cap is most damaging during error recovery, which is precisely when the Voice is most valuable. A tool that is silent on complex errors (the Stoic Tool) fails H2. A tool that is informative on complex errors may fail H3. The developer is penalized either way. This creates pressure to either over-simplify the tool's error model or to hide complexity in the data payload where the linter cannot see it.

### Mitigation

The roadmap (G9 / P4.4) plans to replace field-count enforcement with semantic dedup: hints that are semantically unique pass, hints that are paraphrases of each other are compressed. This preserves the intent of the budget while accommodating genuinely multi-dimensional error responses. Until that upgrade ships, make the cap configurable per tool or use semantic dedup as a pre-audit step.

---

## Failure Mode 4: Cross-Tool Hint Contradiction

**Rule under pressure**: Rule 4 — "The Judgment is the agent's, not the CLI's."

### Description

Distributed Prompting gives every tool a voice. It does not give the agent a protocol for resolving conflicting voices. When two tools called in sequence return hints that contradict each other, the agent has no guidance on how to adjudicate. The methodology correctly assigns judgment to the agent, but it does not give the agent the tools to resolve distributed contradictions.

This is a structural gap, not an implementation bug. It emerges in multi-tool workflows where the optimal next step depends on reconciling signals from multiple tool responses.

### Concrete Example

An agent calls a search tool with a broad query:

```json
{
  "results": [...],
  "hints": [
    "Broad query returned many results; consider narrowing with additional filters"
  ]
}
```

The agent then calls a filter tool:

```json
{
  "results": [...],
  "hints": [
    "Current filters are very restrictive; consider broadening to capture more candidates"
  ]
}
```

Search says: narrow further. Filter says: broaden. The agent is stuck. No hint tells it how to resolve the contradiction, and no global rule exists for prioritizing one tool's guidance over another.

In a different scenario:

```json
// Tool A: read_file
{
  "content": "...",
  "hints": ["File is 8000 lines; consider paginating or searching for a specific section"]
}

// Tool B: grep
{
  "results": [...],
  "hints": ["Grep returned zero results; the pattern may not exist in this file"]
}
```

Tool A suggests the file is large. Tool B says the pattern is not in the file. The agent could reasonably conclude either (a) the pattern exists but is in a section not yet searched, or (b) the pattern does not exist and the file is simply large. The methodology provides no tiebreaker.

### Impact Analysis

Cross-tool contradiction does not cause wrong answers. It causes decision paralysis on the turns where the agent needs to choose between conflicting recovery paths. The agent falls back to its base reasoning capabilities, effectively ignoring the distributed guidance on the contested turns. This is not catastrophic but it means the methodology's quality gains are non-uniform: they are highest on single-tool single-turn tasks and lowest on multi-tool recovery sequences.

### Mitigation

Document the limitation explicitly. The methodology is designed for single-tool guidance. Multi-tool workflows require either a convention (e.g., most-recent-tool wins, or highest-severity-wins) or an explicit priority field on hints. The roadmap does not currently include a hint-priority protocol, but this would be the natural extension point.

---

## Conclusion

These four failure modes are not reasons to abandon Distributed Prompting. They are the boundaries of its operating envelope.

The methodology works best when:

- Hints are sparse (≤ 3 per response) and invocation-scoped
- Each hint earns its place on the specific turn it appears
- Error scenarios are simple enough to compress into 1-3 distinct recovery cues
- Tool calls are largely independent; multi-tool sequences do not require reconciling contradictory guidance

The methodology degrades gracefully in other conditions:

- Over-hinting is caught by H3 enforcement
- Short actionable hints failing H4 is a known imprecision with a planned fix
- Complex multi-hint error scenarios can be pre-processed with semantic dedup
- Cross-tool contradiction is a structural gap that requires a future protocol extension

The 2×2 ablation benchmark showed that Distributed Prompting delivers material token savings and quality improvements on the tasks it was designed for. The failure modes above define the tasks it was not designed for. Know the difference.
