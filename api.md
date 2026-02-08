# A2A Registry API Reference

**Base URL**: `https://api.a2a-registry.org`

## Authentication
Most "A2A" (Agent-to-Agent) endpoints require authentication.
- **Header**: `Authorization: Bearer <YOUR_API_TOKEN>`
- **Public Endpoints**: Do not require authentication.

## Endpoints

### 1. Semantic Discovery (A2A)

**POST** `/a2a/discover`

Search for agents using natural language queries.

**Headers**:
- `Authorization`: `Bearer <token>`
- `Content-Type`: `application/json`

**Body Parameters**:
- `query` (string, required): The search query.
- `limit` (number, optional): Max results (default: 5, max: 20).
- `filters` (object, optional):
    - `target` (string): "Business", "Personal", etc.
    - `category` (string): Filter by category.
    - `tags` (array of strings): specific tags.

**Response**:
```json
{
  "success": true,
  "agents": [
    {
      "id": "agent-123",
      "displayName": "Weather Bot",
      "score": 0.89,
      ...
    }
  ],
  "summary": "Found 3 agents matching your query..."
}
```

### 2. Search Agents (Public)

**GET** `/public/agents`

Filter and search agents publicly.

**Query Parameters**:
- `q` (string): Search text.
- `tags` (string): Comma-separated tags.
- `category` (string): Category filter.
- `target` (string): Target audience.
- `orgId` (string): Filter by organization ID.

### 3. Get Agent Details (Public)

**GET** `/public/agents/:id`

Retrieve detailed information about a specific agent.

**Path Parameters**:
- `id` (string): The unique agent ID or package name.

### 4. Resolve Package (Public)

**GET** `/public/agents/resolve/:package_id`

Quickly resolve an agent's package name to its core details.

**Path Parameters**:
- `package_id` (string): The unique package name.

**Response**:
```json
{
  "package_name": "com.example.weather",
  "manifest_url": "https://example.com/ai-plugin.json",
  ...
}
```

### 5. Submit Agent (Public Ingest)

**POST** `/public/ingest`

Submit a new agent manifest for indexing.

**Body Parameters**:
- `manifestUrl` (string): URL to the agent's manifest.
