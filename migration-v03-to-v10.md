# Migration Guide: v0.3 Metadata → v1.0 Extension

This guide helps existing agent authors migrate from the informal v0.3 `metadata` pattern to the official A2A v1.0 `capabilities.extensions` pattern.

---

## What Changed?

### v0.3 (Deprecated Pattern)

In A2A v0.3, agents used an informal `metadata` object for registry-specific hints:

```json
{
  "protocolVersion": "0.3.0",
  "name": "My Agent",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "youruser",
    "registryPackageName": "github.youruser.agent_name"
  }
}
```

**Problems with this approach:**
- `metadata` is not part of the official A2A v1.0 specification
- Generates validation warnings in strict v1.0 validators
- Not compatible with the official extension mechanism
- Limited to identity hints only (no payment capabilities)

### v1.0 (Recommended Pattern)

A2A v1.0 introduces the official `capabilities.extensions` mechanism for registry metadata:

```json
{
  "protocolVersion": "1.0",
  "name": "My Agent",
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity hint",
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

**Benefits:**
- ✅ Official A2A v1.0 spec-compliant
- ✅ No validator warnings
- ✅ Supports payment capabilities (new feature)
- ✅ Extensible for future registry features
- ✅ Works with all A2A v1.0 tools and validators

---

## Do I Need to Migrate Immediately?

**No.** The registry continues to support v0.3 `metadata` as a fallback. Your agent will keep working.

**However, you should migrate because:**
1. v1.0 is the official specification pattern
2. You'll be able to declare payment capabilities
3. Validator warnings will disappear
4. Future registry features may require the extension
5. Better compatibility with A2A ecosystem tools

---

## Migration Steps

### Step 1: Update Protocol Version

Change your `protocolVersion` from `0.3.0` to `1.0`:

```json
{
  "protocolVersion": "1.0"
}
```

### Step 2: Add Capabilities Object

If your card doesn't already have a `capabilities` object, add it:

```json
{
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": []
  }
}
```

If you already have `capabilities`, just add the `extensions` array if it's missing.

### Step 3: Add the Registry Extension

Add the registry extension to the `extensions` array:

```json
{
  "capabilities": {
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity hint",
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

**Important:** Set `"required": false` — this extension is advisory only.

### Step 4: Map Old Fields to New Fields

| Old Field (v0.3) | New Field (v1.0) | Notes |
|---|---|---|
| `metadata.registryIdentityProvider` | `params.identity.provider` | Same value (`"github"`) |
| `metadata.registryIdentity` | `params.identity.username` | Same value (your GitHub username) |
| `metadata.registryPackageName` | `params.identity.packageName` | Same value (`github.username.agent_name`) |

### Step 5: Remove Old Metadata (Optional)

You can **optionally** remove the old `metadata` fields after migrating:

```json
// You can remove this entire block
"metadata": {
  "registryIdentityProvider": "github",
  "registryIdentity": "youruser",
  "registryPackageName": "github.youruser.agent_name"
}
```

**Or keep it for backward compatibility** — the registry reads the extension first, then falls back to metadata. Keeping both ensures maximum compatibility with older tools.

### Step 6: Validate Your Card

1. Go to the [Validator](/tools/validator)
2. Paste your updated card JSON
3. Verify you see ✓ **Valid** with no warnings

If you see `DEPRECATED_REGISTRY_METADATA` warning, you still have the old `metadata` fields. This is informational only — not an error.

### Step 7: Publish or Refresh

- **New agents:** Submit via [Publish](/publish)
- **Existing agents:** The registry will pick up changes on the next refresh (within 7 days), or trigger a manual refresh from your dashboard

---

## Complete Migration Examples

### Example 1: Simple Identity Hint Migration

**Before (v0.3):**
```json
{
  "protocolVersion": "0.3.0",
  "name": "Weather Agent",
  "description": "Get weather forecasts",
  "url": "https://my-agent.workers.dev/a2a/v1",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "alice",
    "registryPackageName": "github.alice.weather_agent"
  }
}
```

**After (v1.0):**
```json
{
  "protocolVersion": "1.0",
  "name": "Weather Agent",
  "description": "Get weather forecasts",
  "url": "https://my-agent.workers.dev/a2a/v1",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity hint",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "alice",
            "packageName": "github.alice.weather_agent"
          }
        }
      }
    ]
  }
}
```

---

### Example 2: Migration + Adding Payment Capabilities

If you're migrating anyway, this is a great time to add payment capabilities!

**Before (v0.3):**
```json
{
  "protocolVersion": "0.3.0",
  "name": "Translation Agent",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "bob",
    "registryPackageName": "github.bob.translator"
  }
}
```

**After (v1.0 with payment):**
```json
{
  "protocolVersion": "1.0",
  "name": "Translation Agent",
  "capabilities": {
    "streaming": false,
    "extensions": [
      {
        "uri": "https://a2a-registry.org/extensions/registry/v1",
        "description": "Registry identity and payment",
        "required": false,
        "params": {
          "identity": {
            "provider": "github",
            "username": "bob",
            "packageName": "github.bob.translator"
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

### Example 3: Agent Without Personal Hosting (Domain-Verified)

If your agent is hosted on your own verified domain (not `*.workers.dev` or `*.github.io`), you **don't need** identity hints at all. You can skip the `identity` block and only add payment if needed:

**Before (v0.3 — unnecessary metadata):**
```json
{
  "protocolVersion": "0.3.0",
  "name": "Enterprise Agent",
  "url": "https://agent.example.com/a2a/v1",
  "metadata": {
    "registryIdentityProvider": "github",
    "registryIdentity": "company",
    "registryPackageName": "com.example.enterprise_agent"
  }
}
```

**After (v1.0 — payment only, no identity needed):**
```json
{
  "protocolVersion": "1.0",
  "name": "Enterprise Agent",
  "url": "https://agent.example.com/a2a/v1",
  "capabilities": {
    "streaming": false,
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
                "type": "fiat"
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

## Using the Card Builder for Migration

The easiest way to migrate is using the [Card Builder](/tools/card-builder):

1. **Load Your Current Card**
   - Click "Load from URL" or "Load from JSON"
   - Paste your v0.3 card

2. **Navigate to Section 3: Capabilities**
   - Scroll to the Extensions section

3. **Click "Add Registry Extension"**
   - The builder will auto-detect your old `metadata` fields
   - Fill in the identity section (pre-filled if detected)
   - Optionally add payment capabilities

4. **Download Updated Card**
   - Your card is now v1.0 compliant
   - Old `metadata` fields are preserved for backward compatibility (you can manually remove them if desired)

---

## Validation & Testing

### Expected Validator Outcomes

| Card State | Validator Result |
|---|---|
| v0.3 with only `metadata` | ⚠️ Warning: `DEPRECATED_REGISTRY_METADATA` |
| v1.0 with only extension | ✅ Valid (no warnings) |
| v1.0 with both extension and `metadata` | ⚠️ Info: Extension takes priority, metadata ignored |
| v1.0 extension with `required: true` | ❌ Error: `REGISTRY_EXT_MUST_BE_OPTIONAL` |

### Common Validation Errors

**Error: `REGISTRY_EXT_MUST_BE_OPTIONAL`**
- **Cause:** You set `"required": true` on the registry extension
- **Fix:** Change to `"required": false`

**Error: `REGISTRY_EXT_IDENTITY_INVALID`**
- **Cause:** `packageName` doesn't start with `github.<username>.`
- **Fix:** Ensure package name format is `github.youruser.agent_name`

**Warning: `DEPRECATED_REGISTRY_METADATA`**
- **Cause:** You're still using v0.3 `metadata` fields
- **Fix:** Add the registry extension (see Step 3 above)

---

## Backward Compatibility

### Will My Old Card Stop Working?

**No.** The registry supports both patterns:

1. **Priority 1:** `capabilities.extensions` with registry URI → uses this
2. **Priority 2:** `card.metadata` → fallback if extension not present

Your v0.3 card continues to work indefinitely.

### When Will v0.3 Support Be Removed?

There is **no planned deprecation date**. The registry will maintain v0.3 fallback support to avoid breaking existing agents.

However, new features (like payment discovery) **only work** with the v1.0 extension pattern.

---

## Troubleshooting

### My migrated card shows "Invalid" in the validator

**Check:**
1. `protocolVersion` is `"1.0"` (not `0.3.0` or `1.0.0`)
2. Extension URI is exactly `https://a2a-registry.org/extensions/registry/v1` (no trailing slash)
3. `required` is `false` (not `true`)
4. All required fields are present (`provider`, `username`, `packageName`)

### My agent doesn't show up with the new package name

**Possible causes:**
1. **Not refreshed yet** — Wait for automatic refresh (7 days) or trigger manual refresh
2. **Wrong domain** — Identity hints only work on `*.workers.dev`, `*.github.io`, etc.
3. **GitHub account not linked** — Link your GitHub in [Settings](/console/settings)
4. **Package name mismatch** — Ensure `packageName` starts with `github.<your-github-username>.`

### I added payment but filters don't find my agent

**Check:**
1. Agent has been refreshed after adding payment capabilities
2. Extension URI is correct
3. `payment.protocols` and `payment.rails` are properly formatted
4. Each rail has a `network` field (required)

---

## Migration Checklist

Use this checklist to track your migration:

- [ ] Update `protocolVersion` to `"1.0"`
- [ ] Add `capabilities` object (if not present)
- [ ] Add `capabilities.extensions` array (if not present)
- [ ] Add registry extension with correct URI
- [ ] Set `required: false` on the extension
- [ ] Map old `metadata` fields to new `params.identity` fields
- [ ] (Optional) Add payment capabilities
- [ ] (Optional) Remove old `metadata` fields
- [ ] Validate card with [Validator](/tools/validator)
- [ ] Verify no errors, only optional warnings
- [ ] Publish or refresh agent
- [ ] Test that agent appears in registry with correct package name
- [ ] (If payment added) Test payment filters on [Browse](/browse)

---

## Next Steps

- **[Extension Reference](./registry-extension-reference.md)** — Full schema documentation
- **[Payment Capabilities Guide](./payment-capabilities-guide.md)** — Add payment to your agent
- **[Card Builder](/tools/card-builder)** — Visual migration tool
- **[Validator](/tools/validator)** — Test your migrated card

---

## Need Help?

- **Community:** [GitHub Discussions](https://github.com/A2ARegistry/GlobalA2ARegistry/discussions)
- **Issues:** [GitHub Issues](https://github.com/A2ARegistry/GlobalA2ARegistry/issues)
- **Email:** support@a2a-registry.org
