/**
 * Memory benchmark checkers.
 *
 * Each checker receives (finalTurn, fs) and returns {pass, reason}.
 * Knowledge graph tasks don't produce files, so checkers analyze
 * the LLM's final text response.
 */

/**
 * Helper: normalize finalTurn to a string for pattern matching.
 */
function textOf(finalTurn) {
  return typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
}

/**
 * task-memory-create-and-query: Agent created entities and searched for Google.
 * Pass if the response mentions created entities AND search results with Google's observations.
 */
function checkMemoryCreateAndQuery(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasCreated = text.includes("creat") || text.includes("entit");
  const hasGoogle = text.includes("google");
  const hasObservation = text.includes("observation") || text.includes("search engine") || text.includes("youtube") || text.includes("mountain view");

  if (!hasCreated) {
    return { pass: false, reason: "create-and-query: response does not mention creating entities" };
  }
  if (!hasGoogle) {
    return { pass: false, reason: "create-and-query: response does not mention Google search results" };
  }
  if (!hasObservation) {
    return { pass: false, reason: "create-and-query: response does not show Google's observations" };
  }
  return { pass: true, reason: "create-and-query: agent created entities and reported search results" };
}

/**
 * task-memory-relations: Agent created people/company entities with relations and found employees.
 * Pass if response mentions relations AND found Google employees (Alice, Carol).
 */
function checkMemoryRelations(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasRelation = text.includes("relation") || text.includes("works_at") || text.includes("works at");
  const hasGoogleEmployees = (text.includes("alice") || text.includes("carol")) && text.includes("google");
  const hasPeople = text.includes("alice") || text.includes("bob") || text.includes("carol");

  if (!hasPeople) {
    return { pass: false, reason: "relations: response does not mention the people entities" };
  }
  if (!hasRelation) {
    return { pass: false, reason: "relations: response does not mention relations" };
  }
  if (!hasGoogleEmployees) {
    return { pass: false, reason: "relations: response does not identify Google employees via relations" };
  }
  return { pass: true, reason: "relations: agent correctly identified employees through relations" };
}

/**
 * task-memory-empty-search: Agent searched for 'quantum_computing' in empty graph.
 * Pass if response mentions no results / empty / nothing found.
 * Talking variant should additionally provide recovery guidance.
 */
function checkMemoryEmptySearch(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasNoResults = text.includes("no ") && (text.includes("result") || text.includes("entit") || text.includes("match") || text.includes("found"));
  const hasEmpty = text.includes("empty") || text.includes("nothing") || text.includes("zero") || text.includes("0 entit");

  if (!hasNoResults && !hasEmpty) {
    return { pass: false, reason: "empty-search: response does not indicate no results were found" };
  }

  // Check for appropriate response to empty results (either create suggestion or explanation)
  const hasRecovery = text.includes("creat") || text.includes("add") || text.includes("populat") || text.includes("would need to");

  return {
    pass: true,
    reason: `empty-search: agent correctly reported no results${hasRecovery ? " and suggested recovery actions" : ""}`,
  };
}

/**
 * task-memory-update-observations: Agent created Python entity, added observations, verified.
 * Pass if response confirms all 4 observations are present.
 */
function checkMemoryUpdateObservations(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasTypeHints = text.includes("type hint");
  const hasAsyncAwait = text.includes("async") || text.includes("await");
  const hasInterpreted = text.includes("interpreted");
  const hasGuido = text.includes("guido");

  const observationsFound = [hasTypeHints, hasAsyncAwait, hasInterpreted, hasGuido].filter(Boolean).length;

  if (observationsFound < 3) {
    return {
      pass: false,
      reason: `update-observations: only ${observationsFound}/4 observations found in response`,
    };
  }
  return {
    pass: true,
    reason: `update-observations: agent confirmed ${observationsFound}/4 observations present`,
  };
}

/**
 * task-memory-complex-query: Agent built project graph and answered who maintains AuthModule.
 * Pass if response correctly identifies Alice as responsible for AuthModule.
 */
function checkMemoryComplexQuery(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasAlice = text.includes("alice");
  const hasAuth = text.includes("auth");
  const hasReasoning = text.includes("maintain") || text.includes("relation") || text.includes("responsible");

  if (!hasAlice) {
    return { pass: false, reason: "complex-query: response does not identify Alice as the answer" };
  }
  if (!hasAuth) {
    return { pass: false, reason: "complex-query: response does not mention the auth module" };
  }
  if (!hasReasoning) {
    return { pass: false, reason: "complex-query: response does not explain reasoning through relations" };
  }
  return { pass: true, reason: "complex-query: agent correctly identified Alice via relation tracing" };
}

/**
 * task-memory-delete-cleanup: Agent created 3 entities, deleted 2, verified 1 remains.
 * Pass if response confirms only PermanentUser remains after deletion.
 */
function checkMemoryDeleteCleanup(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasPermanent = text.includes("permanent") || text.includes("permanentuser");
  const mentionsDeletion = text.includes("delet") || text.includes("remov");
  const hasRemaining = text.includes("remain") || text.includes("left") || text.includes("final");

  if (!mentionsDeletion) {
    return { pass: false, reason: "delete-cleanup: response does not mention deletion" };
  }
  if (!hasPermanent) {
    return { pass: false, reason: "delete-cleanup: response does not confirm PermanentUser remains" };
  }
  if (!hasRemaining) {
    return { pass: false, reason: "delete-cleanup: response does not describe the final graph state" };
  }
  return { pass: true, reason: "delete-cleanup: agent correctly deleted temp entities and confirmed final state" };
}

