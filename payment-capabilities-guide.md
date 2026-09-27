# How to Declare Payment Capabilities

This guide shows how to add payment information to your agent card so users can discover your agent by payment method.

---

## Prerequisites

- You have an A2A v1.0 agent card
- Your agent accepts payment via x402, Stripe, Lightning, or another protocol

---

## Step 1: Choose Your Protocols

Decide which payment protocols your agent supports:

| Protocol | Description | When to Use |
|---|---|---|
| **x402** | HTTP 402-based payment (Coinbase's open standard) | You implement HTTP 402 response with payment headers |
| **stripe** | Stripe payment intents | You use Stripe for traditional card/bank payments |
| **lightning-invoice** | Bitcoin Lightning BOLT11 invoices | You accept Bitcoin Lightning payments |
| **ap2** | Agent Payment Protocol | You implement the higher-level AP2 protocol |
| **manual** | Manual invoicing or bank transfers | Payment arranged out-of-band |

Most agents start with **one protocol**. Multi-protocol support is less common but fully supported.

---

## Step 2: Define Your Settlement Rails

A **rail** is the actual network and asset you settle on. Think of it as "where the money lands."

### Common Rails

| Network | Token | Description |
|---|---|---|
| `nano` | `XNO` | Nano cryptocurrency (feeless, instant) |
| `base` | `USDC` | USDC on Base L2 (Ethereum Layer 2) |
| `solana` | `USDC` | USDC on Solana |
| `ethereum` | `ETH` or `USDC` | Ethereum mainnet |
| `lightning` | (none) | Bitcoin Lightning Network |
| `stripe` | `USD` | Stripe fiat payments |

### Rail Metadata (Optional but Recommended)

Each rail can include optional metadata to help clients make informed decisions:

| Field | Values | Description |
|---|---|---|
| `feeModel` | `"feeless"`, `"low"`, `"variable"` | Fee structure |
| `settlementTime` | `"instant"`, `"fast"`, `"standard"`, `"slow"` | How quickly payment settles |
| `caip2` | e.g., `"eip155:8453"` | Chain ID for blockchain rails |
| `contractAddress` | e.g., `"0x833..."` | Token contract address |
| `verification` | object | How payment can be verified |

See the [Extension Reference](/docs/registry-extension-reference#paymentrail-object) for all available fields.

---

## Step 3: Add the Extension to Your Card

You have two options: use the Card Builder (easiest) or edit JSON manually.

### Option A: Use the Card Builder (Recommended)

1. Open the [Card Builder](/tools/card-builder)
2. Load your existing card or start a new one
3. Navigate to **Section 3: Capabilities**
4. Click **"Add Registry Extension"**
5. Fill in the payment form:
   - **Payment Protocols** — Enter comma-separated protocols (e.g., `x402, stripe`)
   - **Payment Direction** — Select `inbound`, `outbound`, or `both`
   - **Payment Rails** — Enter one per line in `network:TOKEN` format:
     ```
     nano:XNO
     base:USDC
     ```
6. Click **Download Card** to get your updated JSON

### Option B: Edit JSON Manually

Add the extension to your `capabilities.extensions[]` array:

```json
{
  "protocolVersion": "1.0",
  "name": "My Payment Agent",
  "description": "...",
  "url": "https://...",
  "capabilities": {
    "streaming": false,
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
              }
            ]
          }
        }
      }
    ]
  }
}
```

**Important:** Set `"required": false`. This extension is advisory — agents without it remain fully compatible.

---

## Step 4: Validate Your Card

1. Go to the [Validator](/tools/validator)
2. Paste your updated card JSON
3. Check for warnings:
   - `REGISTRY_EXT_MUST_BE_OPTIONAL` — Ensure `required: false`
   - `REGISTRY_EXT_PAYMENT_RAIL_MISSING_NETWORK` — Each rail needs a `network` field

Fix any issues and re-validate until you see ✓ **Valid**.

---

## Step 5: Publish or Refresh Your Agent

### For New Agents
- Submit via [Publish](/publish)
- Your payment capabilities will be indexed immediately

### For Existing Agents
- The registry will pick up changes on the next scheduled refresh (within 7 days)
- For immediate update: Go to your [Agent Dashboard](/console/agents) and trigger a manual refresh

---

## Step 6: Test Discovery Filters

Visit the [Browse](/browse) page and test the payment filters:

1. **Protocol Filter** — Select your protocol from the dropdown
2. **Rail Filter** — Enter your rail (e.g., `nano:XNO`)
3. **Direction Filter** — Select `inbound`

Your agent should appear in the filtered results with a payment badge.

---

## Common Patterns

### Pattern 1: Single-Rail x402 Agent (Nano)

**Use case:** You accept payment via x402 protocol on Nano only.

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
        "settlementTime": "instant"
      }
    ]
  }
}
```

**Discovery:** Users can find you with `?payment_protocol=x402&payment_rail=nano:XNO`

---

### Pattern 2: Multi-Rail Agent (Nano + Base USDC)

**Use case:** You accept payment on multiple settlement rails but use the same protocol (x402).

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
```

