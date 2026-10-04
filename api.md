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
    - `paymentProtocol` (string): Filter by payment protocol (e.g., `"x402"`, `"stripe"`).
    - `paymentRail` (string): Filter by settlement rail in `network:token` format (e.g., `"nano:XNO"`, `"base:USDC"`).
    - `paymentDirection` (string): Filter by payment direction: `"inbound"`, `"outbound"`, or `"both"`.

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
- `payment_protocol` (string): Filter by payment protocol (e.g., `x402`, `stripe`, `lightning-invoice`, `ap2`, `manual`).
- `payment_rail` (string): Filter by settlement rail in `network:token` format (e.g., `nano:XNO`, `base:USDC`, `stripe:USD`).
- `payment_direction` (string): Filter by payment direction: `inbound`, `outbound`, or `both`.

### 3. Get Agent Details (Public)

**GET** `/public/agents/:id`

Retrieve detailed information about a specific agent.

**Path Parameters**:
- `id` (string): The unique agent ID or package name.

### 4. Resolve Package (Public)

**GET** `/public/agents/resolve/:package_id`

Resolve an agent's package name to its Agent Card. For an indexed A2A 1.0
card, the response is the card object itself, with no registry response wrapper.
Use `GET /public/agents/:id` for registry metadata such as the package name and
verification details.

**Path Parameters**:
- `package_id` (string): The unique package name.

**Example response (A2A 1.0)**:
```json
{
  "name": "Weather Bot",
  "description": "Provides weather forecasts for a requested location.",
  "supportedInterfaces": [
    {
      "url": "https://example.com/a2a",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extendedAgentCard": false
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["application/json"],
  "skills": [
    {
      "id": "weather_forecast",
      "name": "Weather forecast",
      "description": "Returns a forecast for a location.",
      "tags": ["weather", "forecast"]
    }
  ]
}
```

Read connection details from the returned card's declared interfaces. A card
may also declare `securitySchemes` and `securityRequirements`; public resolution
does not grant credentials for the agent's endpoint.

### 5. Submit Agent (Public Ingest)

**POST** `/public/ingest`

Submit a new agent manifest for indexing.

**Body Parameters**:
- `manifestUrl` (string): URL to the agent's manifest.

---

## Payment Discovery

The A2A Registry supports filtering agents by payment capabilities. Agents can declare payment protocols and settlement rails using the [Registry Extension](./registry-extension-reference.md), and users can discover them programmatically.

### Payment Filter Parameters

Payment filters can be applied to both the **Browse API** (`GET /public/agents`) and the **A2A Discover API** (`POST /a2a/discover`).

#### Available Filters

| Parameter | Type | Description | Example Values |
|---|---|---|---|
| `payment_protocol` (Browse) / `paymentProtocol` (A2A) | string | Payment negotiation protocol | `x402`, `stripe`, `lightning-invoice`, `ap2`, `manual` |
| `payment_rail` (Browse) / `paymentRail` (A2A) | string | Settlement rail in `network:token` format | `nano:XNO`, `base:USDC`, `stripe:USD`, `lightning` |
| `payment_direction` (Browse) / `paymentDirection` (A2A) | string | Payment flow direction | `inbound`, `outbound`, `both` |

### Rail Format

The `payment_rail` / `paymentRail` parameter uses the format `network:token`:

- **`network`** — The settlement network (e.g., `nano`, `base`, `solana`, `lightning`, `stripe`)
- **`token`** — The currency or token symbol (e.g., `XNO`, `USDC`, `ETH`, `BTC`, `USD`)
- **Format** — `network:token` (e.g., `nano:XNO`, `base:USDC`)

For networks where the token is implicit (like `lightning` or single-token networks), you can use just the network name (e.g., `lightning`).

### Direction Matching Logic

| Filter Value | Matches Agents With |
|---|---|
| `inbound` | `direction: "inbound"` or `direction: null` (default is inbound) |
| `outbound` | `direction: "outbound"` or `direction: "both"` |
| `both` | `direction: "both"` only |

### Combining Payment Filters

All payment filters use **AND logic** — the agent must match all specified criteria:

```bash
# Agents that support x402 AND accept Nano XNO AND can receive payments
GET /public/agents?payment_protocol=x402&payment_rail=nano:XNO&payment_direction=inbound
```

You can also combine payment filters with other filters:

```bash
# x402 agents for developers
GET /public/agents?payment_protocol=x402&target=developers

# Nano agents in the Finance category
GET /public/agents?payment_rail=nano:XNO&category=finance
```

### Examples

#### Browse API (REST)

**Find all agents that accept x402:**
```bash
GET /public/agents?payment_protocol=x402
```

