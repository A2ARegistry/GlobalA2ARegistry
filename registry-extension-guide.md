# A2A Registry Extension Guide

**Extension URI:** `https://a2a-registry.org/extensions/registry/v1`  
**Version:** 1.0  
**Status:** Stable

## Overview

The A2A Registry Extension adds two powerful features to your agent card:

1. **Identity Hints** — Help the registry recognize your agent across different hosting platforms (Workers, GitHub Pages)
2. **Payment Capabilities** — Let users discover your agent by payment methods (protocols, networks, currencies)

## When to Use This Extension

### Identity Hints
Use identity hints if your agent is hosted on:
- `*.workers.dev` (Cloudflare Workers)
- `*.github.io` (GitHub Pages)

Without identity hints, the registry treats each URL as a separate agent. With hints, it can deduplicate and give you a clean package name like `github.yourname.myagent`.

### Payment Capabilities
Use payment capabilities if your agent:
- Accepts payment via x402, Stripe, Lightning, or other protocols
- Wants to be discovered through payment filters on the browse page
- Supports specific settlement rails (Nano, USDC, Solana, etc.)

## Quick Start

### Adding Identity Hints

**Using Card Builder (Recommended)**
1. Go to the [Card Builder](/tools/card-builder)
2. Click "Add Registry Extension"
3. Enable "Identity Hints"
4. Fill in:
   - Provider: `github`
   - Username: your GitHub username
   - Package Name: must start with `github.yourusername.`
5. Download or copy the updated agent card

**Manual JSON**
```json
{
  "protocolVersion": "1.0.0",
  "name": "My Agent",
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity hints",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "youruser",
            "packageName": "github.youruser.my_agent"
          }
        }
      }
    ]
  }
}
```

### Adding Payment Capabilities

**Using Card Builder (Recommended)**
1. Go to the [Card Builder](/tools/card-builder)
2. Click "Add Registry Extension"
3. Enable "Payment Capabilities"
4. Select protocols (e.g., x402, Stripe)
5. Add settlement rails:
   - Network (e.g., nano, base, stripe)
   - Token (e.g., XNO, USDC, USD)
   - Type (crypto, stablecoin, fiat)
6. Set payment direction (inbound, outbound, both)
7. Download or copy the updated agent card

**Manual JSON Example: Single Rail (Nano)**
```json
{
  "params": {
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
          "settlementTime": "instant"
        }
      ]
    }
  }
}
```

**Manual JSON Example: Multi-Rail (USDC + Stripe)**
```json
{
  "params": {
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
          "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "feeModel": "low",
          "settlementTime": "fast"
        },
        {
          "network": "stripe",
          "token": "USD",
          "type": "fiat",
          "protocol": "stripe",
          "feeModel": "variable",
          "settlementTime": "standard"
        }
      ]
    }
  }
}
```

## Validation

After adding the extension, validate your agent card:

1. **Card Builder Validator**
   - Paste your agent card JSON
   - Check for any validation errors
   - Fix issues before publishing

2. **Manual Validation**
   - Use the [JSON Schema](/extensions/registry/v1/schema.json)
   - Check that `required` is set to `false`
   - Ensure `packageName` starts with `{provider}.{username}.`

## Discovery on Browse Page

Once published with payment capabilities, users can find your agent using:

- **Payment Protocol** dropdown (x402, Stripe, Lightning, etc.)
- **Payment Rail** search (network/token format like `nano/XNO`, `base/USDC`)
- **Payment Direction** filter (inbound, outbound, both)

Agents with payment capabilities show a blue payment badge on their card.

## Common Patterns

### Identity Only
For agents that want clean package names but don't handle payments:
```json
{
  "params": {
    "identity": {
      "provider": "github",
      "username": "alice",
      "packageName": "github.alice.translator"
    }
  }
}
```

### Payment Only
For domain-verified agents that want payment discovery:
```json
{
  "params": {
    "payment": {
      "protocols": ["x402"],
      "direction": "inbound",
      "rails": [
        {
          "network": "nano",
          "token": "XNO",
          "type": "crypto"
        }
      ]
    }
  }
}
```

### Both Identity + Payment
For Workers/Pages agents that want both features:
```json
{
  "params": {
    "identity": {
      "provider": "github",
      "username": "bob",
      "packageName": "github.bob.paywall_agent"
    },
    "payment": {
      "protocols": ["x402", "stripe"],
      "direction": "inbound",
      "rails": [
        {
          "network": "base",
          "token": "USDC",
          "type": "stablecoin",
          "protocol": "x402"
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
}
```

## Migrating from v0.3

If your agent card uses the old `metadata` fields:
- `registryIdentityProvider` → `identity.provider`
- `registryIdentity` → `identity.username`
- `registryPackageName` → `identity.packageName`

See the [Migration Guide](/docs/migration-v03-to-v10) for step-by-step instructions.

## Technical Reference

For the complete technical specification including all optional fields, validation rules, and JSON Schema:
- **Human-readable:** [Extension Reference](/extensions/registry/v1)
- **Machine-readable:** [JSON Schema](/extensions/registry/v1/schema.json)

## Support

- **Card Builder:** [/tools/card-builder](/tools/card-builder) — Interactive UI for adding the extension
- **API Reference:** [/docs/api](/docs/api) — Payment filter parameters for semantic discovery
- **How-To Guides:** [/docs/how-tos](/docs/how-tos) — Common tasks and troubleshooting
- **Examples:** [/docs/payment-examples](/docs/payment-examples) — Real-world agent card examples
