# @a2a-registry/validate

CLI and library validator for the **Agent-to-Agent (A2A) Protocol v1.0** agent cards.

Validates pure A2A 1.0 protocol compliance — schema structure, security objects, interface URLs, JWS signatures, and semantic quality hints. Runs fully offline for local files; live URL mode adds network and TLS checks.

> **Protocol source:** [a2aproject/A2A](https://github.com/a2aproject/A2A) — specification sections 4.4 (Agent Discovery Objects) and 4.5 (Security Objects).

---

## Installation

Run directly with `npx` (zero installation required):
```bash
npx @a2a-registry/validate https://my-agent.example.com
```

Or install globally:
```bash
npm install -g @a2a-registry/validate
```

---

## Usage

### Validate a live agent endpoint
```bash
a2a-validate https://weather.acme.com/.well-known/agent-card.json
```

### Validate a local JSON file
```bash
a2a-validate ./agent-card.json
```

### CI/CD pipeline enforcement
```bash
# Output structured JSON report
a2a-validate ./agent-card.json --format=json

# Fail pipeline on any warning or error
a2a-validate https://my-agent.com --fail-on=warning
```

---

## What gets checked

| Tier | Checks | Mode |
|---|---|---|
| **1 — Schema** | Required fields, types, security object shapes (A2A 1.0 discriminated union), v0.3 migration hints | offline + live |
| **2 — Network** | HTTP 200, HTTPS, canonical `application/a2a+json` MIME type, CORS header, latency | live only |
| **3 — Quality** | Skill `examples` richness, declared security scheme consistency | offline + live |
| **4 — Trust** | JWS signature verification (RFC 7515 / RFC 8785), DNS TXT ownership record | offline + live |

---

## Programmatic usage (Node.js)

```javascript
const { validateManifest } = require('@a2a-registry/validate');

// Offline — from object or JSON string
const report = await validateManifest({ name: 'My Agent', ... });

// Offline — from file
const fs = require('fs');
const report = await validateManifest(fs.readFileSync('agent-card.json', 'utf-8'));

// Live URL probe
const report = await validateManifest('https://my-agent.example.com');

console.log(`Grade: ${report.grade}  Score: ${report.readinessScore}/100`);
console.log(`Valid: ${report.isValid}`);
```

### Lower-level API

```javascript
const { validateJson, validateUrl } = require('@a2a-registry/validate');

// Explicit offline validation
const report = await validateJson(jsonStringOrObject);

// Explicit live validation
const report = await validateUrl('https://my-agent.example.com');
```

---

## Exit codes (CLI)

| Code | Meaning |
|---|---|
| `0` | Passed within `--fail-on` threshold |
| `1` | Validation failed (errors, or warnings when `--fail-on=warning`) |
| `2` | Usage error (bad arguments, file not found) |

---

## Changelog

### 1.0.0
- Initial release
- Updated security object schema to match A2A 1.0 proto — discriminated union (`httpAuthSecurityScheme`, `apiKeySecurityScheme`, `oauth2SecurityScheme`, `openIdConnectSecurityScheme`, `mtlsSecurityScheme`) replacing the old flat `type` field
- Correct `SecurityRequirement` shape: `{ schemes: { Name: { list: [...] } } }`
- All five OAuth flow variants with correct required fields
- No registry-specific fields (`package_name`, `category`, `target_audience`) from schema — this package validates pure A2A 1.0 only
- Updated schema `$id` to registry-owned namespace

---

## License
Apache-2.0
