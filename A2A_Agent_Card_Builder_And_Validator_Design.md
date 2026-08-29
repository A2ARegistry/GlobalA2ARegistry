# A2A Agent Card Builder & Validator Suite — Design & Specification

**Status:** Approved / In Progress  
**Spec Target:** Linux Foundation A2A Standard v1.0  
**Target Platform:** Global A2A Registry Portal & Cloudflare Backend  
**Audience:** Platform Developers, Community Contributors, Agent Authors  

---

## 1. Executive Summary & Product Vision

As the Agentic Web and the **Linux Foundation Agent-to-Agent (A2A) Protocol v1.0** evolve, developers face two immediate operational hurdles when publishing agents:
1. **Authoring Friction:** Crafting a strictly spec-compliant `agent-card.json` (at `/.well-known/agent-card.json`) that adheres to v1.0 schema changes (e.g. `supportedInterfaces` array, required `defaultInputModes`/`defaultOutputModes`, required skill `tags`, and cryptographic `signatures`).
2. **Verification & Debugging:** Verifying whether a hosted or local `agent-card.json` meets A2A v1.0 specifications, passes CORS/MIME checks, provides high semantic discoverability, and possesses valid cryptographic signatures or domain ownership records.

This document defines a unified **Developer Tools Suite** for the A2A Registry:
- **A2A Agent Card Builder & Publisher**: An interactive, dual-pane editor (Form + CodeMirror 6) with instant v1.0 JSON generation, templates, OpenAPI/MCP converters, deployment snippets, and team cloud drafts.
- **A2A Manifest Inspector & Validator**: A multi-tiered linter and live network prober providing actionable diagnostic reports, v0.3→v1.0 migration advice, cryptographic JWS signature validation, and compliance scoring.
- **`@a2a-registry/validate` CLI**: A self-contained npm package for CI/CD pipelines (bundles all dependencies; no peer installs required).

---

## 2. Competitive Landscape & Core Differentiation

