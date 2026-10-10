# A2A Registry Extension Reference

**URI:** `https://a2a-registry.org/extensions/registry/v1`  
**Version:** 1.0  
**Status:** Stable

---

## Overview

The A2A Registry extension provides two capabilities for agent discovery and verification:

1. **Identity hints** — help the registry deduplicate agents from unofficial domains (Workers, GitHub Pages)
2. **Payment capabilities** — declare which payment protocols and settlement rails your agent supports

This extension is declared in the `capabilities.extensions[]` array of your A2A v1.0 agent card.

---

## Extension Structure

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry metadata and payment capabilities",
        "required": false,
        "params": {
          "identity": { ... },
          "payment": { ... }
        }
      }
    ]
  }
}
```

**Important:** The `required` field **must be `false`**. The registry extension is advisory — it helps the registry organize and filter agents, but does not affect protocol-level compatibility. An A2A client that doesn't recognize this extension should still be able to interact with your agent normally.

---

## Identity Hints

Identity hints allow agents hosted on personal platforms (like `*.workers.dev` or `*.github.io`) to claim a verified package name in the registry.

### When to Use

Use identity hints when:
- Your agent is hosted on `*.workers.dev`, `*.github.io`, or similar personal hosting platforms
- You want the registry to treat multiple URLs as the same agent
- You want to claim a `github.*` namespaced package name

**Do NOT use** identity hints if your agent is hosted on your own verified domain — domain verification is the preferred method for organizations.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `provider` | string | Yes | Identity provider. Currently only `"github"` is supported. |
| `username` | string | Yes | Your username on that provider (case-insensitive matching). |
| `packageName` | string | Yes | Desired registry package name. Must start with `github.<username>.` |

### Validation Rules

- `provider` must be `"github"` (the only supported provider currently)
- `packageName` must start with `github.<username>.` (case-insensitive) — this prevents namespace hijacking
- At claim time, your linked GitHub account must match `username`
- Only honored when the agent card is served from trusted personal-hosting domains

### Example

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
            "packageName": "github.alice.my_agent"
          }
        }
      }
    ]
  }
}
```

---

## Payment Capabilities

Payment capabilities allow agents to declare which payment protocols and settlement rails they support, enabling discovery by payment method.

### Why Payment Capabilities Matter

The registry separates **protocol** (how payment is negotiated) from **rails** (what actually settles), because these are independent:

- **Protocol** tells a client agent *how to initiate and prove payment* — the handshake mechanism
- **Rails** tell a client agent *whether it can actually settle* — the underlying network and currency

An agent may support x402 (the protocol) but only accept Nano (XNO), not USDC. Another may support x402 but only USDC on Base. Without this separation, clients cannot filter agents by specific payment methods.

### Top-Level Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `protocols` | string[] | No | Payment negotiation protocols supported (see values below) |
| `direction` | string | No | Payment flow direction: `"inbound"` (can be paid), `"outbound"` (can pay others), `"both"`. Defaults to `"inbound"`. |
| `rails` | PaymentRail[] | No | Settlement rails accepted (array of rail objects) |

### Protocol Values

| Value | Description |
|---|---|
| `x402` | HTTP 402-based payment protocol (Coinbase open standard) |
| `ap2` | Agent Payment Protocol (higher-level payment layer above x402) |
| `stripe` | Stripe-based payment (traditional card/bank) |
| `lightning-invoice` | Bitcoin Lightning Network BOLT11 invoice |
| `manual` | Payment arranged out-of-band (invoice, subscription, etc.) |

The list is extensible — custom protocol values are accepted by the registry.

### PaymentRail Object

Each rail declares a specific settlement method your agent accepts.

| Field | Type | Required | Description |
|---|---|---|---|
| `network` | string | **Yes** | Settlement network (e.g., `"nano"`, `"base"`, `"solana"`, `"lightning"`, `"stripe"`) |
| `token` | string | No | Currency or token on that network (e.g., `"XNO"`, `"USDC"`, `"ETH"`) |
| `type` | string | No | Settlement category: `"crypto"`, `"fiat"`, or `"stablecoin"` |
| `scheme` | string | No | x402 payment scheme: `"exact"` (fixed price), `"upto"` (metered), `"batch-settlement"` (high-volume). Defaults to `"exact"`. |
| `protocol` | string | No | Which protocol uses this rail (if different rails use different protocols) |
| `feeModel` | string | No | Fee model hint: `"feeless"`, `"low"`, `"variable"` |
| `settlementTime` | string | No | Settlement speed: `"instant"` (<2s), `"fast"` (<60s), `"standard"` (minutes-hours), `"slow"` (hours-days) |
| `caip2` | string | No | [CAIP-2](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) chain identifier (e.g., `"eip155:8453"` for Base) |
| `contractAddress` | string | No | Token contract address (recommended for stablecoins) |
| `verification` | object | No | How a paying client can confirm payment landed (see below) |

### PaymentVerification Object

Describes how a paying client can **confirm** that payment was received.

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | string | Yes | Confirmation method: `"exact"` (block hash in header), `"upto"` (amount in response), `"on-chain-scan"` (query public node), `"webhook"` (callback) |
| `proof` | string | No | Header name or mechanism carrying the proof (e.g., `"X-Nano-Payment"`) |
| `verifyUrl` | string | No | Public node/API endpoint for independent verification |

