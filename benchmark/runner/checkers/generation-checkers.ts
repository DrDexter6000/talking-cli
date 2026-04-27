import type { CheckerFn, CheckerResult } from "./types.js";

export const checkConfigDriftAudit: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAudit = text.includes("drift") || text.includes("diff") || text.includes("audit") || text.includes("comparison");
  if (!hasAudit) {
    return { pass: false, reason: "config drift audit: no audit results reported" };
  }
  return { pass: true, reason: "config drift audit: audit completed" };
};

export const checkDatabaseMigrationGen: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMigration = text.includes("migration") || text.includes("schema") || text.includes("SQL") || text.includes("CREATE TABLE");
  const hasFiles = Object.keys(fs).some(k => k.includes("migration") && k.endsWith(".sql"));
  if (!hasMigration && !hasFiles) {
    return { pass: false, reason: "database migration: no migration files or schema reported" };
  }
  return { pass: true, reason: "database migration: migration generated" };
};

export const checkDocGenerationApi: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDocs = text.includes("documentation") || text.includes("API") || text.includes("endpoint") || text.includes("README");
  const hasFiles = Object.keys(fs).some(k => k.includes("doc") || k.includes("README"));
  if (!hasDocs && !hasFiles) {
    return { pass: false, reason: "doc generation: no documentation generated" };
  }
  return { pass: true, reason: "doc generation: documentation generated" };
};

export const checkEnvConfigHydration: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasHydration = text.includes("environment") || text.includes("config") || text.includes("hydrated") || text.includes(".env");
  if (!hasHydration) {
    return { pass: false, reason: "env config hydration: no hydration results reported" };
  }
  return { pass: true, reason: "env config hydration: hydration completed" };
};

export const checkI18nExtractionGen: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasI18n = text.includes("i18n") || text.includes("translation") || text.includes("locale") || text.includes("extracted");
  const hasFiles = Object.keys(fs).some(k => k.includes("locale") || k.includes("translation"));
  if (!hasI18n && !hasFiles) {
    return { pass: false, reason: "i18n extraction: no translations extracted" };
  }
  return { pass: true, reason: "i18n extraction: translations extracted" };
};

export const checkLargeYamlPipeline: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasPipeline = text.includes("pipeline") || text.includes("YAML") || text.includes("CI/CD") || text.includes("workflow");
  const hasFiles = Object.keys(fs).some(k => k.endsWith(".yml") || k.endsWith(".yaml"));
  if (!hasPipeline && !hasFiles) {
    return { pass: false, reason: "large yaml pipeline: no pipeline files generated" };
  }
  return { pass: true, reason: "large yaml pipeline: pipeline generated" };
};

export const checkLogAnalysisNginx: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAnalysis = text.includes("log") || text.includes("nginx") || text.includes("analysis") || text.includes("report");
  if (!hasAnalysis) {
    return { pass: false, reason: "nginx log analysis: no analysis results reported" };
  }
  return { pass: true, reason: "nginx log analysis: analysis completed" };
};

export const checkMonorepoDependencyGraph: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasGraph = text.includes("dependency") || text.includes("graph") || text.includes("monorepo") || text.includes("packages");
  const hasFiles = Object.keys(fs).some(k => k.includes("dependency") || k.includes("graph"));
  if (!hasGraph && !hasFiles) {
    return { pass: false, reason: "monorepo dependency graph: no dependency analysis reported" };
  }
  return { pass: true, reason: "monorepo dependency graph: dependency analysis completed" };
};

export const checkMultifileRefactorEsm: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRefactor = text.includes("refactor") || text.includes("ESM") || text.includes("import") || text.includes("export");
  if (!hasRefactor) {
    return { pass: false, reason: "multifile refactor: no refactoring results reported" };
  }
  return { pass: true, reason: "multifile refactor: refactoring completed" };
};

export const checkPerformanceProfileParse: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasProfile = text.includes("performance") || text.includes("profile") || text.includes("benchmark") || text.includes("optimization");
  if (!hasProfile) {
    return { pass: false, reason: "performance profile: no profiling results reported" };
  }
  return { pass: true, reason: "performance profile: profiling completed" };
};

export const checkSecurityScanCodebase: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasScan = text.includes("security") || text.includes("vulnerability") || text.includes("scan") || text.includes("audit");
  if (!hasScan) {
    return { pass: false, reason: "security scan: no security scan results reported" };
  }
  return { pass: true, reason: "security scan: security scan completed" };
};

export const checkTestCoverageAnalysis: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasCoverage = text.includes("coverage") || text.includes("test") || text.includes("percentage") || text.includes("report");
  if (!hasCoverage) {
    return { pass: false, reason: "test coverage: no coverage analysis reported" };
  }
  return { pass: true, reason: "test coverage: coverage analysis completed" };
};

// New checkers for additional tasks
export const checkLargeScaleRefactor: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasRefactor = text.includes("refactor") || text.includes("migration") || text.includes("modernize");
  const hasTests = text.includes("test") || text.includes("coverage");
  if (!hasRefactor) {
    return { pass: false, reason: "large scale refactor: no refactoring results reported" };
  }
  return { pass: true, reason: "large scale refactor: refactoring completed" };
};

export const checkDataPipelineBuild: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasPipeline = text.includes("pipeline") || text.includes("ETL") || text.includes("data warehouse");
  if (!hasPipeline) {
    return { pass: false, reason: "data pipeline: no pipeline build reported" };
  }
  return { pass: true, reason: "data pipeline: pipeline build completed" };
};

export const checkApiIntegrationTest: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasTests = text.includes("test") || text.includes("API") || text.includes("endpoint");
  if (!hasTests) {
    return { pass: false, reason: "API integration test: no tests created" };
  }
  return { pass: true, reason: "API integration test: tests created" };
};

export const checkDependencyUpdate: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasUpdate = text.includes("update") || text.includes("dependency") || text.includes("audit");
  if (!hasUpdate) {
    return { pass: false, reason: "dependency update: no updates performed" };
  }
  return { pass: true, reason: "dependency update: updates completed" };
};

export const checkConfigMigration: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasMigration = text.includes("config") || text.includes("migration") || text.includes("environment");
  if (!hasMigration) {
    return { pass: false, reason: "config migration: no migration performed" };
  }
  return { pass: true, reason: "config migration: migration completed" };
};

export const checkCodeReviewAutomation: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasAutomation = text.includes("lint") || text.includes("review") || text.includes("CI/CD");
  if (!hasAutomation) {
    return { pass: false, reason: "code review automation: no automation setup" };
  }
  return { pass: true, reason: "code review automation: automation setup completed" };
};

export const checkDocumentationWebsite: CheckerFn = (finalTurn, fs): CheckerResult => {
  const text = typeof finalTurn === "string" ? finalTurn : JSON.stringify(finalTurn);
  const hasDocs = text.includes("documentation") || text.includes("guide") || text.includes("tutorial");
  if (!hasDocs) {
    return { pass: false, reason: "documentation website: no documentation created" };
  }
  return { pass: true, reason: "documentation website: documentation created" };
};