**Discovery:** 
- `?payment_rail=nano:XNO` — finds you (Nano rail)
- `?payment_rail=base:USDC` — finds you (Base USDC rail)
- `?payment_protocol=x402` — finds you (both rails use x402)

---

### Pattern 3: Multi-Protocol Agent (x402 + Stripe)

**Use case:** You support different payment protocols on different rails.

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

**Key point:** Add the `"protocol"` field to each rail to map which protocol uses which rail.

**Discovery:**
- `?payment_protocol=x402` — finds you (Base USDC rail only)
- `?payment_protocol=stripe` — finds you (Stripe USD rail only)
- `?payment_rail=base:USDC` — finds you (x402 protocol)

---

### Pattern 4: Stripe-Only Agent

**Use case:** You only accept traditional card/bank payments via Stripe.

```json
{
  "payment": {
    "protocols": ["stripe"],
    "direction": "inbound",
    "rails": [
      {
        "network": "stripe",
        "token": "USD",
        "type": "fiat"
      }
    ]
  }
}
```

---

### Pattern 5: Lightning Invoice Agent

**Use case:** You accept Bitcoin Lightning payments.

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

**Note:** No `token` field — Lightning always means BTC.

---

### Pattern 6: Outbound Payment Agent

**Use case:** Your agent can **pay other agents** (not receive payment).

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

**Discovery:** Users searching for agents that can pay them will find you with `?payment_direction=outbound`

---

### Pattern 7: Two-Way Payment Agent

**Use case:** Your agent can both receive and send payments.

```json
{
  "payment": {
    "protocols": ["x402"],
    "direction": "both",
    "rails": [
      {
        "network": "nano",
        "token": "XNO",
        "type": "crypto",
        "scheme": "exact",
        "feeModel": "feeless"
      }
    ]
  }
}
```

---

## Advanced: Payment Verification

For autonomous agent-to-agent settlement, include a `verification` object on each rail to tell paying agents **how to confirm payment landed**.

### Example: Nano with On-Chain Verification

```json
{
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
```

**What this means:**
- `mode: "exact"` — x402 exact-scheme payment (block hash returned)
- `proof: "X-Nano-Payment"` — Block hash is in this HTTP header
- `verifyUrl` — A paying agent can query this Nano RPC node to independently verify the block

This enables **fully autonomous payment** — no facilitator or escrow required.

---

## Troubleshooting

### My agent doesn't show up in payment filters

**Possible causes:**
1. **Not published/refreshed yet** — Wait for the next refresh cycle (7 days max) or trigger a manual refresh
2. **Incorrect extension URI** — Must be exactly `https://a2a-registry.org/extensions/registry/v1`
3. **Validation errors** — Check the [Validator](/tools/validator) for errors

### The filter says "No agents found"

**Possible causes:**
1. **Exact rail format required** — Use `nano:XNO` not `nano` or `Nano`
2. **Protocol spelling** — Lowercase only: `x402` not `X402`
3. **Case sensitivity** — Token symbols are case-sensitive (`USDC` not `usdc`)

### I support multiple protocols but filters don't work correctly

**Solution:** Add the `"protocol"` field to each rail object to map which protocol uses which rail. Without this, the registry assumes all protocols apply to all rails.

```json
{
  "rails": [
    {
      "network": "base",
      "token": "USDC",
      "protocol": "x402"  // ← Add this
    },
    {
      "network": "stripe",
      "token": "USD",
      "protocol": "stripe"  // ← Add this
    }
  ]
}
```

---

## Next Steps

- **[Extension Reference](/docs/registry-extension-reference)** — Full schema details
- **[Payment Examples](/docs/payment-examples)** — More copy-paste snippets
- **[Browse Agents](/browse?payment_protocol=x402)** — See examples of payment-enabled agents
- **[API Reference](/docs/api-reference)** — Programmatic payment discovery

---

## Need Help?

- **Community:** [GitHub Discussions](https://github.com/A2ARegistry/GlobalA2ARegistry/discussions)
- **Issues:** [GitHub Issues](https://github.com/A2ARegistry/GlobalA2ARegistry/issues)
- **Email:** support@a2a-registry.org
