#!/usr/bin/env node
/**
 * Talking variant of @modelcontextprotocol/server-memory.
 *
 * Self-contained wrapper with KnowledgeGraphManager inlined (not imported,
 * because the npm package auto-executes main() on import). Registers all 9
 * tools with contextual hints on error/empty results, implementing the
 * Distributed Prompting (Prompt-On-Call) pattern.
 *
 * Hints are added when:
 * - search_nodes returns empty → suggest broader terms or read_graph
 * - open_nodes returns empty → suggest search_nodes or read_graph
 * - read_graph returns empty → suggest create_entities
 * - add_observations targets non-existent entity → suggest search/create
 * - create_entities skips duplicates → suggest open_nodes to verify
 * - create_relations references missing entities → suggest create first
 * - delete_entities references non-existent → suggest search_nodes
 * - Any tool throws → generic recovery hint
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─── withHints helper ─────────────────────────────────────────────────────────
function withHints(text, hints) {
  if (!hints || hints.length === 0) return text;
  return text + "\n\n" + hints.map(h => `→ ${h}`).join("\n");
}

// ─── Memory file path resolution (copied from original, avoids import) ────────
const defaultMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "memory.jsonl");

async function ensureMemoryFilePath() {
  if (process.env.MEMORY_FILE_PATH) {
    return path.isAbsolute(process.env.MEMORY_FILE_PATH)
      ? process.env.MEMORY_FILE_PATH
      : path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.MEMORY_FILE_PATH);
  }
  return defaultMemoryPath;
}

// ─── KnowledgeGraphManager (inlined from original server) ─────────────────────
class KnowledgeGraphManager {
  memoryFilePath;
  constructor(memoryFilePath) {
    this.memoryFilePath = memoryFilePath;
  }
  async loadGraph() {
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.reduce((graph, line) => {
        const item = JSON.parse(line);
        if (item.type === "entity") {
          graph.entities.push({
            name: item.name,
            entityType: item.entityType,
            observations: item.observations,
          });
        }
        if (item.type === "relation") {
          graph.relations.push({
            from: item.from,
            to: item.to,
            relationType: item.relationType,
          });
        }
        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }
  async saveGraph(graph) {
    const lines = [
      ...graph.entities.map(e => JSON.stringify({
        type: "entity", name: e.name, entityType: e.entityType, observations: e.observations,
      })),
      ...graph.relations.map(r => JSON.stringify({
        type: "relation", from: r.from, to: r.to, relationType: r.relationType,
      })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join("\n"));
  }
  async createEntities(entities) {
    const graph = await this.loadGraph();
    const newEntities = entities.filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name));
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    return newEntities;
  }
  async createRelations(relations) {
    const graph = await this.loadGraph();
    const newRelations = relations.filter(r => !graph.relations.some(existingRelation =>
      existingRelation.from === r.from && existingRelation.to === r.to && existingRelation.relationType === r.relationType));
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    return newRelations;
  }
  async addObservations(observations) {
    const graph = await this.loadGraph();
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }
  async deleteEntities(entityNames) {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph);
  }
  async deleteObservations(deletions) {
    const graph = await this.loadGraph();
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
      }
    });
    await this.saveGraph(graph);
  }
  async deleteRelations(relations) {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(r => !relations.some(delRelation =>
      r.from === delRelation.from && r.to === delRelation.to && r.relationType === delRelation.relationType));
    await this.saveGraph(graph);
  }
  async readGraph() {
    return this.loadGraph();
  }
  async searchNodes(query) {
    const graph = await this.loadGraph();
    const filteredEntities = graph.entities.filter(e =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      e.entityType.toLowerCase().includes(query.toLowerCase()) ||
      e.observations.some(o => o.toLowerCase().includes(query.toLowerCase())));
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to));
    return { entities: filteredEntities, relations: filteredRelations };
  }
  async openNodes(names) {
    const graph = await this.loadGraph();
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to));
    return { entities: filteredEntities, relations: filteredRelations };
  }
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const EntitySchema = z.object({
  name: z.string().describe("The name of the entity"),
  entityType: z.string().describe("The type of the entity"),
  observations: z.array(z.string()).describe("An array of observation contents associated with the entity"),
});

const RelationSchema = z.object({
  from: z.string().describe("The name of the entity where the relation starts"),
  to: z.string().describe("The name of the entity where the relation ends"),
  relationType: z.string().describe("The type of the relation"),
});

let MEMORY_FILE_PATH;
let knowledgeGraphManager;

const server = new McpServer({
  name: "memory-server",
  version: "0.6.3",
});

// ─── create_entities ──────────────────────────────────────────────────────────
server.registerTool("create_entities", {
  title: "Create Entities",
  description: "Create multiple new entities in the knowledge graph",
  inputSchema: { entities: z.array(EntitySchema) },
  outputSchema: { entities: z.array(EntitySchema) },
}, async ({ entities }) => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.loadGraph();
    const existingNames = new Set(graph.entities.map(e => e.name));
    const duplicates = entities.filter(e => existingNames.has(e.name));
    if (duplicates.length > 0 && entities.length > duplicates.length) {
      hints.push(
        `Entities with these names already exist (skipped, NOT updated): ${duplicates.map(d => d.name).join(", ")}. To view existing data, use open_nodes([${duplicates.map(d => `'${d.name}'`).join(", ")}]). To add facts, use add_observations.`,
      );
    }

    const result = await knowledgeGraphManager.createEntities(entities);
    const text = JSON.stringify(result, null, 2);

    if (result.length === 0 && entities.length > 0) {
      hints.push(
        "All entities were skipped — they already exist in the graph. Use open_nodes to inspect them, or search_nodes to find related entities.",
      );
    } else if (result.length > 0) {
      hints.push(
        `Created ${result.length} entities. **Next steps**: (1) Connect them with create_relations(from, to, relationType) — use active voice for relationType (e.g., 'works_at'). (2) Add facts with add_observations. (3) Verify with read_graph.`,
      );
    }

    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { entities: result },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          `Error in create_entities: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
        ]),
      }],
      structuredContent: { entities: [] },
    };
  }
});

// ─── create_relations ─────────────────────────────────────────────────────────
server.registerTool("create_relations", {
  title: "Create Relations",
  description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
  inputSchema: { relations: z.array(RelationSchema) },
  outputSchema: { relations: z.array(RelationSchema) },
}, async ({ relations }) => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.loadGraph();
    const entityNames = new Set(graph.entities.map(e => e.name));
    const missingFrom = relations.filter(r => !entityNames.has(r.from));
    const missingTo = relations.filter(r => !entityNames.has(r.to));

    if (missingFrom.length > 0 || missingTo.length > 0) {
      const missingNames = new Set([
        ...missingFrom.map(r => r.from),
        ...missingTo.map(r => r.to),
      ]);
      hints.push(
        `Cannot create relation — entities not found: ${[...missingNames].join(", ")}. **Verify entity existence first**: use open_nodes([${[...missingNames].map(n => `'${n}'`).join(", ")}]) to check. If missing, create them with create_entities before creating relations.`,
      );
    }

    const result = await knowledgeGraphManager.createRelations(relations);
    const text = JSON.stringify(result, null, 2);

    if (result.length === 0 && relations.length > 0) {
      hints.push(
        "All relations were skipped — they may already exist or reference missing entities. Use read_graph to see current state.",
      );
    } else if (result.length > 0) {
      hints.push(
        `Created ${result.length} relations. **Verify**: use read_graph to see the full graph, or open_nodes to inspect specific entities.`,
      );
    }

    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { relations: result },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          `Error in create_relations: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
        ]),
      }],
      structuredContent: { relations: [] },
    };
  }
});

// ─── add_observations ─────────────────────────────────────────────────────────
server.registerTool("add_observations", {
  title: "Add Observations",
  description: "Add new observations to existing entities in the knowledge graph",
  inputSchema: {
    observations: z.array(z.object({
      entityName: z.string().describe("The name of the entity to add the observations to"),
      contents: z.array(z.string()).describe("An array of observation contents to add"),
    })),
  },
  outputSchema: {
    results: z.array(z.object({
      entityName: z.string(),
      addedObservations: z.array(z.string()),
    })),
  },
}, async ({ observations }) => {
  try {
    const result = await knowledgeGraphManager.addObservations(observations);
    const text = JSON.stringify(result, null, 2);
    const hints = [];
    if (result.length > 0) {
      hints.push(
        `Added observations to entity '${result[0].entityName}'. **Verify**: use open_nodes(['${result[0].entityName}']) to confirm the new observations are attached.`,
      );
    }
    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { results: result },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const hints = [];
    if (msg.includes("not found")) {
      hints.push(
        `Entity not found — observations can only be added to **existing** entities. Use search_nodes('QUERY') to find the correct name, or create_entities if it doesn't exist yet.`,
      );
    } else {
      hints.push(
        `Error in add_observations: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
      );
    }
    return {
      content: [{ type: "text", text: withHints(`Error: ${msg}`, hints) }],
      isError: true,
    };
  }
});

// ─── delete_entities ──────────────────────────────────────────────────────────
server.registerTool("delete_entities", {
  title: "Delete Entities",
  description: "Delete multiple entities and their associated relations from the knowledge graph",
  inputSchema: {
    entityNames: z.array(z.string()).describe("An array of entity names to delete"),
  },
  outputSchema: {
    success: z.boolean(),
    message: z.string(),
  },
}, async ({ entityNames }) => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.loadGraph();
    const existingNames = new Set(graph.entities.map(e => e.name));
    const nonExistent = entityNames.filter(n => !existingNames.has(n));

    if (nonExistent.length > 0) {
      hints.push(
        `Entities not found (nothing deleted): ${nonExistent.join(", ")}. Use search_nodes('QUERY') to find valid entity names in the graph.`,
      );
    }

    await knowledgeGraphManager.deleteEntities(entityNames);
    const deletedCount = entityNames.length - nonExistent.length;
    const text = "Entities deleted successfully";
    if (deletedCount > 0) {
      hints.push(
        `Deleted ${deletedCount} entities (and their cascaded relations). **Verify**: use read_graph to confirm the current state.`,
      );
    }
    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { success: true, message: withHints(text, hints) },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          `Error in delete_entities: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
        ]),
      }],
      structuredContent: { success: false, message: msg },
    };
  }
});

// ─── delete_observations ──────────────────────────────────────────────────────
server.registerTool("delete_observations", {
  title: "Delete Observations",
  description: "Delete specific observations from entities in the knowledge graph",
  inputSchema: {
    deletions: z.array(z.object({
      entityName: z.string().describe("The name of the entity containing the observations"),
      observations: z.array(z.string()).describe("An array of observations to delete"),
    })),
  },
  outputSchema: {
    success: z.boolean(),
    message: z.string(),
  },
}, async ({ deletions }) => {
  try {
    await knowledgeGraphManager.deleteObservations(deletions);
    const text = "Observations deleted successfully";
    return {
      content: [{ type: "text", text }],
      structuredContent: { success: true, message: text },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          "An error occurred while deleting observations. Verify the entity exists with open_nodes or search_nodes.",
        ]),
      }],
      structuredContent: { success: false, message: msg },
    };
  }
});

// ─── delete_relations ─────────────────────────────────────────────────────────
server.registerTool("delete_relations", {
  title: "Delete Relations",
  description: "Delete multiple relations from the knowledge graph",
  inputSchema: {
    relations: z.array(RelationSchema).describe("An array of relations to delete"),
  },
  outputSchema: {
    success: z.boolean(),
    message: z.string(),
  },
}, async ({ relations }) => {
  try {
    await knowledgeGraphManager.deleteRelations(relations);
    const text = "Relations deleted successfully";
    return {
      content: [{ type: "text", text }],
      structuredContent: { success: true, message: text },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          "An error occurred while deleting relations. Use read_graph to see the current state.",
        ]),
      }],
      structuredContent: { success: false, message: msg },
    };
  }
});

// ─── read_graph ───────────────────────────────────────────────────────────────
server.registerTool("read_graph", {
  title: "Read Graph",
  description: "Read the entire knowledge graph",
  inputSchema: {},
  outputSchema: {
    entities: z.array(EntitySchema),
    relations: z.array(RelationSchema),
  },
}, async () => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.readGraph();
    const text = JSON.stringify(graph, null, 2);

    if (graph.entities.length === 0) {
      hints.push(
        "The knowledge graph is empty (0 entities, 0 relations). **Create entities first** using create_entities with {name, entityType, observations}.",
      );
    } else {
      hints.push(
        `Knowledge graph has ${graph.entities.length} entities, ${graph.relations.length} relations. Use search_nodes(query) to find specific entities, or open_nodes(names) to get exact matches.`,
      );
    }

    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { ...graph },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          "An error occurred reading the graph. The storage file may be corrupted.",
        ]),
      }],
      structuredContent: { entities: [], relations: [] },
    };
  }
});

// ─── search_nodes ─────────────────────────────────────────────────────────────
server.registerTool("search_nodes", {
  title: "Search Nodes",
  description: "Search for nodes in the knowledge graph based on a query",
  inputSchema: {
    query: z.string().describe("The search query to match against entity names, types, and observation content"),
  },
  outputSchema: {
    entities: z.array(EntitySchema),
    relations: z.array(RelationSchema),
  },
}, async ({ query }) => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.searchNodes(query);
    const text = JSON.stringify(graph, null, 2);

    if (graph.entities.length === 0) {
      const fullGraph = await knowledgeGraphManager.readGraph();
      if (fullGraph.entities.length === 0) {
        hints.push(
          `No entities matched '${query}' — the knowledge graph is empty (0 entities). **Create entities first** using create_entities with {name, entityType, observations}, then retry search.`,
        );
      } else {
        hints.push(
          `No entities matched '${query}' (graph has ${fullGraph.entities.length} entities). **Broaden your query** — try a shorter substring or different keyword. Alternatively, use read_graph to see all entities.`,
        );
      }
    }

    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { ...graph },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          `Error in search_nodes: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
        ]),
      }],
      structuredContent: { entities: [], relations: [] },
    };
  }
});

// ─── open_nodes ───────────────────────────────────────────────────────────────
server.registerTool("open_nodes", {
  title: "Open Nodes",
  description: "Open specific nodes in the knowledge graph by their names",
  inputSchema: {
    names: z.array(z.string()).describe("An array of entity names to retrieve"),
  },
  outputSchema: {
    entities: z.array(EntitySchema),
    relations: z.array(RelationSchema),
  },
}, async ({ names }) => {
  const hints = [];
  try {
    const graph = await knowledgeGraphManager.openNodes(names);
    const text = JSON.stringify(graph, null, 2);

    if (graph.entities.length === 0) {
      const fullGraph = await knowledgeGraphManager.readGraph();
      if (fullGraph.entities.length === 0) {
        hints.push(
          `No entities found with names: ${names.join(", ")} — the knowledge graph is empty (0 entities). **Create entities first** using create_entities, then retry.`,
        );
      } else {
        hints.push(
          `No entities found with names: ${names.join(", ")} (graph has ${fullGraph.entities.length} entities). **Broaden your search** — use search_nodes with a substring to find correct names. Alternatively, use read_graph to see all entities.`,
        );
      }
    } else if (graph.entities.length < names.length) {
      const found = new Set(graph.entities.map(e => e.name));
      const missing = names.filter(n => !found.has(n));
      hints.push(
        `Entities not found: ${missing.join(", ")}. Entity names are **case-sensitive and must match exactly**. Use search_nodes with a substring to find correct names (e.g., search 'ali' finds 'Alice').`,
      );
    }

    return {
      content: [{ type: "text", text: withHints(text, hints) }],
      structuredContent: { ...graph },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: withHints(`Error: ${msg}`, [
          `Error in open_nodes: ${msg}. **Recovery**: use read_graph to check current state, or search_nodes to find existing entities.`,
        ]),
      }],
      structuredContent: { entities: [], relations: [] },
    };
  }
});

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  MEMORY_FILE_PATH = await ensureMemoryFilePath();
  knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Knowledge Graph MCP Server (talking variant) running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