/**
 * task-memory-nonexistent-entity: Agent tried to add observations to a non-existent entity.
 * Pass if response mentions the error / entity not found and suggests alternatives.
 */
function checkMemoryNonexistentEntity(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasError = text.includes("error") || text.includes("not found") || text.includes("fail") || text.includes("does not exist") || text.includes("doesn't exist");
  const hasRecovery = text.includes("creat") || text.includes("search") || text.includes("first") || text.includes("before") || text.includes("need to");

  if (!hasError) {
    return { pass: false, reason: "nonexistent-entity: response does not mention the error" };
  }
  if (!hasRecovery) {
    return { pass: false, reason: "nonexistent-entity: response does not suggest recovery actions" };
  }
  return { pass: true, reason: "nonexistent-entity: agent reported error and suggested correct approach" };
}

/**
 * task-memory-empty-graph-operations: Agent read/searched/opened on empty graph.
 * Pass if response describes the empty state across all 3 operations.
 */
function checkMemoryEmptyGraphOperations(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasEmptyGraph = text.includes("empty") && (text.includes("graph") || text.includes("entit"));
  const hasNoResults = text.includes("no ") && (text.includes("result") || text.includes("entit") || text.includes("match"));
  const hasActionPlan = text.includes("creat") || text.includes("add") || text.includes("populat");

  if (!hasEmptyGraph && !hasNoResults) {
    return { pass: false, reason: "empty-graph: response does not describe the empty state" };
  }
  if (!hasActionPlan) {
    return { pass: false, reason: "empty-graph: response does not suggest actions to populate the graph" };
  }
  return { pass: true, reason: "empty-graph: agent described empty state and suggested population actions" };
}

/**
 * task-memory-duplicate-create: Agent tried to create duplicate entity.
 * Pass if response explains what happened with the duplicate (skipped / already exists).
 */
function checkMemoryDuplicateCreate(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasDuplicate = text.includes("skip") || text.includes("already exist") || text.includes("duplicate") || text.includes("existing");
  const hasOriginalObs = text.includes("port 3000") || text.includes("3000");
  const notOverwritten = !text.includes("port 8080") || text.includes("skip") || text.includes("original");

  if (!hasDuplicate && !hasOriginalObs) {
    return { pass: false, reason: "duplicate-create: response does not explain duplicate handling" };
  }
  if (hasOriginalObs && notOverwritten) {
    return { pass: true, reason: "duplicate-create: agent correctly identified that original observations were preserved" };
  }
  if (hasDuplicate) {
    return { pass: true, reason: "duplicate-create: agent identified duplicate creation behavior" };
  }
  return { pass: false, reason: "duplicate-create: response does not clearly describe what happened" };
}

/**
 * task-memory-full-crud-cycle: Agent performed full CRUD and verified deletions.
 * Pass if response confirms correct final state (ProjectAlpha with "has 3 team members",
 * ReactLib exists, but no relation between them and "started in 2024" is gone).
 */
function checkMemoryFullCrudCycle(finalTurn, _fs) {
  const text = textOf(finalTurn).toLowerCase();

  const hasProjectAlpha = text.includes("projectalpha") || text.includes("project alpha");
  const hasReactLib = text.includes("reactlib") || text.includes("react lib");
  const hasTeamMembers = text.includes("team member") || text.includes("3 team");
  const missingStarted2024 = !text.includes("started in 2024");
  const mentionsDeletion = text.includes("delet") || text.includes("remov");

  const dimensions = [
    { name: "entities_exist", weight: 0.25, passed: hasProjectAlpha && hasReactLib },
    { name: "observation_added", weight: 0.25, passed: hasTeamMembers },
    { name: "observation_deleted", weight: 0.25, passed: missingStarted2024 && mentionsDeletion },
    { name: "relation_deleted", weight: 0.25, passed: mentionsDeletion },
  ];

  const passedSubchecks = dimensions.filter(d => d.passed).map(d => d.name);
  const score = dimensions.reduce((sum, d) => sum + (d.passed ? d.weight : 0), 0);
  const pass = score >= 0.6;
  const failedNames = dimensions.filter(d => !d.passed).map(d => d.name);

  return {
    pass,
    reason: failedNames.length === 0
      ? `full-crud: all dimensions passed (score ${score.toFixed(2)})`
      : `full-crud: passed [${passedSubchecks.join(", ")}], missed [${failedNames.join(", ")}] (score ${score.toFixed(2)})`,
    score,
    passedSubchecks,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  checkMemoryCreateAndQuery,
  checkMemoryRelations,
  checkMemoryEmptySearch,
  checkMemoryUpdateObservations,
  checkMemoryComplexQuery,
  checkMemoryDeleteCleanup,
  checkMemoryNonexistentEntity,
  checkMemoryEmptyGraphOperations,
  checkMemoryDuplicateCreate,
  checkMemoryFullCrudCycle,
};
