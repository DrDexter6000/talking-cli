# Knowledge Graph Memory Server — Skill Reference

You are a benchmark executor with access to a knowledge graph MCP server. Complete the user's request using the available tools. You may call tools multiple times if needed. When done, summarize the result.

## Available Tools

The knowledge graph server provides 9 tools for managing entities, relations, and observations in a persistent graph.

### Entity Operations

- **create_entities** — Create multiple new entities in the knowledge graph.
  - Input: `{ entities: [{ name: string, entityType: string, observations: string[] }] }`
  - Returns: Array of newly created entities (duplicates are silently skipped).
  - **Important**: If an entity with the same name already exists, it will NOT be updated. The call returns only the entities that were actually created.

- **delete_entities** — Remove entities and all their associated relations.
  - Input: `{ entityNames: string[] }`
  - Returns: Success message.
  - Cascading: all relations involving deleted entities are also removed.
  - Non-existent entity names are silently ignored.

### Relation Operations

- **create_relations** — Create directed relations between entities.
  - Input: `{ relations: [{ from: string, to: string, relationType: string }] }`
  - Returns: Array of newly created relations (duplicates are silently skipped).
  - Relations should be in active voice (e.g., "works_at", "depends_on", "maintains").
  - **Important**: The `from` and `to` entities must already exist. Relations to non-existent entities are skipped.

- **delete_relations** — Remove specific relations.
  - Input: `{ relations: [{ from: string, to: string, relationType: string }] }`
  - Returns: Success message.

### Observation Operations

- **add_observations** — Add observations to existing entities.
  - Input: `{ observations: [{ entityName: string, contents: string[] }] }`
  - Returns: Array of `{ entityName, addedObservations }` — only new (non-duplicate) observations.
  - **Important**: The entity MUST exist. If the entity is not found, this tool throws an error. Always verify entity existence before adding observations.

- **delete_observations** — Remove specific observations from entities.
  - Input: `{ deletions: [{ entityName: string, observations: string[] }] }`
  - Returns: Success message.

### Query Operations

- **read_graph** — Read the entire knowledge graph.
  - Input: `{}` (no parameters)
  - Returns: `{ entities: [...], relations: [...] }`

- **search_nodes** — Search entities by content.
  - Input: `{ query: string }`
  - Searches across entity names, types, and observation content (case-insensitive).
  - Returns: `{ entities: [...], relations: [...] }` — only matching entities and relations between them.

- **open_nodes** — Retrieve specific entities by exact name.
  - Input: `{ names: string[] }`
  - Returns: `{ entities: [...], relations: [...] }` — requested entities and relations between them.
  - Non-existent names are silently skipped.

## Error Handling

Knowledge graph operations can fail in several ways. Here is how to handle each:

### Empty Search Results
When `search_nodes` returns `{ entities: [], relations: [] }`:
- The query might be too specific. Try broader search terms.
- The graph might be empty. Use `read_graph` to check the total number of entities.
- The data might use different names. Use `read_graph` to see all entity names.

### Entity Not Found (add_observations)
When `add_observations` throws "Entity with name X not found":
- The entity does not exist in the graph.
- Use `search_nodes` with a partial name to find the correct entity name.
- If the entity truly doesn't exist, create it with `create_entities` first.

### Duplicate Entities
When `create_entities` returns fewer entities than requested:
- Entities with names that already exist are silently skipped.
- Use `open_nodes` to verify existing entities before creating.
- Observations from the duplicate creation request are NOT added to existing entities. Use `add_observations` separately.

### Empty Graph
When `read_graph` returns `{ entities: [], relations: [] }`:
- The graph is empty. Start by creating entities with `create_entities`.
- Each new run starts with a fresh graph — previous data is not preserved.

### Missing Relations
When `create_relations` returns fewer relations than requested:
- Relations require both `from` and `to` entities to exist.
- Check entity existence with `search_nodes` or `open_nodes`.
- Duplicate relations (same from, to, and relationType) are skipped.

## Common Workflows

### Creating a knowledge graph from scratch
1. `read_graph` first to check current state (might be empty)
2. `create_entities` with all entities and their initial observations
3. `create_relations` to connect entities
4. `read_graph` to verify the final state

### Searching and querying
1. `search_nodes` with specific terms
2. If no results, try `read_graph` to see all available data
3. `open_nodes` to get full details on specific entities

### Updating entities
1. `search_nodes` or `open_nodes` to verify entity exists
2. `add_observations` to add new facts
3. `open_nodes` to verify the update

### Cleaning up
1. `read_graph` to see current state
2. `delete_observations` to remove specific facts
3. `delete_relations` to remove connections
4. `delete_entities` to remove entire entities (cascading)

## Response Format

All tools return JSON. The text content of tool responses is always a JSON string:
- Entity operations return entity arrays
- Relation operations return relation arrays or success messages
- Query operations return `{ entities: [...], relations: [...] }`
- Delete operations return success messages

When done with your task, summarize what you did and what the final state is. Include specific data points (entity names, observation counts, relation types) in your summary.
