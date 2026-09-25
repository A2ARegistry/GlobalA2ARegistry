# A2A Registry Extension Support

## 1. Background & Motivation

### The A2A v1.0 Extension Mechanism

The A2A v1.0 specification (Section 4.4.3) defines a formal extension mechanism via `capabilities.extensions` — an array of `AgentExtension` objects on the AgentCard:

```json
"capabilities": {
  "extensions": [
    {
      "uri": "https://...",
      "description": "...",
      "required": false,
      "params": { }
    }
  ]
}
```

Each extension is identified by a URI and carries an optional `params` object for extension-specific data. The spec explicitly supports this pattern for adding functionality beyond the core protocol while maintaining backward compatibility with clients that don't understand the extension.

For a full A2A 1.0 AgentCard schema, refer to ***Agent Discovery Objects*** section in this document:
[A2A 1.0 Agent Card Schema](https://a2a-protocol.org/latest/specification/#44-agent-discovery-objects)

### Why the Registry Needs Its Own Extension

The registry has accumulated two categories of registry-specific metadata that agents need to declare:

**Category 1 — Identity & Ownership Hints** (existing, informal)
Agents hosted on personal platforms (`*.workers.dev`, `*.github.io`) cannot be verified via domain ownership because they don't own the apex domain. To claim a `github.*` package name, these agents currently embed three fields in a `metadata` object on their card:

```json
"metadata": {
  "registryIdentityProvider": "github",
  "registryIdentity": "Joseandres1984",
  "registryPackageName": "github.Joseandres1984.my_agent"
}
```

**Problem:** `metadata` is not a defined field on the AgentCard in A2A v1.0. It was a v0.3-era convention. It works in practice because the registry scanner preserves unknown fields, but it is non-standard and will generate errors in strict v1.0 validators.

**Category 2 — Payment Rail Declaration** (proposed, from [Issue #11](https://github.com/A2ARegistry/GlobalA2ARegistry/issues/11))
As agent-to-agent commerce grows, a builder needs to discover agents by the payment rails they accept — not just by keyword. There is currently no structured, filterable way to declare "this agent accepts Nano (XNO)" vs "this agent accepts USDC on Base". Full-text search over name/description is insufficient because x402 (the HTTP payment protocol) and the underlying rail (USDC, Nano, Solana, etc.) are distinct concepts — searching "x402" returns 100+ agents with no way to distinguish their actual settlement currency or network.

**Solution:** Define a single, versioned, officially-supported registry extension URI. All registry-specific metadata lives inside this extension's `params` object. The extension is extensible by design — new registry features add new keys to `params` without requiring a new extension URI or breaking existing agents.

---

## 2. The Registry Extension

### Extension URI

```
https://a2a-registry.org/extensions/registry/v1
```

This URI is owned by the registry and versioned. A breaking change to the `params` schema would require a new URI (`/v2`). Additive changes (new optional keys) do not require a version bump.

#### URI Dereferencing

Per web protocol conventions, dereferencing this URI via HTTP GET should return useful content. The registry should serve:
- An HTML human-readable documentation page at the URI by default
- The machine-readable JSON Schema for `params` via content negotiation (`Accept: application/schema+json`)

This allows validators, IDEs, and tooling to auto-discover the extension schema from the URI itself.

#### Trailing Slash Normalization

Scanner and validator code that compares extension URIs MUST normalize trailing slashes before comparison, so `.../v1` and `.../v1/` are treated identically:

```typescript
const REGISTRY_EXT_URI = 'https://a2a-registry.org/extensions/registry/v1';
const match = (uri: string) => uri.replace(/\/$/, '') === REGISTRY_EXT_URI;
```

### Full Declaration Example

```json
{
  "name": "My Agent",
  "description": "...",
  "version": "1.0.0",
  "supportedInterfaces": [ ... ],
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "A2A Registry metadata for ownership hints and discovery attributes",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "Joseandres1984",
            "packageName": "github.Joseandres1984.my_agent"
          },
          "payment": {
            "protocols": ["x402"],
            "rails": [
              {
                "network": "nano",
                "token": "XNO",
                "type": "crypto",
                "feeModel": "feeless",
                "settlementTime": "instant"
              }
            ]
          }
        }
      }
    ]
  },
  ...
}
```

The `required: false` is mandatory here — the registry extension is purely informational and a client that doesn't understand it must not refuse to interact with the agent.

> **Validator enforcement:** The `A2AManifestValidator` should actively check this. If an agent declares the registry extension URI with `required: true`, the validator must emit a warning/error (`REGISTRY_EXT_MUST_BE_OPTIONAL`). A general A2A client that doesn't recognize the registry extension would reject connections to any agent that marks it required — which would break interoperability.

---

## 3. `params` Schema

All fields are optional. An agent only includes the keys relevant to it.

### 3.1 `identity` — Ownership Hint for Personal Hosting Platforms

Used by agents hosted on platforms where subdomain ownership implies account ownership (`*.workers.dev`, `*.github.io`) but domain-level DNS verification is impossible.

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | Yes (if identity present) | Identity provider. Currently only `"github"` is supported. |
| `username` | string | Yes (if identity present) | The owner's username on that provider (case-preserved for display; validated case-insensitively). |
| `packageName` | string | Yes (if identity present) | The desired registry package name. Must start with `{provider}.{username}.` (case-insensitive). |

**Validation rules (enforced by the registry):**
- `provider` must be `"github"` (the only supported provider at this time)
- `packageName` must start with `github.{username}.` or `github.{username}/` (case-insensitive) — prevents namespace hijacking. Note: comparison is always case-insensitive but the value is stored as provided (case-preserved) for display
- At **claim time**, the signed-in user's linked GitHub account must match `username`
- Only honoured when the agent card is served from a trusted personal-hosting domain (`*.workers.dev`, `*.github.io`)

**Future provider expansion:** The `provider` field is intentionally a string to accommodate future providers (`gitlab`, `huggingface`, etc.) without a schema version bump. Each new provider requires a corresponding implementation in `resolveClaimIdentity()` and a new entry in the supported providers list.

**Example:**
```json
"identity": {
  "provider": "github",
  "username": "Joseandres1984",
  "packageName": "github.Joseandres1984.lumen_b2b_agent"
}
```

### 3.2 `payment` — Payment Capability Declaration

Used by agents that accept payment for their services. Separates the **protocol** (how payment is negotiated between agents) from the **rails** (what actually settles the value), because these are independent axes and both matter for discovery.

**Why the separation matters:**
- `protocol` tells a client agent *how to initiate and prove payment* — the handshake mechanism
- `rails` tells a client agent *whether it can actually settle* — the underlying network and currency
- An agent may support x402 as the protocol but only accept Nano (XNO), not USDC. Another may support x402 but only USDC on Base. A third may use Stripe, which bundles both concerns. Without separation, a builder cannot ask "give me x402 agents I can pay with Nano" as a structured query.

#### `payment` object fields

| Field | Type | Required | Description |
|---|---|---|---|
| `protocols` | array of string | No | Payment negotiation protocols supported. See values below. |
| `rails` | array of `PaymentRail` | No | Settlement rails accepted. Each entry is an object. |
| `direction` | string | No | Whether this agent **receives** payment, **makes** payment, or both. Values: `"inbound"` (can be paid), `"outbound"` (can pay others), `"both"`. Defaults to `"inbound"` if omitted — preserving backward compatibility with all existing cards. Makes it possible to query "which agents can pay me" as well as "which agents can I pay". |

#### `protocols` values

| Value | Description |
|---|---|
| `x402` | HTTP 402-based payment protocol (Coinbase open standard). The protocol envelope — covers all x402 payment schemes (`exact`, `upto`, `batch-settlement`). The specific scheme is declared per-rail using the `scheme` field on `PaymentRail`. |
| `ap2` | Agent Payment Protocol — higher-level payment layer above x402. |
| `lightning-invoice` | Bitcoin Lightning Network BOLT11 invoice. |
| `stripe` | Stripe-based payment (traditional card/bank). Bundles protocol + rail. |
| `manual` | Payment arranged out-of-band (invoice, subscription, etc.). |

The list is open-ended — values not listed here are accepted by the registry as-is.

#### `PaymentRail` object

| Field | Type | Required | Description |
|---|---|---|---|
| `network` | string | Yes | The settlement network or blockchain. e.g. `"nano"`, `"base"`, `"solana"`, `"ethereum"`, `"lightning"`, `"stripe"` |
| `token` | string | No | The currency or token on that network. e.g. `"XNO"`, `"USDC"`, `"ETH"`, `"BTC"`. Omit for networks where the currency is implicit (e.g. `"nano"` always means XNO). |
| `scheme` | string | No | The x402 payment scheme used on this rail. Only relevant when `protocols` includes `x402`. Values mirror the x402 spec: `"exact"` (fixed price, buyer authorizes the advertised amount — default), `"upto"` (metered, buyer authorizes a maximum and seller charges actual usage), `"batch-settlement"` (high-volume channel, per-request authorizations accumulate). Defaults to `"exact"` if omitted for x402 rails. |
| `protocols` | array of string | No | Which payment protocols can use this specific rail. If omitted, the rail applies to all protocols declared at the top level. Use this to resolve M:N ambiguity when different protocols settle on different rails (see example below). |
| `type` | string | No | Settlement category: `"crypto"`, `"fiat"`, or `"stablecoin"`. Helps filter by settlement type without parsing network/token. |
| `feeModel` | string | No | Fee model hint: `"feeless"`, `"low"`, `"variable"`. Informational — not validated by registry. |
| `settlementTime` | string | No | Approximate settlement time hint: `"instant"` (<2s), `"fast"` (<60s), `"standard"` (minutes-hours), `"slow"` (hours-days). Informational. |
| `caip2` | string | No | [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) chain identifier for unambiguous network identification. e.g. `"eip155:8453"` (Base Mainnet), `"eip155:84532"` (Base Sepolia), `"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"` (Solana Mainnet). Strongly recommended for EVM chains to distinguish mainnet from testnets. |
| `contractAddress` | string | No | Token contract address on the network. Recommended for stablecoins to prevent ticker spoofing (e.g. bridged vs native USDC). e.g. `"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"` (USDC on Base). |
| `verification` | object | No | Describes how a paying client can **confirm** that payment landed — the proof mechanism. This is the second half of "autonomously settleable": discovery finds the agent; verification closes the loop. See `PaymentVerification` object below. |

#### `PaymentVerification` object

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | string | Yes | The confirmation method, aligned with the x402 scheme on the rail. `"exact"` (x402 exact-scheme — block hash or signed receipt returned in response header), `"upto"` (x402 upto-scheme — actual amount settled confirmed via response), `"on-chain-scan"` (query a public node independently), `"webhook"` (agent posts a callback). For non-x402 rails use `"on-chain-scan"` or `"webhook"`. |
| `proof` | string | No | The specific header name, endpoint, or mechanism that carries the proof. e.g. `"X-Nano-Payment"` for the Nano exact-scheme block-hash header, `"X-Payment-Response"` for standard x402. |
| `verifyUrl` | string | No | URL of a public node or API endpoint an autonomous client can query to independently verify the transaction, without a facilitator. e.g. a Nano RPC node URL for on-chain confirmation. |

> **Why `verification` matters for autonomous agents:** Discovery (`?payment_rail=nano:XNO`) answers "can I pay this agent?". Verification answers "did my payment land, and how do I know?". Without a declared proof mechanism, a rail is *discoverable* but not *autonomously settleable* — the client must still rely on facilitators or out-of-band checks. For the Nano exact-scheme, the first concrete value is `mode: "exact", proof: "X-Nano-Payment"` — the block hash returned in the response header, which any client can verify against a public Nano node with no intermediary.

> **Note on `caip2` / `contractAddress`:** For autonomous agent settlement, an agent paying on Base Sepolia (testnet) when intending Base Mainnet is a real failure mode. The `caip2` field and `contractAddress` field are informational in v1 — the registry does not verify them — but they provide sufficient signal for client agents to validate before initiating payment.

> **Note on pricing:** The `payment` object describes *settlement capability* — which protocols and rails this agent can receive payment on. It does not describe per-request pricing. In x402 and AP2, pricing is negotiated dynamically at invocation time via HTTP 402 response headers. Per-request pricing hints (e.g. `pricingModel: "pay-per-request"`) are a candidate for a future Phase 3 extension key.

**Example — Nano-only agent using x402 exact scheme (inbound, with verification):**
```json
"payment": {
  "direction": "inbound",
  "protocols": ["x402"],
  "rails": [
    {
      "network": "nano",
      "token": "XNO",
      "scheme": "exact",
      "type": "crypto",
      "feeModel": "feeless",
      "settlementTime": "instant",
      "verification": {
        "mode": "exact",
        "proof": "X-Nano-Payment",
        "verifyUrl": "https://proxy.nano.org/rpc"
      }
    }
  ]
}
```

**Example — Multi-rail agent (x402 + Stripe, each on different rails) — demonstrating per-rail protocol binding:**
```json
"payment": {
  "protocols": ["x402", "stripe"],
  "rails": [
    {
      "network": "base",
      "token": "USDC",
      "type": "stablecoin",
      "protocols": ["x402"],
      "caip2": "eip155:8453",
      "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "feeModel": "low",
      "settlementTime": "fast"
    },
    {
      "network": "stripe",
      "token": "USD",
      "type": "fiat",
      "protocols": ["stripe"]
    }
  ]
}
```
Without `protocols` on each rail, a query for `?payment_protocol=stripe&payment_rail=base:USDC` would falsely match this agent. With per-rail `protocols`, the registry correctly resolves that stripe only applies to the USD/Stripe rail.

**Example — Solana USDC with chain disambiguation:**
```json
"payment": {
  "protocols": ["x402", "ap2"],
  "rails": [
    {
      "network": "solana",
      "token": "USDC",
      "type": "stablecoin",
      "caip2": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      "contractAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "feeModel": "low",
      "settlementTime": "instant"
    }
  ]
}
```

**Example — Traditional Stripe payment:**
```json
"payment": {
  "protocols": ["stripe"],
  "rails": [
    {
      "network": "stripe",
      "token": "USD",
      "type": "fiat"
    }
  ]
}
```

---

## 4. Registry Behaviour

### 4.1 Scanner Extraction

The registry scanner reads `capabilities.extensions` during card ingestion and extracts the registry extension params when present.

Extracted values are stored in dedicated columns/fields for indexing (see Section 5).

### 4.2 Identity Hint Processing (existing flow, new source)

When the extension `identity` params are present AND the card is served from a trusted personal-hosting domain, the registry:

1. Uses `identity.packageName` as the agent's package name (instead of URL-derived fallback)
2. Sets `isPersonalHostingHint = true`
3. At claim time, verifies the signed-in user's GitHub account matches `identity.username`

This replaces the informal `card.metadata.registryIdentityProvider/Identity/PackageName` pattern.

### 4.3 Payment Indexing

`payment` values are extracted and stored for structured filtering:

- `payment.protocols` are indexed (e.g. stored as `protocol:x402` tags or a dedicated column) enabling filter by `?payment_protocol=x402`
- `payment.rails[].network` + `payment.rails[].token` are indexed enabling filter by `?payment_rail=nano:XNO`
- `payment.rails[].type` enables filter by settlement category (`?payment_type=crypto`)
- `feeModel` and `settlementTime` are stored as metadata for display but not initially indexed as primary filter axes

---

## 5. Migration & Backward Compatibility

### v0.3 Cards with `card.metadata` (legacy)

The registry **continues to support** the legacy `metadata` pattern for identity hints indefinitely:

```json
"metadata": {
  "registryIdentityProvider": "github",
  "registryIdentity": "Joseandres1984",
  "registryPackageName": "github.Joseandres1984.my_agent"
}
```

- The scanner's `extractRegistryHintsFromCard()` will check `capabilities.extensions` first, then fall back to `card.metadata` for backward compatibility
- Agents on v0.3 format cards that cannot migrate immediately are not broken
- The registry documentation will **strongly discourage** `card.metadata` for new v1.0 cards and direct agents to the extension instead

### Priority order for identity hints

1. `capabilities.extensions[uri=registry/v1].params.identity` ← preferred for v1.0
2. `card.metadata.registryIdentityProvider/Identity/PackageName` ← legacy fallback, still supported

### v1.0 Cards

New agents publishing a v1.0 card should use the extension. The registry's `/tools/validate-url` and `/tools/validate-json` endpoints will emit specific warning codes for non-conforming cards:

| Code | Severity | Condition | Message |
|---|---|---|---|
| `DEPRECATED_REGISTRY_METADATA` | Warning | v1.0 card has `card.metadata.registryIdentityProvider` | "Legacy metadata-based identity hints are deprecated in A2A v1.0. Migrate to `capabilities.extensions` with URI `https://a2a-registry.org/extensions/registry/v1`." |
| `REGISTRY_EXT_MUST_BE_OPTIONAL` | Error | Registry extension is declared with `required: true` | "The registry extension must be declared with `required: false`. Setting it required will cause general A2A clients to reject connections." |
| `REGISTRY_EXT_IDENTITY_INVALID` | Error | `identity.packageName` does not start with `{provider}.{username}.` | "Package name must be namespaced under the declared identity: `github.{username}.*`" |
| `REGISTRY_EXT_PAYMENT_RAIL_MISSING_NETWORK` | Warning | A `rails` entry has no `network` field | "Each payment rail entry must include a `network` field." |

---

## 6. Use Case Validation

### Use Case 1 — GitHub User Claiming an Agent on Cloudflare Workers

**Scenario:** Developer `Joseandres1984` hosts `lumen-zero-a2a.lumen-b2b.workers.dev`. They want their agent registered as `github.Joseandres1984.lumen_b2b_agent`.

**Current card (v0.3, legacy `metadata` — still works):**
```json
{
  "protocolVersion": "0.3.0",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "Joseandres1984",
    "registryPackageName": "github.Joseandres1984.lumen_b2b_agent"
  }
}
```

**Recommended card (v1.0, registry extension):**
```json
{
  "protocolVersion": "1.0",
  "name": "LUMEN B2B Agent",
  "capabilities": {
    "streaming": false,
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "Joseandres1984",
            "packageName": "github.Joseandres1984.lumen_b2b_agent"
          }
        }
      }
    ]
  }
}
```

**Registry behaviour:** Identical for both — the agent is registered as `github.Joseandres1984.lumen_b2b_agent` and the owner can claim it by signing in with their linked GitHub account.

---

### Use Case 2 — Agent Declaring Payment Capability (Issue #11)

**Scenario:** The Feeless402 agent accepts payments via the Nano (XNO) rail using the x402 protocol. It wants to be discoverable by builders who specifically need feeless, sub-second, self-custodied settlement — not just any x402 agent.

**Current situation:** Searching `?search=x402` returns 100+ agents with no way to distinguish USDC/Base agents from Nano agents from Stripe agents. The protocol and rail are both invisible as structured attributes.

**Recommended card addition:**
```json
{
  "name": "Feeless402 Rail Quote",
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "required": false,
        "params": {
          "payment": {
            "direction": "inbound",
            "protocols": ["x402"],
            "rails": [
              {
                "network": "nano",
                "token": "XNO",
                "scheme": "exact",
                "type": "crypto",
                "feeModel": "feeless",
                "settlementTime": "instant",
                "verification": {
                  "mode": "exact",
                  "proof": "X-Nano-Payment",
                  "verifyUrl": "https://proxy.nano.org/rpc"
                }
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Registry behaviour:**
- `x402` is indexed as a payment protocol
- `nano:XNO` is indexed as a payment rail
- `direction: "inbound"` is indexed — allows `?payment_direction=inbound` queries
- `GET /public/agents?payment_protocol=x402&payment_rail=nano:XNO` returns only Nano x402 agents
- `GET /public/agents?payment_rail=nano:XNO` returns all Nano agents regardless of protocol
- The `verification` object (with `scheme: "exact"` and the Nano RPC endpoint) is stored in `config.payment` for client agents to retrieve — gives a paying client both halves of autonomous settlement: how to find the agent and how to confirm payment landed without a facilitator

---

### Use Case 3 — Both Together

An agent hosted on Workers AND accepting payment can declare both in a single extension block:

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "alice",
            "packageName": "github.alice.my_paid_agent"
          },
          "payment": {
            "protocols": ["x402", "ap2"],
            "rails": [
              {
                "network": "base",
                "token": "USDC",
                "type": "stablecoin",
                "feeModel": "low",
                "settlementTime": "fast"
              },
              {
                "network": "solana",
                "token": "USDC",
                "type": "stablecoin",
                "feeModel": "low",
                "settlementTime": "instant"
              }
            ]
          }
        }
      }
    ]
  }
}
```

## 7. Documentation Guidance for Agent Authors

### For new v1.0 agents

Use `capabilities.extensions` with the registry URI. Put all registry-specific metadata in `params`. The extension is `required: false` — any A2A client that doesn't know the registry extension will safely ignore it.

### For existing v0.3 agents

Your current `metadata`-based hints continue to work. When you migrate to a v1.0 card, move your `registryIdentityProvider/Identity/PackageName` values into the extension `identity` block.

### What not to do in v1.0

- ❌ `card.metadata` for registry hints — not a v1.0 field, generates validation errors in strict validators
- ❌ Top-level custom fields like `card.paymentRails` — `additionalProperties: false` in the v1.0 schema means these will generate schema errors
- ❌ Stuffing payment rail info into `skills[].tags` — tags are for skill-level capability description, not card-level payment acceptance