Several standalone tools have begun emerging in the A2A ecosystem:
- **[agentcard.net](https://www.agentcard.net/)**: Basic web generator and validator targeting v1.0.
- **[CapiscIO](https://capisc.io/)**: Developer CLI and GitHub Action focusing on cryptographic verification and endpoint testing.
- **[AgentProbe/a2a-agent-validator](https://github.com/AgentProbe/a2a-agent-validator)**: End-to-end test suite checking boolean capability matrices.

### Where the A2A Registry Suite Differentiates:
While generic JSON linting and CORS checks are table stakes, the A2A Registry suite uniquely offers:
1. **Deep Registry Lifecycle Integration**: 1-click import from claimed agents, version staging, and instant "Deploy & Register" publishing into the global registry.
2. **Collaborative Team Workspace**: Persistent Cloudflare D1 drafts with team/organization sharing, role isolation, and semantic field-level diffs (`jsondiffpatch`).
3. **BYOK (Bring-Your-Own-Key) AI Copilot**: Natural language "Magic Draft" synthesis, AI prompt enrichment for vector search hit-rate optimization, and 1-click AI auto-fixing.
4. **Built-in Ecosystem Converters**: In-browser transformation from OpenAPI 3.0/3.1 and Anthropic MCP configs directly into A2A v1.0 cards.
5. **Dual Trust Verification**: Simultaneous validation of RFC 7515/8785 JWS signatures, DNS TXT (`_a2a.<domain>`), and GoDaddy ANS (`a2a://`) handles.

---

## 3. Access Tiering Model (Public vs. Authenticated BYOK)

To maximize developer adoption, SEO visibility, and community utility while rewarding registered developers, features are stratified across public and authenticated tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             TIERING MATRIX                                  │
├───────────────────────────────────┬─────────────────────────────────────────┤
│        PUBLIC (UNAUTHENTICATED)   │       AUTHENTICATED (SIGNED-IN + BYOK)  │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ • Interactive v1.0 Builder (GUI)  │ • All Public Features                   │
│ • Live JSON preview & copy/dl     │ • Cloud Draft Saving & Autosave in D1   │
│ • Framework deployment snippets   │ • Team Sharing & Org Draft Permissions  │
│ • Paste/Upload JSON validation    │ • Multi-card Version History & Diffs    │
│ • Public Live URL scanner (SSRF-  │ • Import directly from Claimed Agents   │
│   guarded)                        │ • 1-Click "Deploy & Register" flow      │
│ • v0.3 → v1.0 Migration Linter    │ • Stored BYOK Keys (OpenAI, Gemini)     │
│ • OpenAPI / MCP quick import      │ • 🧠 AI "Magic Draft" Generation (BYOK) │
│ • Standard compliance report      │ • 🧠 AI Semantic Quality & Fixer (BYOK) │
│ • 1-Click "Register Agent" CTA    │ • Extended draft limits (20 user/50 org)│
│   (sign-in required to complete)  │                                         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 4. A2A Protocol v1.0 Specification Conformance

The suite strictly adheres to the official Linux Foundation A2A v1.0 specifications.

### 4.1 Required vs. Optional Field Matrix

| Field | v1.0 Status | Description / Rules |
| :--- | :--- | :--- |
| **`name`** | **Required** | Canonical agent name / display name (string). |
| **`description`** | **Required** | Detailed summary of agent purpose and routing intent (string). |
| **`version`** | **Required** | Semantic version string (e.g. `1.0.0`). |
| **`supportedInterfaces`** | **Required** | Array of `AgentInterface` objects (ordered; 1st = preferred). |
| **`capabilities`** | **Required** | Object declaring features. Valid boolean fields per v1.0 spec: `streaming`, `pushNotifications`, `extendedAgentCard`. Also accepts an `extensions` array of `AgentExtension` objects (`{ uri: string, description?: string, required?: boolean, params?: object }`). |
| **`defaultInputModes`** | **Required** | Array of MIME/modality types (`text`, `application/json`, `audio`, etc.). |
| **`defaultOutputModes`** | **Required** | Array of MIME/modality types (`text`, `application/json`, etc.). |
| **`skills`** | **Required** | Array of `AgentSkill` objects. Each skill **must** include `id`, `name`, `description`, and `tags` (required string array). Optional fields: `examples` (array of strings), `inputModes`, `outputModes` (per-skill MIME overrides), and `securityRequirements`. Note: `inputSchema`/`outputSchema` are **not** part of the v1.0 spec; structured input shape is conveyed via `inputModes: ["application/json"]` combined with `description` and `examples`. |
| **`provider`** | Optional | `AgentProvider` object with required sub-fields `organization` (string) and `url` (string). Displayed by registries and orchestrators as a trust signal. |
| **`securitySchemes`** | Optional | `map<string, SecurityScheme>` declaring named auth schemes (`apiKey`, `http` [bearer], `oauth2`, `openIdConnect`, `mutualTls`). Required if any skill or the card itself declares `securityRequirements`. |
| **`securityRequirements`** | Optional | `array of SecurityRequirement` referencing schemes from `securitySchemes`. Declares that callers must authenticate before any task interaction. |
| **`signatures`** | Optional | Array of `AgentCardSignature` objects (JWS RFC 7515 + JCS RFC 8785). |
| **`iconUrl`** / **`documentationUrl`** | Optional | Metadata URLs for rich directory rendering. |
| **`package_name`** | *Registry Extension* | Reverse-DNS identifier (`org.domain.agent`). Highlighted as a Registry Recommended Best Practice. |

### 4.2 `supportedInterfaces` Multi-Protocol Architecture

The v1.0 specification replaces legacy single `url`/`preferredTransport` fields with an ordered interface array. The first interface is treated as the agent's preferred transport:

* **Standard Bindings**: Supported standard binding identifiers include `JSONRPC` (HTTP + JSON-RPC 2.0), `GRPC` (HTTP/2 + Protocol Buffers), and `HTTP+JSON` (REST-style).
* **Custom Protocol Binding URIs**: Custom transport bindings (e.g. WebSocket, SSE, experimental RPCs) **MUST be a URI** (e.g. `https://a2a-protocol.org/bindings/websocket` or custom URI). The builder provides autocomplete for standard names and well-known URIs.
* **Tenant Routing**: An optional `tenant` string allows multi-tenant routing, which the caller echoes back in requests.

```json
{
  "supportedInterfaces": [
    {
      "url": "https://agent.example.com/a2a/v1",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0",
      "tenant": "tenant-corp-123"
    },
    {
      "url": "agent.example.com:50051",
      "protocolBinding": "GRPC",
      "protocolVersion": "1.0"
    },
    {
      "url": "https://agent.example.com/api/v1",
      "protocolBinding": "HTTP+JSON",
      "protocolVersion": "1.0"
    },
    {
      "url": "wss://agent.example.com/a2a/ws",
      "protocolBinding": "https://a2a-protocol.org/bindings/websocket",
      "protocolVersion": "1.0"
    }
  ]
}
```

### 4.3 JWS Cryptographic Signatures (`AgentCardSignature`)

To protect against Man-in-the-Middle (MitM) attacks and unauthorized card tampering, v1.0 specifies `signatures`:
* **Canonicalization**: Pre-signature payload canonicalized using **JCS (RFC 8785)**.
* **Signature Encoding**: Signed using **JWS (RFC 7515)**. Protected header references public key via `jku` (JWKS URL) or inline `jwk`.
* **Verification**: Validator verifies the JWS signature header and public key against the agent's identity.

### 4.4 Registry Best Practices & Recommended Extensions

To bridge the core specification with global registry indexing, search optimization, and multi-tenant hosting, the suite recognizes several **Registry Recommended Best Practices**:

| Extension / Best Practice | Scope | Purpose & Benefit |
| :--- | :--- | :--- |
| **`package_name`** | *Registry Extension* | Reverse-DNS format (`org.domain.agent`) to establish unambiguous global namespace uniqueness across directory catalogs. |
| **`tenant` in `AgentInterface`** | *Implementation Extension* | Optional string for multi-tenant backend routing. Callers echo this identifier in headers/requests to target specific customer instances. |
| **`params` in `AgentExtension`** | *Extension Configuration* | Optional object holding extension-specific configuration (e.g. AP2 payment schemas, A2UI rendering configs). |
| **Prompt Variety (3–5 Examples)** | *Discovery Best Practice* | Providing diverse, natural-language query examples per skill substantially improves semantic vector retrieval hit rates during multi-agent discovery. |
| **DNS TXT (`_a2a.<domain>`) / ANS** | *Trust Best Practice* | Fast-track domain ownership verification that awards verified trust badges in the registry. |
| **10KB Payload Cap** | *Registry Guardrail* | Enforced limit on draft saves and submissions to guarantee sub-millisecond edge indexing and lightweight payload delivery. |

---

## 5. BYOK AI Integration Architecture

Leveraging the existing BYOK infrastructure from `/playground` (which uses `/api/config/keys` to securely store OpenAI and Google Gemini API keys), signed-in users unlock agentic assistants:

### 5.1 System Prompt Spec-Anchoring
To guarantee that LLM-generated output complies with v1.0 rather than hallucinating legacy v0.3 flat fields (`url`, `capabilities.streaming`), all AI prompts inject the authoritative A2A v1.0 JSON Schema into their system context.

### 5.2 AI Capabilities in the Builder
1. **Natural Language "Magic Draft"**:
   * Developer inputs plain English description → AI returns complete, validated v1.0 JSON with `supportedInterfaces`, categorized skills, input/output modes, and prompt examples.
2. **AI Skill & Prompt Enrichment**:
   * For any skill (e.g. `query_balance`), AI synthesizes 3–5 diverse, natural prompt examples (e.g. *"What's my remaining balance on card ending in 4122?"*, *"How much do I have left in checking?"*) to maximize vector discovery hit rates.
3. **OpenAPI / Code Doc Synthesizer**:
   * Ingests raw API code or unformatted documentation and extracts structured A2A `skills` with appropriate `inputModes`, `tags`, and `examples`.

### 5.3 AI Capabilities in the Validator
1. **AI Semantic Linting & Prompt Quality Audit**:
   * Audits skill descriptions and examples for ambiguity, skill overlap, or confusing parameter constraints.
2. **1-Click AI Auto-Fixer**:
   * Analyzes diagnostic errors from Tier 1–3 checks and rewrites the JSON into valid v1.0 syntax without altering the developer's operational endpoints.

---

## 6. Comprehensive Feature Breakdown

### 6.1 Tool 1: Agent Card Builder (`/tools/builder` & `/console/tools/builder`)

#### A. Multi-Mode Authoring & CodeMirror 6 Editor
1. **Visual Form Mode (Guided):**
   * **Identity & Metadata**: Name, Description, SemVer Version, Icon URL, Docs URL, Provider (Organization name + URL), Reverse-DNS Package Name (*Registry Extension*).
   * **Interfaces & Transports (`supportedInterfaces`)**: Multi-row list editor for declaring endpoints. Fields:
     - `protocolBinding`: Select standard binding (`JSONRPC`, `GRPC`, `HTTP+JSON`) or enter a custom URI (with autocomplete for `https://a2a-protocol.org/bindings/...`).
     - `protocolVersion`: Protocol binding version (e.g. `1.0`).
     - `url`: `https://...` for HTTP/JSON-RPC/WebSocket or `hostname:port` for gRPC (no `https://` prefix for gRPC).
     - `tenant`: Optional multi-tenant routing identifier.
     - Reordering: Drag handle to set preferred interface order (1st entry = preferred).
   * **Capabilities**: Boolean switches for `streaming`, `pushNotifications`, and `extendedAgentCard`. Sub-editor for `extensions[]` array (`AgentExtension` objects with `uri: string`, `description?: string`, `required?: boolean`, and `params?: object`).
   * **I/O Modalities**: Required multi-select for `defaultInputModes` and `defaultOutputModes` (`text`, `application/json`, `audio`, `image`, `video`).
   * **Skills & Tools Editor**: Add/edit nested skills with `id`, `name`, `description`, **`tags` (required string array)**, per-skill `inputModes`/`outputModes` (MIME type overrides), Example Prompts (`examples`), and optional per-skill `securityRequirements`. Note: `inputSchema`/`outputSchema` are not v1.0 spec fields — structured input shape is conveyed via `inputModes: ["application/json"]` and rich `examples` / `description`.
   * **Security Schemes & Requirements**: Named `securitySchemes` map editor (`apiKey`, `http` [bearer], `oauth2`, `openIdConnect`, `mutualTls`) and card-level `securityRequirements` array referencing declared scheme names. Validator warns if a scheme is referenced in requirements but not declared here.
   * **Signatures**: JWS signature attachment section (see Section 4.3 and Phase 2 notes for scope).
2. **Code Mode with CodeMirror 6**:
   * Use the official `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-json`, and `@codemirror/lint` packages directly with a thin React `useEffect`/`useRef` integration — avoid third-party wrappers to prevent coupling to non-official release cycles.
   * **Bi-directional Live Sync with Error Boundary**:
     * *Form → Code*: Real-time serialization (`JSON.stringify(formData, null, 2)`).
     * *Code → Form*: Debounced parsing (300ms). If JSON syntax is invalid mid-typing, the editor displays an inline syntax banner while preserving form state.
3. **Template Library (Quick Start)**:
   * *Utility / Tool Agent* (JSON-RPC / REST).
   * *Enterprise Multi-Tenant Agent* (gRPC + tenant routing).
   * *Conversational Assistant* (Streaming + Multi-modal I/O).
   * *MCP Gateway Agent* (Anthropic MCP tool bridge).

#### B. Converters & Importers
* **OpenAPI 3.0/3.1 Importer**:
  * Ingests OpenAPI JSON/YAML via paste or SSRF-protected URL fetch.
  * Employs a JSON Schema dereferencer (`$ref` resolution) to convert OpenAPI `paths` into A2A `skills[]`. Operation request bodies are summarised into skill `description` and `examples`; the MIME types of request/response bodies are mapped to `inputModes`/`outputModes`.
* **Anthropic MCP Config Importer**:
  * Ingests `claude_desktop_config.json` or MCP manifests, mapping tool definitions directly to A2A skill structures (names, descriptions, tags, and `inputModes`).

#### C. Deployment Helper & Snippet Generator
Copy-paste integration code across major runtimes:
* **Next.js (App Router)**: `app/.well-known/agent-card.json/route.ts` with CORS.
* **Cloudflare Workers**: `wrangler.jsonc` + route handler.
* **FastAPI (Python)**: `@app.get("/.well-known/agent-card.json")` with CORS middleware.
* **Express.js (Node)**: `app.get('/.well-known/agent-card.json', ...)`.
* **gRPC Service (Python / Go)**: gRPC reflection and metadata declaration snippet.
* **Nginx & Apache**: Location rewrite rules with `Access-Control-Allow-Origin: *`.

#### D. Collaborative Console Drafts
* **Cloud Drafts in D1**: Save up to 20 drafts per user (50 per organization) with 10KB size enforcement.
* **Team Sharing (`is_shared`)**: Toggle drafts between private (`0`) and organization-wide (`1`) visibility.
* **Semantic Version Diffing**: Powered by `jsondiffpatch` for visual field-by-field changelogs.
* **Claimed Agent Sync**: 1-click loading from owned registry agents to stage live updates.

---

### 6.2 Tool 2: Manifest Inspector & Validator (`/tools/validator` & `/console/tools/validator`)

#### A. Input Modes & Scope Handling
1. **Live URL Inspection**: Enter base agent URL (`https://agent.example.com`), explicit file link (`.../.well-known/agent-card.json`), or `a2a://` ANS handle.
2. **Raw JSON Paste / File Drop**: Paste JSON or drop a `.json` file for offline inspection.
3. **Context-Aware Scoring**: Offline mode evaluates Schema and Discovery tiers without penalizing for un-testable Network/DNS checks (clearly labeled *"Not Applicable in Offline Mode"*).

#### B. 4-Tier Validation Engine

```
Readiness Score Calculation Formula:
• Base Score: 100
• Tier 1 (Schema / Critical Errors): -25 pts each (Score capped at max 40% if any Tier 1 error exists)
• Tier 2 (Network / Hosting Errors): -15 pts each (HTTP 4xx/5xx caps score at 20% in Live URL mode)
• Tier 3 (Discovery / Semantic Warnings): -5 pts each (missing examples, unmapped categories)
• Tier 4 (Trust & Verification Bonus): +10 pts bonus for verified JWS signature, DNS TXT, or ANS match
```

1. **Tier 1: Syntax & Structural Schema Validation (Ajv Engine)**
   * Valid JSON formatting and max 10KB payload check.
   * Conformance to official A2A v1.0 JSON Schema (Draft 2020-12).
   * Verifies required fields: `name`, `description`, `version`, `supportedInterfaces` (array), `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills` (with required `tags` array).
   * **Interface URL & Binding Validation**: Validates `protocolBinding` as a standard name (`JSONRPC`, `GRPC`, `HTTP+JSON`) or a valid URI. For interfaces with `protocolBinding: "GRPC"`, validates the URL as `hostname:port` (no `https://` scheme prefix). For HTTP-based bindings, validates as an absolute HTTPS URL.
   * **v0.3 vs v1.0 Format Detector**: Checks all four categories of v0.3→v1.0 breaking changes and surfaces targeted migration hints:
     - *Structural*: Legacy flat `url` or `preferredTransport` top-level fields → *"Detected v0.3 card — migrate to `supportedInterfaces[]`"*.
     - *Enum values*: `role: "user"` / `"agent"` (should be `"ROLE_USER"` / `"ROLE_AGENT"`); `state: "completed"` style kebab/lowercase values (should be `TASK_STATE_*` SCREAMING_SNAKE_CASE).
     - *Part discriminator*: `{"kind": "text", ...}` pattern inside any embedded `history` or example fields → *"Legacy `kind` discriminator detected — use member-based discrimination"*.
     - *Capability location*: `supportsAuthenticatedExtendedCard: true` at top level → *"Move to `capabilities.extendedAgentCard`"*.

2. **Tier 2: Network, Security & Hosting Protocol (Live URL Mode)**
   * **HTTP Status**: Returns `200 OK`.
   * **HTTPS Enforcement**: Production endpoints must use valid TLS/SSL certificates.
   * **MIME Content-Type**: Must return `application/a2a+json` (canonical v1.0) or `application/json` (accepted with advisory warning). `text/plain` and `text/html` are flagged as Tier 2 errors.
   * **CORS Compliance**: Response header inspection for `Access-Control-Allow-Origin: *`.
   * **Latency & Size**: Response time < 1500ms; payload < 10KB.

3. **Tier 3: Discovery & Semantic Quality Audit**
   * **Reverse-DNS Package Identifier**: Checks format against registry recommendation conventions.
   * **Skill Prompt Richness**: Flags skills lacking natural example prompts.
   * **Taxonomy Normalization**: Validates `category` and `target_audience` against registry index vocabularies.
   * **OpenAPI Reachability**: If `openapi_url` is declared, tests accessibility.
   * **Security Scheme Consistency**: Warns if any `securityRequirements` entry (card-level or per-skill) references a scheme name not defined in `securitySchemes`, or if `securityRequirements` is present but `securitySchemes` is empty/absent.

4. **Tier 4: Cryptographic Trust & Verification**
   * **JWS Signature Verification**: Validates `signatures[]` against JWS (RFC 7515) and JCS (RFC 8785) standards (supporting public keys resolved via `jku` JWKS URL or inline `jwk`).
   * **DNS TXT Ownership**: Verifies `_a2a.<domain>` DNS record match.
   * **GoDaddy ANS Handle**: Resolves and matches `a2a://` handles to origin servers.

#### C. Interactive Diagnostic Report & Fixer
* **Visual Summary**: Overall score gauge (`0–100%`) and compliance grade (`A+`, `B`, `Needs Work`).
* **Categorized Findings**: Grouped by Schema, Network, Discovery, and Cryptographic Trust.
* **"Open in Builder & Fix" Action**: 1-click loads the JSON into the builder with offending fields pre-selected.
* **"Publish to Registry" Direct CTA**: Displays prominent registration button once the card passes with 0 errors (visible to all users; prompts sign-in on submission).

---

## 7. Technical Architecture & Security Specifications

### 7.1 System Topology

```
                                    PORTAL (Next.js)
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                  │
  │   Public Routes:                                                                 │
  │   • /tools/builder        (Visual Form & CodeMirror 6 Editor)                    │
  │   • /tools/validator      (Live Probe & Offline Linter)                          │
  │   • /resources/spec       (Interactive v1.0 Schema Explorer)                     │
  │                                                                                  │
  │   Authenticated Console:                                                         │
  │   • /console/tools/builder (Team Drafts, Claimed Agent Sync, Version Diffing)    │
  │   • /console/tools/validator (AI Auto-Fixer with BYOK Keys)                      │
  │                                                                                  │
  │   Shared UI Components:                                                          │
  │   ┌───────────────────────────┐         ┌───────────────────────────┐            │
  │   │  Visual Form Controls     │ ◄─────► │ CodeMirror 6 Editor       │            │
  │   └─────────────┬─────────────┘         └─────────────┬─────────────┘            │
  │                 │                                     │                          │
  │                 ▼                                     ▼                          │
  │   ┌─────────────────────────────────────────────────────────────────┐            │
  │   │  Client-Side Ajv Validation Engine (Canonical A2A v1.0 Schema)  │            │
  │   └─────────────────────────────┬───────────────────────────────────┘            │
  └─────────────────────────────────┼────────────────────────────────────────────────┘
                                    │ Server-Side Inspection Calls
                                    ▼
                          BACKEND (Cloudflare Worker)
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                  │
  │   Public APIs (SSRF-Guarded & Edge Rate-Limited):                                │
  │   • POST /public/tools/validate-url       (Live probe: HTTP, SSL, CORS, JWS)     │
  │   • POST /public/tools/validate-json      (Ajv server-side compliance check)     │
  │   • POST /public/tools/convert/openapi    (OpenAPI 3.x → A2A Card converter)     │
  │   • POST /public/tools/convert/mcp        (Anthropic MCP → A2A Card converter)   │
  │                                                                                  │
  │   Private User APIs (Session Auth):                                              │
  │   • GET/POST/PUT /api/tools/drafts        (Cloud draft storage in D1)            │
  │   • GET/DELETE   /api/tools/drafts/:id    (Single draft operations)              │
  │   • GET/POST     /api/tools/drafts/:id/versions (Snapshots & jsondiffpatch)      │
  │                                                                                  │
  └──────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Multi-Layer SSRF Protection & Edge Rate Limiting

#### A. SSRF Guardrails for `/public/tools/validate-url` & Importers:
1. **Scheme & Host Sanitization**: Enforce `http:` / `https:`. Block `localhost`, `127.0.0.1`, `::1`, and loopback ranges.
2. **Post-DNS Private IP Blocklist**: Reject RFC 1918 addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), Carrier-Grade NAT (`100.64.0.0/10`), and Cloudflare internal metadata services.
3. **Execution Limits**:
   * Request timeout: 6,000ms.
   * Maximum stream response size: 10KB (enforces spec card cap; drops immediately if larger).
   * Maximum 3 HTTP redirects followed.

#### B. Edge Rate Limiting (Cloudflare WAF / Edge Rules):
* `POST /public/tools/validate-url`: **10 requests / minute per IP** (expensive network probe).
* `POST /public/tools/validate-json`: **60 requests / minute per IP** (lightweight CPU validation).
* `POST /public/tools/convert/*`: **20 requests / minute per IP**.

### 7.3 Data Storage Model (Database Migration `0028_agent_card_drafts.sql`)

```sql
-- Migration: 0028_agent_card_drafts.sql
-- Drafts created in the builder
CREATE TABLE IF NOT EXISTS `agent_card_drafts` (
    `id` text PRIMARY KEY,
    `user_id` text NOT NULL,
    `org_id` text,
    `name` text NOT NULL,
    `package_name` text,
    `card_data` text NOT NULL, -- JSON blob (max 10KB checked at API layer)
    `is_shared` integer NOT NULL DEFAULT 0, -- 0 = private to author, 1 = shared with org members
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_drafts_user` ON `agent_card_drafts` (`user_id`, `updated_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_drafts_org` ON `agent_card_drafts` (`org_id`, `is_shared`, `updated_at` DESC);

-- Version history for drafts and existing agent cards
CREATE TABLE IF NOT EXISTS `agent_card_versions` (
    `id` text PRIMARY KEY,
    `draft_id` text,
    `agent_id` text,
    `user_id` text NOT NULL,
    `version_tag` text,
    `card_data` text NOT NULL,
    `changelog` text,
    `created_at` integer NOT NULL,
    FOREIGN KEY (`draft_id`) REFERENCES `agent_card_drafts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_versions_draft` ON `agent_card_versions` (`draft_id`, `created_at` DESC);
CREATE INDEX IF NOT EXISTS `idx_versions_agent` ON `agent_card_versions` (`agent_id`, `created_at` DESC);

-- Quota enforcement triggers (atomic; no application-level race condition possible)
-- User quota: max 20 drafts per user
CREATE TRIGGER IF NOT EXISTS `enforce_user_draft_quota`
BEFORE INSERT ON `agent_card_drafts`
BEGIN
  SELECT RAISE(ABORT, 'user_quota_exceeded')
  WHERE (SELECT COUNT(*) FROM `agent_card_drafts`
         WHERE `user_id` = NEW.`user_id`) >= 20;
END;

-- Org quota: max 50 drafts per org (counts all drafts regardless of is_shared)
CREATE TRIGGER IF NOT EXISTS `enforce_org_draft_quota`
BEFORE INSERT ON `agent_card_drafts`
BEGIN
  SELECT RAISE(ABORT, 'org_quota_exceeded')
  WHERE NEW.`org_id` IS NOT NULL
    AND (SELECT COUNT(*) FROM `agent_card_drafts`
         WHERE `org_id` = NEW.`org_id`) >= 50;
END;
```

---

## 8. Detailed Implementation Roadmap & Task Lists

The implementation is broken into **5 distinct, fully-specified phases** with zero feature gaps:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION ROADMAP OVERVIEW                       │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ Phase 1 (MVP) │ A2A v1.0 Validator Engine, Public UI & CLI Package          │
│ Phase 2       │ Dual-Pane Builder (CodeMirror 6), Templates & Hosting Guides│
│ Phase 3       │ Schema-Aware OpenAPI 3.x & Anthropic MCP Converters         │
│ Phase 4       │ Team Console Workspace, D1 Drafts & Claimed Agent Sync      │
│ Phase 5       │ BYOK AI Copilot (Spec-Anchored Magic Draft & Auto-Fix)      │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Core Validator Engine, Public UI & CLI Package (MVP)

*Goal: Deliver instant A2A v1.0 compliance testing via web portal and standalone CLI.*

#### 1.1 Backend Service & APIs
- [ ] **A2A v1.0 Schema Engine (`backend/src/services/validator.ts`)**:
  - [ ] Embed canonical A2A v1.0 JSON Schema (Draft 2020-12) using Ajv. **Important**: import `Ajv2020` from `ajv/dist/2020` — the default `Ajv` class targets Draft 7 and will silently fail to validate Draft 2020-12 keywords (`$dynamicRef`, `prefixItems`).
    ```typescript
    import Ajv2020 from "ajv/dist/2020";
    const ajv = new Ajv2020({ allErrors: true });
    ```
  - [ ] Implement Tier 1 structural validation: `name`, `description`, `version`, `supportedInterfaces`, `capabilities` (validating `extensions[]` objects `{ uri, description?, required?, params? }`), `defaultInputModes`, `defaultOutputModes`, `skills` (with required `tags` array and optional `inputModes`/`outputModes`/`examples`/`securityRequirements`).
  - [ ] Implement v0.3 legacy format detector covering all four migration categories (structural, enum values, Part `kind` discriminator, and top-level `supportsAuthenticatedExtendedCard`).
  - [ ] Enforce 10KB payload limit.
- [ ] **Tier 2 Network & Tier 4 Trust Probers**:
  - [ ] Implement live HTTP/HTTPS probe with CORS header analysis.
  - [ ] Implement JWS signature verification using the **`jose`** library ([panva/jose](https://github.com/panva/jose)) — runs natively on Cloudflare Workers without Node.js crypto dependencies. For JCS canonicalization (RFC 8785) use the **`json-canonicalize`** package (the RFC 8785 reference implementation by Erdtman/cyberphone — use this, not the generic `canonicalize` package which has known RFC 8785 deviations). The full verification flow:
    1. Remove the `signatures` field from the card JSON object.
    2. Apply JCS canonicalization via `jsonCanonicalizer(cardWithoutSignatures)` to produce the deterministic payload bytes.
    3. For each entry in `signatures[]`, base64url-decode `protected`, extract `alg`, `kid`, and `jku` (or inline `jwk`).
    4. Fetch the JWKS from `jku` (over HTTPS only) or read inline `jwk`, locate the key by `kid`.
    5. Verify using `jose`'s `flattenedVerify` with the **`detachedPayload`** option — the A2A card uses a detached-payload JWS shape where the payload sits outside the signature object:
    ```typescript
    import { flattenedVerify } from "jose";
    import canonicalize from "json-canonicalize";

    const payload = new TextEncoder().encode(canonicalize(cardWithoutSignatures));
    await flattenedVerify(
      { protected: sig.protected, signature: sig.signature, header: sig.header },
      publicKey,
      { detachedPayload: payload }
    );
    ```
  - [ ] Integrate DNS TXT (`_a2a.<domain>`) and GoDaddy ANS (`a2a://`) verification.
- [ ] **Security & Guardrails**:
  - [ ] Implement SSRF validator utility (`backend/src/utils/ssrf.ts`) with post-DNS IP checks.
  - [ ] Implement edge rate limits (10 req/min for URL, 60 req/min for JSON).
- [ ] **Public Endpoints (`backend/src/routes/tools.ts`)**:
  - [ ] `POST /public/tools/validate-url`
  - [ ] `POST /public/tools/validate-json`

#### 1.2 Portal Frontend UI (`portal/src/app/tools/validator/page.tsx`)
- [ ] Tabbed input interface: **Live URL Inspection** (with ANS sub-tab) vs. **Direct JSON Paste / File Drop**.
- [ ] Circular / Score Gauge (0–100%) with context-aware scoring (no penalty for offline JSON).
- [ ] Grouped Diagnostic Findings Accordion (Schema, Network/CORS, Discovery, JWS/Trust).
- [ ] Direct Action Buttons: **"Open in Builder & Fix"** and **"Publish to Registry"** CTA.

#### 1.3 Standalone CLI Package (`packages/a2a-validate`)
The validator logic must be split into a **shared core** that runs in both the Cloudflare Worker and Node.js (CLI) environments:

- **`packages/core/validator/`** — Pure TypeScript module with zero runtime-specific dependencies. Contains Tier 1 (Ajv schema) and Tier 3 (semantic) checks. Uses the standard `fetch` API for Tier 2 network probing (available in both Node 18+ and Cloudflare Workers). Tier 4 DNS resolution differs by runtime — expose a pluggable `dnsResolver` interface so Workers can use Cloudflare's DNS-over-HTTPS and Node can use the `dns` module.
- **`backend/src/services/validator.ts`** — Imports from `packages/core/validator/` and wires in the Workers `dnsResolver`.
- **`packages/a2a-validate/`** — CLI wrapper that imports from `packages/core/validator/`, wires in the Node `dnsResolver`, and provides the CLI interface.

- [ ] Extract pure validation logic into `packages/core/validator/` with a `dnsResolver` interface.
- [ ] Implement Node.js `dnsResolver` adapter using the `dns/promises` module.
- [ ] Build CLI entry point: `npx @a2a-registry/validate <url-or-file>`.
- [ ] Support human-readable and machine-readable output (`--format=json`, `--fail-on=warning`, `--fail-on=error`).
- [ ] Publish to npm under `@a2a-registry/validate`.

---

### Phase 2: Dual-Pane Agent Card Builder & Deployment Guides

*Goal: Enable effortless v1.0 card generation with visual controls, CodeMirror 6, and deployment recipes.*

#### 2.1 Builder UI & Form Components (`portal/src/app/tools/builder/page.tsx`)
- [ ] **Visual Form Sections**:
  - [ ] **Identity**: Name, Description, SemVer, Icon URL, Docs URL, Provider (Organization name + URL), Reverse-DNS Package Name (*Registry Extension*).
  - [ ] **Supported Interfaces List**: Multi-row editor for `supportedInterfaces` with `url`, `protocolBinding` (presets for `JSONRPC`, `GRPC`, `HTTP+JSON` plus custom URI input with autocomplete), `protocolVersion` (`1.0`), and optional `tenant`. Support drag-to-reorder for preferred interface.
  - [ ] **Capabilities**: Toggle switches for `streaming`, `pushNotifications`, and `extendedAgentCard`. Sub-editor for `extensions[]` array (`AgentExtension` objects with `uri`, `description`, `required`, `params`).
  - [ ] **Input & Output Modes**: Multi-select for `defaultInputModes` and `defaultOutputModes`.
  - [ ] **Skills Editor**: Dynamic list with `id`, `name`, `description`, **`tags` (required string array)**, per-skill `inputModes`/`outputModes` (MIME type multi-select), `examples` (prompt list), and optional per-skill `securityRequirements`. No `inputSchema`/`outputSchema` fields — not part of v1.0 spec.
  - [ ] **Security Schemes & Requirements**: Named `securitySchemes` map editor and card-level `securityRequirements` array.
  - [ ] **Signatures**: JWS signature attachment section (see JWS generation scope note below).
- [ ] **CodeMirror 6 Integration**:
  - [ ] Integrate using official `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-json`, and `@codemirror/lint` packages with a React `useEffect`/`useRef` wrapper. Do not introduce community wrappers.
  - [ ] Bi-directional sync with 300ms debounce and active-focus locking.
  - [ ] Non-destructive syntax error banner when raw JSON is invalid mid-typing.
- [ ] **Export Options**: One-click Copy, Download `agent-card.json`, and instant "Run Validator" trigger.

> **JWS Signature Generation Scope Note**: Client-side signing uses the browser's native **WebCrypto API** — the private key is imported as non-extractable (`extractable: false`) and never leaves the browser. The recommended algorithm is **ES256** (ECDSA P-256). The generated signature requires a JWKS endpoint hosting the matching public key, referenced via the `jku` header in `signatures[].protected` (or inline `jwk`). The builder generates the signature and the corresponding JWKS JSON for download, but **JWKS hosting is the developer's responsibility** — the builder provides clear instructions and a hosting guide (e.g. serve from `https://yourdomain.com/.well-known/jwks.json`). Registry-managed JWKS hosting is out of scope for Phase 2 and tracked as a future enhancement.

#### 2.2 Template Library & Hosting Snippet Generator
- [ ] **v1.0 Templates**: Utility Agent (JSON-RPC), Multi-Tenant Enterprise Agent (gRPC), Assistant (Streaming), and MCP Wrapper.
- [ ] **Tabbed Hosting Guides (`/tools/builder/hosting`)**:
  - [ ] Next.js App Router (`app/.well-known/agent-card.json/route.ts`).
  - [ ] Cloudflare Workers (`wrangler.jsonc` + route handler).
  - [ ] Python FastAPI (`@app.get("/.well-known/agent-card.json")`).
  - [ ] Express.js Node (`app.get('/.well-known/agent-card.json')`).
  - [ ] gRPC Python/Go service configuration.
  - [ ] Nginx / Apache CORS rewrite configuration.

---

### Phase 3: Converters & Importers (OpenAPI 3.x & Anthropic MCP)

*Goal: Enable seamless 1-click import from existing OpenAPI and MCP configurations.*

#### 3.1 Converter Engines & Backend Endpoints
- [ ] **OpenAPI 3.0/3.1 Converter (`backend/src/services/converters/openapi.ts`)**:
  - [ ] Implement schema dereferencing using **`@apidevtools/json-schema-ref-parser`** — handles cross-file `$ref`, circular references, YAML OpenAPI specs, and both local and remote file references. Call `.dereference()` before processing `paths`.
  - [ ] Normalize schema differences between OpenAPI versions: OAS 3.0 uses `nullable: true` alongside a type; OAS 3.1 uses `type: ["string", "null"]`. The converter must normalize both patterns to JSON Schema Draft 2020-12 style (`type: ["string", "null"]`) where parameter schemas are surfaced in skill `description` and `examples`.
  - [ ] Transform `paths` and HTTP verbs into A2A `skills[]` with auto-generated `tags`, `inputModes`/`outputModes` derived from request/response content types, and `examples` synthesized from operation summaries.
  - [ ] Map `servers[].url` entries to `supportedInterfaces` (default to `HTTP+JSON` binding).
  - [ ] Treat conversion as **best-effort draft output** that the developer refines in the builder — document this clearly in the UI.
- [ ] **Anthropic MCP Converter (`backend/src/services/converters/mcp.ts`)**:
  - [ ] Ingest `claude_desktop_config.json` or MCP manifests.
  - [ ] Map MCP tools, descriptions, and input type hints to A2A skills (`tags`, `inputModes`, `examples`).
- [ ] **Endpoints**:
  - [ ] `POST /public/tools/convert/openapi` (accepts raw JSON or SSRF-guarded URL).
  - [ ] `POST /public/tools/convert/mcp` (accepts JSON payload).

#### 3.2 Importer UI Integration
- [ ] Add "Import" modal in Builder with OpenAPI and MCP tabs.
- [ ] Visual diff preview before merging imported skills into the current builder form.

---

### Phase 4: Authenticated Console Workspace, D1 Drafts & Agent Sync

*Goal: Provide a persistent, collaborative cloud workspace for teams and agent authors.*

#### 4.1 Database Migration & Backend APIs
- [ ] **D1 Migration (`backend/migrations/0028_agent_card_drafts.sql`)**:
  - [ ] Create `agent_card_drafts` (with `is_shared` flag) and `agent_card_versions` tables.
- [ ] **Draft Management APIs (`backend/src/routes/drafts.ts`)**:
  - [ ] **Quota enforcement via SQLite trigger** (not application-level SELECT+INSERT, which has a race condition under concurrent autosave). Add the following triggers to the migration — SQLite enforces them atomically inside its write lock:
    ```sql
    -- Enforced in: 0028_agent_card_drafts.sql
    CREATE TRIGGER IF NOT EXISTS enforce_user_draft_quota
    BEFORE INSERT ON agent_card_drafts
    BEGIN
      SELECT RAISE(ABORT, 'user_quota_exceeded')
      WHERE (SELECT COUNT(*) FROM agent_card_drafts
             WHERE user_id = NEW.user_id) >= 20;
    END;

    CREATE TRIGGER IF NOT EXISTS enforce_org_draft_quota
    BEFORE INSERT ON agent_card_drafts
    BEGIN
      SELECT RAISE(ABORT, 'org_quota_exceeded')
      WHERE NEW.org_id IS NOT NULL
        AND (SELECT COUNT(*) FROM agent_card_drafts
             WHERE org_id = NEW.org_id) >= 50;
    END;
    ```
    The API layer catches the `SQLITE_CONSTRAINT_TRIGGER` error and returns HTTP 429. Note: the org trigger counts **all** drafts in the org regardless of `is_shared` state — org members share a single pool of 50 slots.
  - [ ] CRUD endpoints (`GET/POST/PUT/DELETE /api/tools/drafts`).
  - [ ] `GET/POST /api/tools/drafts/:id/versions` for revision snapshots.

#### 4.2 Console UI Integration (`portal/src/app/console/tools/...`)
- [ ] Add **"Card Studio & Drafts"** to console navigation sidebar.
- [ ] **Drafts Dashboard**: Grid/list with search, team sharing toggle (`is_shared`), and health badge.
- [ ] **Visual Revision History**: Field-by-field diff viewer powered by `jsondiffpatch`.
- [ ] **Claimed Agent Sync**: 1-click loading from owned registry agents and "Deploy & Publish" sync.

---

### Phase 5: BYOK AI Copilot (Spec-Anchored Generation & Auto-Fix)

*Goal: Supercharge authoring and quality with zero platform token burn.*

#### 5.1 Shared BYOK Infrastructure
- [ ] Extract reusable API Key Selector from `/playground`: `portal/src/components/byok/api-key-selector.tsx`.
- [ ] Implement client AI runner supporting OpenAI and Google Gemini with JSON mode.
- [ ] System prompt spec-anchoring: Inject full A2A v1.0 JSON Schema into context.

#### 5.2 AI Capabilities Integration
- [ ] **"Magic Draft" Modal**: Text-to-AgentCard generator in the Builder.
- [ ] **Skill Prompt Enricher**: "✨ Enrich Prompts" button generating 3–5 diverse semantic search variations per skill.
- [ ] **1-Click AI Auto-Fixer**: "✨ Fix with AI" action on Validator diagnostic report items.
- [ ] Anonymous teaser banner encouraging sign-in and BYOK key configuration.

---

## 9. Global Navigation & Information Architecture

1. **Main Header Dropdown (`portal/src/components/header.tsx`)**:
   * **Tools Dropdown**:
     * 🛠️ **Agent Card Builder** (`/tools/builder`)
     * 🔍 **Manifest Validator** (`/tools/validator`)
     * 📖 **A2A v1.0 Spec Explorer** (`/resources/spec`)
2. **Console Sidebar (`portal/src/app/console/layout.tsx`)**:
   * **Card Studio & Drafts** (`/console/tools/builder` and `/console/tools/drafts`).
3. **Submit / Ingestion Flow (`portal/src/app/submit/page.tsx`)**:
   * Banner: *"Need help creating a card? Open in Card Builder"*.
   * Validation failure fallback: Instant *"Inspect & Fix in Validator"* link.

---

## 10. Open Discussion & Decisions

1. **CLI Distribution Channel**:  
   * Publish `@a2a-registry/validate` on npm under the registry org so developers can run `npx @a2a-registry/validate https://my-agent.com` in CI/CD without installing dependencies.
2. **Team Sharing Defaults**:  
   * `is_shared` defaults to `0` (private to the author), consistent with the DB schema `DEFAULT 0`. Developers explicitly toggle sharing to make a draft visible to all org members. The UI toggle is labelled *"Share with organization"* and is off by default.
