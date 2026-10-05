# @a2a-registry/validate

Official CLI and validation utility for the **Linux Foundation Agent-to-Agent (A2A) Protocol v1.0**.

Inspect, lint, and probe live or local `agent-card.json` manifests directly from your terminal or CI/CD pipelines.

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

### Validate a Live Agent Endpoint
```bash
a2a-validate https://weather.acme.com/.well-known/agent-card.json
```

### Validate a GoDaddy ANS Handle
```bash
a2a-validate a2a://weather.godaddy.agent
```

### Validate a Local JSON File
```bash
a2a-validate ./agent-card.json
```

### CI/CD Pipeline Enforcement
```bash
# Output JSON report
a2a-validate ./agent-card.json --format=json

# Fail pipeline on any warning or error
a2a-validate https://my-agent.com --fail-on=warning
```

Use `--help`/`-h` or `--version`/`-v` alone. Reports default to readable text;
`--format=json` (or `--format json`) prints a JSON report. `--fail-on=error` is
the default; `--fail-on=warning` fails on either warnings or errors. Output has
no ANSI colors, and `--no-color` is accepted for scripts.

Pass exactly one target. Unknown or repeated options are usage errors. A bare
domain such as `example.com` is a **local filename**; only explicit `http://`,
`https://` and `a2a://` targets select URL validation. Use `--` before filenames
beginning with a dash. Embedded URL credentials are rejected.

Exit codes are **0** for a report passing the chosen threshold, **1** for a
validation error (including malformed JSON) or selected warning, and **2** for
usage, file-read or unexpected evaluation failures. In JSON mode, usage and
I/O failures return an `error` object on stdout.

Unsigned local JSON validation needs no network or registry API. Signed cards
may cause the existing library to fetch a JWS key from `jku`. Explicit URL mode
uses the existing library's probes. `a2a://` is delegated to that same library;
the CLI adds no ANS resolution and unsupported transport produces its report.

---

## Programmatic Usage (Node.js)

```javascript
const { validateManifest } = require('@a2a-registry/validate');

async function checkAgent() {
  const report = await validateManifest('https://my-agent.com');
  console.log(`Readiness Score: ${report.readinessScore}/100 (Grade: ${report.grade})`);
  console.log(`Is Valid v1.0: ${report.isValid}`);
}

checkAgent();
```

---

## License
Apache-2.0
