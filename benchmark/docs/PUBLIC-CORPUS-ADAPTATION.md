# Public Corpus Adaptation: MCP-Atlas

**Date**: 2026-04-27
**Corpus**: [MCP-Atlas](https://github.com/scaleapi/mcp-atlas) by Scale AI
**License**: CC-BY-4.0
**Purpose**: Selection-bias defense for Talking CLI benchmark (Phase E, Task E.2)

---

## Source

- **MCP-Atlas** — A Large-Scale Benchmark for Tool-Use Competency with Real MCP Servers
- Repository: https://github.com/scaleapi/mcp-atlas
- Dataset: https://huggingface.co/datasets/ScaleAI/MCP-Atlas
- Paper: https://static.scale.com/uploads/674f4cc7a74e35bcaae1c29a/MCP_Atlas.pdf
- License: CC-BY-4.0 (dataset), MIT (code)

**The 10 tasks below were NOT designed by the Talking CLI authors.** They are adapted verbatim from the MCP-Atlas `sample_tasks.csv` (10 curated tasks in `services/mcp_eval/`).

## Why This Matters

Talking CLI's internal benchmark uses hand-crafted tasks designed to test specific Distributed Prompting scenarios. A valid criticism is selection bias — we designed tasks to flatter our methodology. This adaptation addresses that by:

1. Taking prompts **verbatim** from an independently designed corpus
2. Preserving GTFA (Ground Truth For Assessment) claims as validation targets
3. Using deterministic checkers (no LLM-as-judge) to avoid evaluation bias
4. Adapting **all 10** tasks from `sample_tasks.csv` — no cherry-picking

## Adaptation Method

### Source

We used the 10 tasks from `sample_tasks.csv` in the MCP-Atlas repository's `services/mcp_eval/` directory. These represent a curated subset of the full 500-task corpus.

### Process

1. **Extracted** task prompts verbatim from `sample_tasks.csv`
2. **Preserved** GTFA claims as checker validation targets
3. **Mapped** each task to a difficulty tier based on hop count and reasoning complexity
4. **Wrote deterministic checkers** that validate GTFA claims via pattern matching
5. **Added source attribution** to each task JSON with origin URL, task ID, and license

### What Changed from Source

| Aspect | Source (MCP-Atlas) | Adapted (Talking CLI) |
|--------|--------------------|-----------------------|
| Task prompt | Original | Verbatim (unchanged) |
| Expected answer | GTFA claims array | Deterministic checker functions |
| Server configuration | Full Docker + 36 servers | Not required (text-based checking) |
| Scoring | LLM-as-judge + GTFA | Pattern matching only |
| Metadata | Tool list, trajectory | Difficulty tier, hint trigger, source |

### What Did NOT Change

- **Prompts**: Copied verbatim from MCP-Atlas
- **Expected answers**: Derived directly from GTFA claims
- **No cherry-picking**: All 10 tasks adapted, not a favorable subset

## Adapted Tasks

| # | Task ID | Prompt Summary | Difficulty | GTFA Claims | Servers |
|---|---------|---------------|------------|-------------|---------|
| 1 | guggenheim-architect | Architect → birth city → library → subway (5-hop) | hard | 5 | Wikipedia, OSM |
| 2 | git-merge-detective | Find merge commit after README link fix | medium | 3 | git, desktop-commander |
| 3 | movie-genre-ranking | Rank genres by count in movie CSV | easy | 5 | filesystem, code-executor |
| 4 | beer-wednesday-saturday | Beer spending Wed vs Sat + gender breakdown | hard | 6 | filesystem, code-executor |
| 5 | equestrian-statues | Named equestrian statues within 10km of Eiffel Tower | medium | 4 | Wikipedia, OSM |
| 6 | barber-rating-age | Average haircut rating and client age | easy | 2 | cli-mcp, notion |
| 7 | doordash-fast-food | Restaurant category from article → count in CSV | medium | 3 | filesystem, fetch |
| 8 | met-museum-rooster | Find rooster+flowers artwork, explain medium | medium | 4 | met-museum, github |
| 9 | tomorrowland-charging | Walking distance from festival to nearest charger | easy | 2 | ddg-search, osm |
| 10 | barber-female-stats | Female client percentage and average age | easy | 2 | filesystem, code-executor |

### Difficulty Distribution

- **Easy**: 4 tasks
- **Medium**: 4 tasks
- **Hard**: 2 tasks

### Hint Trigger Categories

| Trigger | Count | Tasks |
|---------|-------|-------|
| data-analysis | 4 | movie-genre, barber-rating, beer-wed-sat, barber-female |
| multi-hop-reasoning | 4 | guggenheim, equestrian, met-museum, tomorrowland |
| cross-source-reasoning | 1 | doordash-fast-food |
| multi-step-navigation | 1 | git-merge-detective |

## Coverage Analysis vs. Internal Benchmark

| Category | Internal Tasks | MCP-Atlas Tasks | Overlap |
|----------|---------------|-----------------|---------|
| Basic CRUD / data read | 10 (memory) | 3 (barber, movie, doordash) | ✅ |
| Multi-hop reasoning | 3 (complex-query, relations, full-crud) | 4 (guggenheim, equestrian, met, tomorrowland) | ✅ |
| Error / empty recovery | 4 (empty-*, nonexistent, duplicate) | 0 | Internal only |
| Data analysis / aggregation | 0 | 4 (genre, beer, barber ×2) | Atlas only |
| Cross-source synthesis | 0 | 2 (doordash, git) | Atlas only |
| Multi-step orchestration | 2 (full-crud, delete-cleanup) | 2 (guggenheim, beer) | ✅ |

**Key finding**: MCP-Atlas adds **data analysis** and **cross-source synthesis** coverage absent from our internal benchmark. Our internal benchmark uniquely covers **error/empty recovery**. Together they provide complementary coverage.

## Verification

All checkers are deterministic text-pattern matchers. No LLM-as-judge. Each checker validates GTFA claims from the source:

- `checkAtlasGuggenheimArchitect`: Gehry + Toronto + library + Bloor-Yonge + coordinates
- `checkAtlasGitMergeDetective`: commit hash + April 2024 + merge message
- `checkAtlasMovieGenreRanking`: 5 genre-count pairs
- `checkAtlasBeerWednesdaySaturday`: 6 data points (avg prices, % changes, gender gap)
- `checkAtlasEquestrianStatues`: Eiffel Tower + La Renommée + Mercure
- `checkAtlasBarberRatingAge`: rating ~4.256 + age 32.5
- `checkAtlasDoordashFastFood`: fast food + 6-9% + 12 entries
- `checkAtlasMetMuseumRooster`: Qi Baishi + hanging scroll + ink explanation
- `checkAtlasTomorrowlandCharging`: De Schorre + ~1626m
- `checkAtlasBarberFemaleStats`: 48.39% + 31.33 years

## Files

```
benchmark/real-world/
├── checkers/atlas-checkers.cjs                    # 10 deterministic checker functions
└── tasks/mcp-atlas/                               # 10 task JSON files
    ├── task-atlas-guggenheim-architect.json
    ├── task-atlas-git-merge-detective.json
    ├── task-atlas-movie-genre-ranking.json
    ├── task-atlas-beer-wednesday-saturday.json
    ├── task-atlas-equestrian-statues.json
    ├── task-atlas-barber-rating-age.json
    ├── task-atlas-doordash-fast-food.json
    ├── task-atlas-met-museum-rooster.json
    ├── task-atlas-tomorrowland-charging.json
    └── task-atlas-barber-female-stats.json

benchmark/docs/
└── PUBLIC-CORPUS-ADAPTATION.md                    # This file
```

## Credit

- **MCP-Atlas** was created by Scale AI (https://scale.com)
- All task prompts and expected answers originate from the MCP-Atlas dataset
- Talking CLI authors performed the adaptation (schema mapping + checker writing)
- No prompt engineering or cherry-picking — all 10 `sample_tasks.csv` tasks adapted verbatim
- Provided under CC-BY-4.0, same as the original dataset

## Acceptance Criteria (per TDD-Phase-E)

- [x] 10 public-corpus tasks adapted
- [x] Custom checkers written (10 deterministic checkers)
- [x] Source attribution in every task JSON
- [x] Coverage analysis documented
- [x] No prompt engineering or cherry-picking (all 10 tasks adapted)
- [x] Results reported separately from main corpus (own directory + own checkers)
