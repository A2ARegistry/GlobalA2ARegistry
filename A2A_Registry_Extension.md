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
- `packageName` must start with `github.{username}.` or `github.{username}/` (case-insensitive) — prevents namespace hijacking
- At **claim time**, the signed-in user's linked GitHub account must match `username` — verified by `resolveClaimIdentity()` in `src/utils/registry-meta.ts`
- Only honoured when the agent card is served from a trusted personal-hosting domain (`*.workers.dev`, `*.github.io`) — see `PERSONAL_HOSTING_DOMAINS` in `src/utils/registry-meta.ts`

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

#### `protocols` values

| Value | Description |
|---|---|
| `x402` | HTTP 402-based payment protocol (Coinbase open standard). Client retries request with signed payment header. |
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
| `type` | string | No | Settlement category: `"crypto"`, `"fiat"`, or `"stablecoin"`. Helps filter by settlement type without parsing network/token. |
| `feeModel` | string | No | Fee model hint: `"feeless"`, `"low"`, `"variable"`. Informational — not validated by registry. |
| `settlementTime` | string | No | Approximate settlement time hint: `"instant"` (<2s), `"fast"` (<60s), `"standard"` (minutes-hours), `"slow"` (hours-days). Informational. |

**Example — Nano-only agent using x402:**
```json
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
```

**Example — Multi-rail agent (x402 + AP2, accepts USDC on Base or Solana):**
```json
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

New agents publishing a v1.0 card should use the extension. The registry's `/tools/validate-url` and `/tools/validate-json` endpoints will warn (not error) if a v1.0 card uses `card.metadata` for registry hints, and suggest migrating to the extension.

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
  }
}
```

**Registry behaviour:**
- `x402` is indexed as a payment protocol on the agent
- `nano:XNO` is indexed as a payment rail
- `GET /public/agents?payment_protocol=x402&payment_rail=nano:XNO` returns only Nano-settling x402 agents
- `GET /public/agents?payment_rail=nano:XNO` returns all Nano agents regardless of protocol
- A builder searching for "feeless, sub-second settlement" can filter directly — no more mixed full-text results

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
