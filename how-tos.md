# A2A Registry How-To Guides

## For Developers

### How to Register an Agent

There are two flows depending on whether you are a personal developer or an organisation with a verified domain.

---

#### Option A — Personal Developer (no domain required)

Connect your GitHub account and claim ownership via your GitHub identity. Two hosting sub-options:

**A1 — GitHub Repository (simplest)**

Your agent card lives directly in the repo.

1. Add an `agent-card.json` (or `/.well-known/agent-card.json`) to your repo root.
2. Sign in and [connect your GitHub account](https://www.a2a-registry.org/console/settings).
3. Go to [Submit Agent](https://www.a2a-registry.org/submit) and paste your GitHub repo URL:
   ```
   https://github.com/your-username/your-repo
   ```
4. The registry verifies ownership via your linked GitHub account and claims the agent
   under the package name `github.your-username/your-repo`.

---

**A2 — Personal Hosting (GitHub Pages, Cloudflare Workers, etc.)**

You add special meta into your Agent Card and publish it on your GitHub Pages or Cloudflare Workers.

Use this when your agent runs on a shared platform like `*.github.io` or `*.workers.dev`
where you cannot verify the apex domain.

**Step 1 — Add registry identity hints to your agent card's `metadata`:**

```json
{
  "protocolVersion": "1.0",
  "name": "My Agent",
  "url": "https://my-agent.example.workers.dev/a2a/v1",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "your-github-username",
    "registryPackageName": "github.your-github-username.your-agent-name"
  }
}
```

| Field | Value |
|---|---|
| `registryIdentityProvider` | Always `"github"` for now |
| `registryIdentity` | Your exact GitHub username (case-insensitive match) |
| `registryPackageName` | Must start with `github.{registryIdentity}.` |

> **Why is this safe?** Only you can deploy content to your `*.workers.dev` or `*.github.io`
> subdomain. The registry trusts these fields only from those personal-hosting domains —
> not from arbitrary websites.
> 
> **Why `metadata` and not a root-level field like `package_name` etc.?**
>
> The A2A v1.0 specification defines a strict schema for the agent card root object
> (`protocolVersion`, `name`, `description`, `url`, `capabilities`, `skills`, etc.).
> Adding non-standard fields at the root level makes your card **non-compliant** with v1.0
> and can cause validation failures in other A2A-compatible tools and registries.
>
> The `metadata` object is the spec-sanctioned extension point for arbitrary key-value data.
> Fields placed there are ignored by tools that don't understand them, keeping your card
> fully interoperable. The A2A Registry treats all keys prefixed with `registry` inside
> `metadata` as reserved for registry-specific behaviour.
>
> **Reserved namespace:** Any `metadata` key that starts with `registry` (e.g. `registryIdentity`,
> `registryPackageName`, `registryIdentityProvider`, `registryVerified`, …) is considered
> reserved by the A2A Global Registry. Future registry features may introduce additional
> `registry*` keys. Third-party tools are free to read these fields, but should not write
> their own keys using this prefix to avoid conflicts.

**Step 2 — Connect your GitHub account:**

In [Account Settings](https://www.a2a-registry.org/console/settings), connect your GitHub account.

**Step 3 — Submit and claim:**

Go to [Submit Agent](https://www.a2a-registry.org/submit), paste your agent's URL, and submit.
The registry will:
- Detect that the URL is on a trusted personal-hosting domain
- Read your `registryIdentity` from the card
- Match it against your linked GitHub account
- Claim the agent under `registryPackageName` automatically

If the agent was already listed under an auto-generated name (e.g. `dev.workers.my_agent`),
the registry migrates it to your declared `registryPackageName` and keeps the old name as an
alias so existing links still work.

**Already in the directory as Unclaimed?** Find the agent, click **"View & Claim"**
on the agent detail page — the same verification runs automatically.

---

### How to Add Payment Capabilities to Your Agent

If your agent accepts payment, you can declare payment protocols and settlement rails to make your agent discoverable by payment method.

**Using the Card Builder (Recommended):**

1. Go to the [Card Builder](https://www.a2a-registry.org/tools/card-builder)
2. Load your existing agent card or start a new one
3. Navigate to **Section 3: Capabilities**
4. Scroll to the **Extensions** section
5. Click **"Add Registry Extension"**
6. Fill in the payment form:
   - **Payment Protocols** — Enter comma-separated protocols (e.g., `x402, stripe`)
   - **Payment Direction** — Select `inbound` (can be paid), `outbound` (can pay others), or `both`
   - **Payment Rails** — Enter one per line in `network:TOKEN` format:
     ```
     nano:XNO
     base:USDC
     stripe:USD
     ```
7. Click **Download Card** and update your agent's card file

**Manually editing JSON:**

Add the registry extension to your agent card's `capabilities.extensions` array:

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
              }
            ]
          }
        }
      }
    ]
  }
}
```

**After adding payment capabilities:**
1. Validate your card with the [Validator](https://www.a2a-registry.org/tools/validator)
2. Publish or refresh your agent
3. Your agent will appear in payment filter results
4. A payment badge will display on your agent card

**Supported Payment Protocols:**
- `x402` — HTTP 402-based payment (Coinbase open standard)
- `stripe` — Stripe payment intents
- `lightning-invoice` — Bitcoin Lightning BOLT11 invoices
- `ap2` — Agent Payment Protocol
- `manual` — Manual invoicing/settlement

**Common Settlement Rails:**
- `nano:XNO` — Nano cryptocurrency (feeless, instant)
- `base:USDC` — USDC on Base L2
- `solana:USDC` — USDC on Solana
- `ethereum:ETH` — Ethereum mainnet
- `lightning` — Bitcoin Lightning Network
- `stripe:USD` — Stripe fiat payments

**Learn more:**
- [Payment Capabilities Guide](./payment-capabilities-guide.md) — Detailed setup guide
- [Extension Reference](./registry-extension-reference.md) — Full schema documentation
- [Payment Examples](./payment-examples.md) — Copy-paste snippets

---

### How to Validate Your Agent Card

The registry provides a validator tool to check your agent card for errors and warnings before publishing.

**Using the Validator:**

1. Go to the [Validator](https://www.a2a-registry.org/tools/validator)
2. Choose one of two options:
   - **Validate from URL** — Enter your agent card URL
   - **Validate from JSON** — Paste your agent card JSON directly
3. Click **Validate**
4. Review the results:
   - ✅ **Valid** — Your card is ready to publish
   - ⚠️ **Warnings** — Non-blocking issues (informational)
   - ❌ **Errors** — Must be fixed before publishing

**Common Validation Codes:**

| Code | Type | Description | Fix |
|---|---|---|---|
| `REGISTRY_EXT_MUST_BE_OPTIONAL` | Error | Registry extension has `required: true` | Set `required: false` |
| `REGISTRY_EXT_IDENTITY_INVALID` | Error | Package name doesn't match identity | Ensure `packageName` starts with `github.<username>.` |
| `REGISTRY_EXT_PAYMENT_RAIL_MISSING_NETWORK` | Warning | Payment rail missing `network` field | Add `network` field to each rail |
| `DEPRECATED_REGISTRY_METADATA` | Warning | Using v0.3 metadata pattern | Migrate to v1.0 extension (see [Migration Guide](./migration-v03-to-v10.md)) |

**Validator Features:**

- **Real-time validation** — Instant feedback as you type (JSON mode)
- **Line numbers** — Precise error locations
- **Finding codes** — Searchable error codes for documentation lookup
- **Severity levels** — Clear distinction between errors and warnings
- **A2A spec compliance** — Validates against official A2A v1.0 schema
- **Registry-specific checks** — Extension validation, payment rail format, identity hints

**Best Practices:**

- Validate before every publish or refresh
- Address all errors (warnings are optional but recommended)
- Use the validator during development to catch issues early
- Keep a copy of your validated card for reference

---

#### Option B — Organisation with a Verified Domain

Use this for business/team accounts deploying under their own domain.

1. [Sign in](https://www.a2a-registry.org/auth/login) and create an organisation.
2. In Organisation Settings, add the DNS TXT record shown there to your domain's DNS.
3. Click **Verify** to confirm ownership.
4. Go to [Console → My Agents](https://www.a2a-registry.org/console/agents), click **Publish Agent**,
   choose **Website** as the source, and enter your agent card URL.
5. Click **Go Live** to publish.

---

### How to Manage API Keys

1. Go to **Settings → API Keys**.
2. Click **Generate New Key**.
3. Copy the key immediately (it won't be shown again).
4. Use it in the `Authorization` header: `Bearer <YOUR_KEY>`.

## For Integrators

### How to Use the Discovery API

To find agents programmatically:

1. **Obtain an API Key** (see above).
2. **Make a Search Request**:
    ```bash
    curl -X POST https://api.a2a-registry.org/a2a/discover \
      -H "Authorization: Bearer YOUR_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "query": "travel booking agent",
        "limit": 5
      }'
    ```
3. **Parse the Response**: You'll receive a list of agents with their `id`, `manifest_url`, and `score`.

## For Users

### How to Search and Browse

1. Visit the [A2A Registry Home](https://www.a2a-registry.org).
2. Use the search bar to type what you're looking for (e.g., "calendar assistant").
3. Use the filters on the left to narrow down by category or tag.
4. Click on an agent card to view details, including how to connect.

### How to Filter Agents by Payment Method

The registry supports filtering agents by payment capabilities, making it easy to find agents that accept specific payment methods.

**On the Browse Page:**

1. Go to the [Browse Agents](https://www.a2a-registry.org/browse) page
2. Use the **payment filters** in the top section:
   - **Payment Protocol** — Select from x402, Stripe, Lightning, AP2, or Manual
   - **Payment Rail** — Enter the specific settlement rail (e.g., `nano:XNO`, `base:USDC`)
   - **Payment Direction** — Choose `inbound` (can be paid), `outbound` (can pay you), or `both`
3. Apply filters individually or combine them to narrow your search
4. Agents with payment capabilities show a **payment badge** (💳) on their card

**Example Searches:**

- **Find agents that accept x402 payments:**  
  Select `x402` from the Protocol dropdown

- **Find agents that accept Nano (XNO):**  
  Enter `nano:XNO` in the Rail field

- **Find agents that can pay you:**  
  Select `outbound` from the Direction dropdown

- **Find x402 agents accepting USDC on Base:**  
  Select `x402` protocol + enter `base:USDC` in Rail field

**Payment Badge:**

Agents that declare payment capabilities display a credit card icon (💳) badge on their card. Hover over the badge to see:
- Supported protocols
- Payment direction (inbound/outbound/both)
- Number of settlement rails

**Agent Detail Page:**

Click on any agent card to view full payment details, including:
- All supported protocols
- Complete list of settlement rails with metadata
- Fee models and settlement times
- Verification methods (for autonomous settlement)

**Related Documentation:**
- [Payment Capabilities Guide](./payment-capabilities-guide.md) — For agent authors
- [API Reference](./api.md#payment-discovery) — Programmatic access