**Find agents that accept Nano (XNO):**
```bash
GET /public/agents?payment_rail=nano:XNO
```

**Find agents that accept x402 on Nano:**
```bash
GET /public/agents?payment_protocol=x402&payment_rail=nano:XNO
```

**Find agents that can send payments (outbound):**
```bash
GET /public/agents?payment_direction=outbound
```

**Find agents that accept USDC on Base:**
```bash
GET /public/agents?payment_rail=base:USDC
```

**Find Stripe-based payment agents:**
```bash
GET /public/agents?payment_protocol=stripe&payment_rail=stripe:USD
```

#### A2A Discover API (JSON-RPC)

**Basic semantic search with payment filters:**
```bash
POST /a2a/discover
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "query": "find payment agents",
  "filters": {
    "paymentProtocol": "x402",
    "paymentRail": "nano:XNO",
    "paymentDirection": "inbound"
  }
}
```

**Multi-filter example:**
```json
{
  "query": "business agents that accept crypto",
  "filters": {
    "target": "Business",
    "paymentProtocol": "x402",
    "paymentDirection": "inbound"
  },
  "limit": 10
}
```

**Outbound payment agents:**
```json
{
  "query": "agents that can pay me",
  "filters": {
    "paymentDirection": "outbound"
  }
}
```

### Response Format

Agents returned from browse or discover APIs include a `payment` field (if declared):

```json
{
  "id": "agent-123",
  "packageName": "com.example.payment-agent",
  "displayName": "My Payment Agent",
  "description": "...",
  "payment": {
    "direction": "inbound",
    "protocols": ["x402", "stripe"],
    "rails": [
      {
        "network": "nano",
        "token": "XNO",
        "type": "crypto",
        "feeModel": "feeless",
        "settlementTime": "instant"
      },
      {
        "network": "stripe",
        "token": "USD",
        "type": "fiat"
      }
    ]
  }
}
```

The `payment` object contains:
- **`direction`** — Payment flow direction
- **`protocols`** — Array of supported protocols
- **`rails`** — Array of settlement rail objects with full metadata

### Common Use Cases

#### Use Case 1: Find All x402 Agents

```bash
# REST API
GET /public/agents?payment_protocol=x402

# A2A Discover
POST /a2a/discover
{
  "query": "x402 agents",
  "filters": { "paymentProtocol": "x402" }
}
```

#### Use Case 2: Find Feeless Crypto Agents

```bash
# Find Nano agents (Nano is feeless)
GET /public/agents?payment_rail=nano:XNO
```

You can also inspect the response's `payment.rails[].feeModel` field to filter by fee model in your application logic.

#### Use Case 3: Find Agents Accepting Stablecoins

```bash
# Find USDC on Base
GET /public/agents?payment_rail=base:USDC

# Find USDC on Solana
GET /public/agents?payment_rail=solana:USDC
```

#### Use Case 4: Find Agents That Can Pay You

```bash
# Agents with outbound payment capability
GET /public/agents?payment_direction=outbound
```

#### Use Case 5: Find Traditional Payment Agents

```bash
# Stripe-based agents
GET /public/agents?payment_protocol=stripe
```

### Edge Cases & Notes

**Case sensitivity:**
- Protocol names are case-insensitive (`x402` = `X402`)
- Network names are case-insensitive (`nano` = `Nano`)
- Token symbols are case-sensitive (`USDC` ≠ `usdc`)

**Rail matching:**
- `payment_rail=nano:XNO` — Exact match (network=nano, token=XNO)
- `payment_rail=nano` — Matches all rails on the Nano network (any token or no token)
- `payment_rail=base:USDC` — USDC on Base specifically (not Ethereum or Solana)

**Protocol-rail mapping:**
- If an agent declares multiple protocols, each rail may specify which protocol it uses via the `protocol` field
- Filtering by both protocol and rail returns agents where that specific protocol-rail combination exists

**Empty results:**
- If no agents match the payment criteria, the API returns an empty array
- Ensure you're using the correct format (`network:token` not `network` or `TOKEN` alone)

### Integration with Playground

The [Playground](/playground) supports natural language payment queries. Examples:

> "Find agents that accept Nano"  
> "Show me x402 agents on Base USDC"  
> "Which agents can pay me?"

The meta-agent automatically translates these to the appropriate payment filters.

### Related Documentation

- **[Registry Extension Reference](./registry-extension-reference.md)** — How agents declare payment capabilities
- **[Payment Capabilities Guide](./payment-capabilities-guide.md)** — Step-by-step guide for agent authors
- **[Payment Examples](./payment-examples.md)** — Copy-paste snippets for common configurations

---
