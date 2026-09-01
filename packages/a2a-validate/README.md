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
