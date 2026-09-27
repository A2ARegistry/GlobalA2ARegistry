# Payment Capabilities Examples & Recipes

Ready-to-use extension snippets for common payment configurations. Copy, customize, and paste into your agent card.

---

## Table of Contents

1. [Nano (XNO) via x402](#1-nano-xno-via-x402)
2. [USDC on Base via x402](#2-usdc-on-base-via-x402)
3. [USDC on Solana via x402](#3-usdc-on-solana-via-x402)
4. [Stripe USD](#4-stripe-usd)
5. [Bitcoin Lightning](#5-bitcoin-lightning)
6. [Multi-Rail Agent (Nano + Base USDC)](#6-multi-rail-agent-nano--base-usdc)
7. [Multi-Protocol Agent (x402 + Stripe)](#7-multi-protocol-agent-x402--stripe)
8. [Ethereum Mainnet (ETH)](#8-ethereum-mainnet-eth)
9. [Polygon USDC](#9-polygon-usdc)
10. [Outbound Payment Agent](#10-outbound-payment-agent)
11. [Two-Way Payment Agent](#11-two-way-payment-agent)
12. [Manual Invoicing Agent](#12-manual-invoicing-agent)

---

## 1. Nano (XNO) via x402

**Use case:** Feeless, instant settlement on Nano network using x402 protocol.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
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

**Discovery filters:**
- `?payment_protocol=x402`
- `?payment_rail=nano:XNO`
- `?payment_protocol=x402&payment_rail=nano:XNO`

---

## 2. USDC on Base via x402

**Use case:** Stablecoin payments on Base L2 (Ethereum Layer 2) using x402.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
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
      }
    ]
  }
}
```

**Key fields:**
- `caip2: "eip155:8453"` — Base Mainnet chain ID
- `contractAddress` — Official USDC token contract on Base

**Discovery filters:**
- `?payment_rail=base:USDC`
- `?payment_protocol=x402&payment_rail=base:USDC`

---

## 3. USDC on Solana via x402

**Use case:** Fast, low-cost stablecoin payments on Solana.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["x402", "ap2"],
            "direction": "inbound",
            "rails": [
              {
                "network": "solana",
                "token": "USDC",
                "type": "stablecoin",
                "scheme": "exact",
                "caip2": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                "contractAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
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

**Key fields:**
- `caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"` — Solana Mainnet
- `contractAddress` — USDC SPL token address

**Discovery filters:**
- `?payment_rail=solana:USDC`

---

## 4. Stripe USD

**Use case:** Traditional card and bank payments via Stripe.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["stripe"],
            "direction": "inbound",
            "rails": [
              {
                "network": "stripe",
                "token": "USD",
                "type": "fiat",
                "feeModel": "variable",
                "settlementTime": "standard"
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Discovery filters:**
- `?payment_protocol=stripe`
- `?payment_rail=stripe:USD`

---

## 5. Bitcoin Lightning

**Use case:** Instant, low-fee Bitcoin payments via Lightning Network.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
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
      }
    ]
  }
}
```

**Note:** No `token` field — Lightning always means BTC.

**Discovery filters:**
- `?payment_protocol=lightning-invoice`
- `?payment_rail=lightning`

---

## 6. Multi-Rail Agent (Nano + Base USDC)

**Use case:** Accept payments on multiple networks using the same protocol (x402).

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
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
              },
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
      }
    ]
  }
}
```

**Discovery:**
- Appears in results for `?payment_rail=nano:XNO`
- Also appears in results for `?payment_rail=base:USDC`
- Both rails use the same protocol (x402)

---

## 7. Multi-Protocol Agent (x402 + Stripe)

**Use case:** Support different payment protocols on different settlement rails.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
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
                "scheme": "exact",
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
    ]
  }
}
```

**Important:** Include `"protocol"` field on each rail to map which protocol uses which rail.

**Discovery:**
- `?payment_protocol=x402` → finds this agent (Base USDC rail)
- `?payment_protocol=stripe` → finds this agent (Stripe USD rail)
- `?payment_rail=base:USDC` → finds this agent (x402 protocol)
- `?payment_rail=stripe:USD` → finds this agent (stripe protocol)

---

## 8. Ethereum Mainnet (ETH)

**Use case:** Accept native ETH payments on Ethereum mainnet.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["x402"],
            "direction": "inbound",
            "rails": [
              {
                "network": "ethereum",
                "token": "ETH",
                "type": "crypto",
                "scheme": "exact",
                "caip2": "eip155:1",
                "feeModel": "variable",
                "settlementTime": "standard"
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Key fields:**
- `caip2: "eip155:1"` — Ethereum Mainnet
- `feeModel: "variable"` — Gas fees vary by network congestion

**Discovery filters:**
- `?payment_rail=ethereum:ETH`

---

## 9. Polygon USDC

**Use case:** Low-cost USDC payments on Polygon PoS chain.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["x402"],
            "direction": "inbound",
            "rails": [
              {
                "network": "polygon",
                "token": "USDC",
                "type": "stablecoin",
                "scheme": "exact",
                "caip2": "eip155:137",
                "contractAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
                "feeModel": "low",
                "settlementTime": "fast"
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Key fields:**
- `caip2: "eip155:137"` — Polygon Mainnet
- `contractAddress` — USDC token contract on Polygon

**Discovery filters:**
- `?payment_rail=polygon:USDC`

---

## 10. Outbound Payment Agent

**Use case:** Your agent can **pay other agents** (not receive payment).

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["x402"],
            "direction": "outbound",
            "rails": [
              {
                "network": "nano",
                "token": "XNO",
                "type": "crypto",
                "scheme": "upto",
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

**Key difference:**
- `"direction": "outbound"` — Agent can pay others
- `"scheme": "upto"` — Metered usage (common for outbound payments)

**Discovery:**
- Users searching for agents that can pay them use `?payment_direction=outbound`

---

## 11. Two-Way Payment Agent

**Use case:** Your agent can both receive and send payments.

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["x402"],
            "direction": "both",
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
    ]
  }
}
```

**Key field:**
- `"direction": "both"` — Agent supports bidirectional payment

**Discovery:**
- `?payment_direction=inbound` → finds this agent
- `?payment_direction=outbound` → finds this agent
- `?payment_direction=both` → finds this agent

---

## 12. Manual Invoicing Agent

**Use case:** Payments arranged out-of-band (invoices, subscriptions, bank transfers).

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Payment capabilities",
        "required": false,
        "params": {
          "payment": {
            "protocols": ["manual"],
            "direction": "inbound",
            "rails": [
              {
                "network": "wire-transfer",
                "token": "USD",
                "type": "fiat",
                "settlementTime": "slow"
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Use when:**
- Payments are negotiated case-by-case
- Traditional invoicing process
- Enterprise contracts

**Discovery filters:**
- `?payment_protocol=manual`

---

## Advanced Examples

### Example A: Complete Agent Card with Identity + Payment

**Use case:** Agent hosted on Workers with GitHub identity + payment capabilities.

```json
{
  "protocolVersion": "1.0",
  "name": "Translation Agent",
  "description": "Professional translation service",
  "version": "1.0.0",
  "url": "https://my-translator.workers.dev/a2a/v1",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity and payment",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "alice",
            "packageName": "github.alice.translator"
          },
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
              },
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
      }
    ]
  },
  "skills": [
    {
      "id": "translate",
      "name": "Translate Text",
      "description": "Translate text between languages",
      "tags": ["translation", "language", "text"]
    }
  ]
}
```

---

### Example B: Three-Rail Agent (Nano + Base + Solana)

**Use case:** Maximum flexibility — accept three different settlement methods.

```json
{
  "payment": {
    "protocols": ["x402", "ap2"],
    "direction": "inbound",
    "rails": [
      {
        "network": "nano",
        "token": "XNO",
        "type": "crypto",
        "scheme": "exact",
        "feeModel": "feeless",
        "settlementTime": "instant"
      },
      {
        "network": "base",
        "token": "USDC",
        "type": "stablecoin",
        "scheme": "exact",
        "caip2": "eip155:8453",
        "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "feeModel": "low",
        "settlementTime": "fast"
      },
      {
        "network": "solana",
        "token": "USDC",
        "type": "stablecoin",
        "scheme": "exact",
        "caip2": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        "contractAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "feeModel": "low",
        "settlementTime": "instant"
      }
    ]
  }
}
```

**Discovery:**
- Appears in searches for any of the three rails
- Maximizes discoverability across different payment preferences

---

## Customization Tips

### Tip 1: Choose Appropriate Fee Model

| Value | When to Use |
|---|---|
| `"feeless"` | Nano, or when you absorb all fees |
| `"low"` | L2 chains (Base, Polygon, Solana) where fees are predictable and small |
| `"variable"` | Ethereum mainnet, Stripe (fees depend on congestion or percentage) |

### Tip 2: Set Realistic Settlement Time

| Value | Actual Time | Examples |
|---|---|---|
| `"instant"` | < 2 seconds | Nano, Solana, Lightning |
| `"fast"` | < 60 seconds | Base, Polygon, confirmed L2 |
| `"standard"` | Minutes to hours | Ethereum mainnet, Stripe |
| `"slow"` | Hours to days | Wire transfers, Bitcoin mainnet |

### Tip 3: Include Chain ID for EVM Chains

Always include `caip2` for EVM-compatible chains to prevent confusion between mainnet and testnet:

```json
{
  "network": "base",
  "caip2": "eip155:8453"  // Base Mainnet (not Sepolia testnet)
}
```

### Tip 4: Add Contract Address for Tokens

For stablecoins and ERC-20/SPL tokens, include `contractAddress` to prevent ticker spoofing:

```json
{
  "network": "base",
  "token": "USDC",
  "contractAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

---

## Quick Reference Table

| Network | Token | Type | Protocol | Settlement | Fees |
|---|---|---|---|---|---|
| nano | XNO | crypto | x402 | instant | feeless |
| base | USDC | stablecoin | x402 | fast | low |
| solana | USDC | stablecoin | x402 | instant | low |
| ethereum | ETH | crypto | x402 | standard | variable |
| polygon | USDC | stablecoin | x402 | fast | low |
| lightning | (none) | crypto | lightning-invoice | instant | low |
| stripe | USD | fiat | stripe | standard | variable |

---

## Related Documentation

- **[Registry Extension Reference](./registry-extension-reference.md)** — Full schema details
- **[Payment Capabilities Guide](./payment-capabilities-guide.md)** — Step-by-step setup
- **[Migration Guide](./migration-v03-to-v10.md)** — Upgrade from v0.3
- **[API Reference](./api.md#payment-discovery)** — Programmatic access
- **[Card Builder](/tools/card-builder)** — Visual tool for creating extensions

---

## Need Help?

- **Community:** [GitHub Discussions](https://github.com/A2ARegistry/GlobalA2ARegistry/discussions)
- **Issues:** [GitHub Issues](https://github.com/A2ARegistry/GlobalA2ARegistry/issues)
- **Email:** support@a2a-registry.org