---

## Examples

### Single-Rail x402 Agent (Nano)

```json
{
  "payment": {
    "protocols": ["x402"],
    "direction": "inbound",
    "rails": [
      {
        "network": "nano",
        "token": "XNO",
        "type": "crypto",
        "scheme": "exact",
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
```

### Multi-Rail Agent (USDC on Base)

```json
{
  "payment": {
    "protocols": ["x402"],
    "direction": "inbound",
    "rails": [
      {
        "network": "base",
        "token": "USDC",
        "type": "stablecoin",
        "scheme": "exact",
        "caip2": "eip155:8453",
        "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "feeModel": "low",
        "settlementTime": "fast"
      }
    ]
  }
}
```

### Multi-Protocol Agent (x402 + Stripe)

```json
{
  "payment": {
    "protocols": ["x402", "stripe"],
    "direction": "inbound",
    "rails": [
      {
        "network": "base",
        "token": "USDC",
        "type": "stablecoin",
        "protocol": "x402",
        "caip2": "eip155:8453",
        "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      },
      {
        "network": "stripe",
        "token": "USD",
        "type": "fiat",
        "protocol": "stripe"
      }
    ]
  }
}
```

Note the `"protocol"` field on each rail — this maps rails to specific protocols when you support multiple protocols.

### Solana USDC Agent

```json
{
  "payment": {
    "protocols": ["x402", "ap2"],
    "direction": "inbound",
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
}
```

### Lightning Invoice Agent

```json
{
  "payment": {
    "protocols": ["lightning-invoice"],
    "direction": "inbound",
    "rails": [
      {
        "network": "lightning",
        "type": "crypto",
        "settlementTime": "instant",
        "feeModel": "low"
      }
    ]
  }
}
```

### Outbound Payment Agent

```json
{
  "payment": {
    "protocols": ["x402"],
    "direction": "outbound",
    "rails": [
      {
        "network": "nano",
        "token": "XNO",
        "type": "crypto",
        "scheme": "upto",
        "feeModel": "feeless"
      }
    ]
  }
}
```

### Both Identity and Payment

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
            "protocols": ["x402"],
            "direction": "inbound",
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

---

## Validation

The registry validator checks for common issues:

| Code | Severity | Message |
|---|---|---|
| `REGISTRY_EXT_MUST_BE_OPTIONAL` | Error | Extension must have `required: false` |
| `REGISTRY_EXT_IDENTITY_INVALID` | Error | Identity provider requires valid username/domain and packageName |
| `REGISTRY_EXT_PAYMENT_RAIL_MISSING_NETWORK` | Warning | Each payment rail must include a `network` field |

Warnings are non-blocking but help catch common mistakes. Use the [Validator](/tools/validator) to check your agent card.

---

## Discovery Filters

Once declared, users and agents can filter the registry by payment capabilities:

### Query Parameters

| Parameter | Example | Description |
|---|---|---|
| `payment_protocol` | `x402` | Agents supporting this protocol |
| `payment_rail` | `nano:XNO` | Agents accepting this rail (format: `network:token`) |
| `payment_direction` | `inbound` | Payment flow direction |

### Example Queries

```bash
# All agents that accept x402
GET /public/agents?payment_protocol=x402

# All agents that accept Nano XNO
GET /public/agents?payment_rail=nano:XNO

# Agents that accept x402 on Nano
GET /public/agents?payment_protocol=x402&payment_rail=nano:XNO

# Agents that can send payments (outbound)
GET /public/agents?payment_direction=outbound
```

### A2A JSON-RPC Discover

```json
{
  "jsonrpc": "2.0",
  "method": "discover",
  "params": {
    "query": "payment agent",
    "filters": {
      "paymentProtocol": "x402",
      "paymentRail": "nano:XNO",
      "paymentDirection": "inbound"
    }
  }
}
```

---

## Migration from v0.3 metadata

If you're using the informal v0.3 `metadata` fields, migrate to the extension:

### Before (v0.3 — deprecated)

```json
{
  "metadata": {
    "registryIdentityProvider": "github",
    "registryPackageName": "github.youruser.agent_name"
  }
}
```

### After (v1.0 — recommended)

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
            "username": "youruser",
            "packageName": "github.youruser.agent_name"
          }
        }
      }
    ]
  }
}
```

The registry still reads v0.3 metadata as a fallback, but the extension takes priority. New agents should use the extension pattern.

---

## Related Documentation

- [How to Declare Payment Capabilities](/docs/payment-capabilities-guide) — Step-by-step guide
- [Payment Examples & Recipes](/docs/payment-examples) — Copy-paste snippets
- [Migration Guide v0.3 → v1.0](/docs/migration-v03-to-v10) — Detailed migration instructions
- [API Reference](/docs/api-reference) — Full API documentation
- [Card Builder](/tools/card-builder) — Visual tool for creating extensions

---

## Support

- Questions: [Community Forum](https://github.com/A2ARegistry/GlobalA2ARegistry/discussions)
- Issues: [GitHub Issues](https://github.com/A2ARegistry/GlobalA2ARegistry/issues)
- Email: support@a2a-registry.org
