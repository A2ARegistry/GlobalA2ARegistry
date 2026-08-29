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
- **`@a2a-registry/validate` CLI**: A standalone, zero-dependency npm package for CI/CD pipelines.

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
| **`capabilities`** | **Required** | Object declaring features. Valid boolean fields per v1.0 spec: `streaming`, `pushNotifications`, `extendedAgentCard`. Also accepts an `extensions` array of `AgentExtension` objects. No other fields (e.g. `stateTransitionHistory`) exist in the canonical schema. |
| **`defaultInputModes`** | **Required** | Array of MIME/modality types (`text`, `application/json`, `audio`, etc.). |
| **`defaultOutputModes`** | **Required** | Array of MIME/modality types (`text`, `application/json`, etc.). |
| **`skills`** | **Required** | Array of `AgentSkill` objects. Each skill **must** include `id`, `name`, `description`, and `tags` (array). |
| **`provider`** | Optional | `AgentProvider` object with required sub-fields `organization` (string) and `url` (string). Displayed by registries and orchestrators as a trust signal. |
| **`securitySchemes`** | Optional | `map<string, SecurityScheme>` declaring named auth schemes (`apiKey`, `bearer`, `oauth2`, `openIdConnect`, `mutualTls`). Required if any skill or the card itself declares `securityRequirements`. |
| **`securityRequirements`** | Optional | `array of SecurityRequirement` referencing schemes from `securitySchemes`. Declares that callers must authenticate before any task interaction. |
| **`signatures`** | Optional | Array of `AgentCardSignature` objects (JWS RFC 7515 + JCS RFC 8785). |
| **`iconUrl`** / **`documentationUrl`** | Optional | Metadata URLs for rich directory rendering. |
| **`package_name`** | *Registry Extension* | Reverse-DNS identifier (`org.domain.agent`). Highlighted as a Registry Recommended Best Practice. |

### 4.2 `supportedInterfaces` Multi-Protocol Architecture

The v1.0 specification replaces legacy single `url`/`preferredTransport` fields with an ordered interface array. The first interface is treated as the agent's preferred transport:

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
    }
  ]
}
```

### 4.3 JWS Cryptographic Signatures (`AgentCardSignature`)

To protect against Man-in-the-Middle (MitM) attacks and unauthorized card tampering, v1.0 specifies `signatures`:
* **Canonicalization**: Pre-signature payload canonicalized using **JCS (RFC 8785)**.
* **Signature Encoding**: Signed using **JWS (RFC 7515)**.
* **Verification**: Validator verifies the JWS signature header and public key against the agent's identity.

### 4.4 Maximum Payload Size Constraint

Per Linux Foundation and Google Cloud Agent Registry standards, `agent-card.json` payload size is strictly capped at **10KB**. Both the Builder and D1 backend enforce this limit.

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
   * Ingests raw API code or unformatted documentation and extracts structured A2A `skills` with parameter schemas.

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
   * **Identity & Metadata**: Name, Description, SemVer Version, Icon URL, Documentation URL, Provider (Organization name + URL), Reverse-DNS Package Name (*Registry Extension*).
   * **Interfaces & Transports (`supportedInterfaces`)**: Multi-row list editor for declaring endpoints with Protocol Binding (`JSONRPC`, `GRPC`, `HTTP+JSON`), Protocol Version (`1.0`), URL (`https://...` for HTTP-based bindings or `hostname:port` for gRPC — no `https://` scheme prefix for gRPC), and optional `tenant` ID. Drag to reorder preference.
   * **Capabilities**: Boolean switches for `streaming`, `pushNotifications`, and `extendedAgentCard` (the only three boolean capability fields defined in the v1.0 spec). Custom extension URIs can be added via the `extensions` array sub-editor.
   * **I/O Modalities**: Required multi-select for `defaultInputModes` and `defaultOutputModes` (`text`, `application/json`, `audio`, `image`, `video`).
   * **Skills & Tools Editor**: Add/edit nested skills with ID, Name, Description, **Tags (required array)**, Input Parameters Schema, Example Prompts, and optional per-skill `securityRequirements` (advanced section).
   * **Security Schemes & Requirements**: Named `securitySchemes` map editor (`apiKey`, `bearer`, `oauth2`, `openIdConnect`, `mutualTls`) and card-level `securityRequirements` array referencing declared scheme names. Validator warns if a scheme is referenced in requirements but not declared here.
   * **Signatures**: JWS signature attachment section (see Section 4.3 and Phase 2 notes for scope).
2. **Code Mode with CodeMirror 6**:
   * Use the official `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-json`, and `@codemirror/lint` packages directly with a thin React `useEffect`/`useRef` integration — avoid third-party wrappers (e.g. `@uiw/react-codemirror`) to prevent coupling to non-official release cycles.
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
  * Employs a JSON Schema dereferencer (`$ref` resolution) to convert OpenAPI `paths` into A2A `skills[]` with input schemas.
* **Anthropic MCP Config Importer**:
  * Ingests `claude_desktop_config.json` or MCP manifests, mapping tool definitions directly to A2A skill structures.

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
* **Team Sharing (`is_shared`)**: Toggle drafts between private and organization-wide visibility.
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
   * Verifies required fields: `name`, `description`, `version`, `supportedInterfaces` (array), `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills` (with required `tags`).
   * **Interface URL format enforcement**: For interfaces with `protocolBinding: "GRPC"`, validates the URL as `hostname:port` (no `https://` scheme prefix). For `JSONRPC` and `HTTP+JSON`, validates as an absolute HTTPS URL. A gRPC URL lacking a port or containing an `https://` scheme is flagged as a Tier 1 error.
   * **v0.3 vs v1.0 Format Detector**: Checks all four categories of v0.3→v1.0 breaking changes and surfaces targeted migration hints:
     - *Structural*: Legacy flat `url` or `preferredTransport` top-level fields → *"Detected v0.3 card — migrate to `supportedInterfaces[]`"*.
     - *Enum values*: `role: "user"` / `"agent"` (should be `"ROLE_USER"` / `"ROLE_AGENT"`); `state: "completed"` style kebab/lowercase values (should be `TASK_STATE_*` SCREAMING_SNAKE_CASE).
     - *Part discriminator*: `{"kind": "text", ...}` pattern inside any embedded `history` or example fields → *"Legacy `kind` discriminator detected — use member-based discrimination"*.
     - *Capability location*: `supportsAuthenticatedExtendedCard: true` at top level → *"Move to `capabilities.extendedAgentCard`"*.

2. **Tier 2: Network, Security & Hosting Protocol (Live URL Mode)**
   * **HTTP Status**: Returns `200 OK`.
   * **HTTPS Enforcement**: Production endpoints must use valid TLS/SSL certificates.
   * **MIME Content-Type**: Must return `application/json` or `application/problem+json`.
   * **CORS Compliance**: Response header inspection for `Access-Control-Allow-Origin: *`.
   * **Latency & Size**: Response time < 1500ms; payload < 10KB.

3. **Tier 3: Discovery & Semantic Quality Audit**
   * **Reverse-DNS Package Identifier**: Checks format against registry recommendation conventions.
   * **Skill Prompt Richness**: Flags skills lacking natural example prompts.
   * **Taxonomy Normalization**: Validates `category` and `target_audience` against registry index vocabularies.
   * **OpenAPI Reachability**: If `openapi_url` is declared, tests accessibility.
   * **Security Scheme Consistency**: Warns if any `securityRequirements` entry (card-level or per-skill) references a scheme name not defined in `securitySchemes`, or if `securityRequirements` is present but `securitySchemes` is empty/absent.

4. **Tier 4: Cryptographic Trust & Verification**
   * **JWS Signature Verification**: Validates `signatures[]` against JWS (RFC 7515) and JCS (RFC 8785) standards.
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
  - [ ] Implement Tier 1 structural validation: `name`, `description`, `version`, `supportedInterfaces`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, `skills` (with required `tags`).
  - [ ] Implement v0.3 legacy format detector covering all four migration categories (structural, enum values, Part `kind` discriminator, and top-level `supportsAuthenticatedExtendedCard`).
  - [ ] Enforce 10KB payload limit.
- [ ] **Tier 2 Network & Tier 4 Trust Probers**:
  - [ ] Implement live HTTP/HTTPS probe with CORS header analysis.
  - [ ] Implement JWS signature verification using the **`jose`** library ([panva/jose](https://github.com/panva/jose)) — it runs natively on Cloudflare Workers without Node.js crypto dependencies. For JCS canonicalization (RFC 8785) apply the **`canonicalize`** package before constructing the JWS payload. The verification flow is:
    1. Remove the `signatures` field from the card JSON object.
    2. Apply JCS canonicalization via `canonicalize(cardWithoutSignatures)` to produce the deterministic payload string.
    3. For each entry in `signatures[]`, base64url-decode `protected`, extract `alg`, `kid`, and `jku`.
    4. Fetch the JWKS from `jku` (over HTTPS only), locate the key by `kid`.
    5. Verify using `jose`'s `flattenedVerify` with the canonical payload as the JWS payload bytes.
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
The validator logic must be split into a **shared core** that runs in both the Cloudflare Worker and Node.js (CLI) environments. The correct architecture:

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
  - [ ] **Supported Interfaces List**: Multi-row editor for `supportedInterfaces` with `url`, `protocolBinding` (`JSONRPC`, `GRPC`, `HTTP+JSON`), `protocolVersion` (`1.0`), and `tenant`. Support drag-to-reorder for preferred interface.
  - [ ] **Capabilities**: Toggle switches for `streaming`, `pushNotifications`, and `extendedAgentCard`. Sub-editor for `extensions[]` array (AgentExtension objects with `uri`, `description`, `required`).
  - [ ] **Input & Output Modes**: Multi-select for `defaultInputModes` and `defaultOutputModes`.
  - [ ] **Skills Editor**: Dynamic list with ID, Name, Description, **Tags (required string array)**, JSON Schema parameter builder, Example Prompts, and an optional advanced section for per-skill `securityRequirements` (referencing scheme names from the card-level `securitySchemes` map).
  - [ ] **Security Schemes & Requirements**: Named `securitySchemes` map editor and card-level `securityRequirements` array.
  - [ ] **Signatures**: JWS signature attachment section (see JWS generation scope note in Phase 2 notes below).
- [ ] **CodeMirror 6 Integration**:
  - [ ] Integrate using official `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-json`, and `@codemirror/lint` packages with a React `useEffect`/`useRef` wrapper. Do not introduce `@uiw/react-codemirror` or other community wrappers.
  - [ ] Bi-directional sync with 300ms debounce and active-focus locking.
  - [ ] Non-destructive syntax error banner when raw JSON is invalid mid-typing.
- [ ] **Export Options**: One-click Copy, Download `agent-card.json`, and instant "Run Validator" trigger.

> **JWS Signature Generation Scope Note**: Client-side signing uses the browser's native **WebCrypto API** — the private key is imported as non-extractable (`extractable: false`) and never leaves the browser. The recommended algorithm is **ES256** (ECDSA P-256). The generated signature requires a JWKS endpoint hosting the matching public key, referenced via the `jku` header in `signatures[].protected`. The builder generates the signature and the corresponding JWKS JSON for download, but **JWKS hosting is the developer's responsibility** — the builder provides clear instructions and a hosting guide (e.g. serve from `https://yourdomain.com/.well-known/jwks.json`). Registry-managed JWKS hosting is out of scope for Phase 2 and tracked as a future enhancement.

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
  - [ ] Normalize schema differences between OpenAPI versions: OAS 3.0 uses `nullable: true` alongside a type; OAS 3.1 uses `type: ["string", "null"]`. The converter must normalise both patterns to JSON Schema Draft 2020-12 style (`type: ["string", "null"]`) for A2A skill parameter schemas.
  - [ ] Transform `paths` and HTTP verbs into A2A `skills[]` with JSON Schema parameters and auto-generated tags.
  - [ ] Map `servers[].url` entries to `supportedInterfaces` (default to `HTTP+JSON` binding).
  - [ ] Treat conversion as **best-effort draft output** that the developer refines in the builder — document this clearly in the UI.
- [ ] **Anthropic MCP Converter (`backend/src/services/converters/mcp.ts`)**:
  - [ ] Ingest `claude_desktop_config.json` or MCP manifests.
  - [ ] Map MCP tools, descriptions, and input schemas to A2A skills.
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
  - [ ] **Atomic quota check** using D1's `db.batch()` API, which wraps multiple statements in a single SQLite transaction. D1 does not support `SELECT FOR UPDATE`, so `batch()` is the correct mechanism to avoid race conditions under concurrent autosave requests:
    ```typescript
    const [countRow] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS n FROM agent_card_drafts WHERE user_id = ?`).bind(userId),
    ]);
    if ((countRow.results[0] as any).n >= QUOTA) throw new QuotaExceededError();
    await db.prepare(`INSERT INTO agent_card_drafts ...`).bind(...).run();
    ```
    Apply the same pattern for org-level quota (`org_id` + `is_shared = 1`).
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
   * `is_shared` defaults to `0` (private to the author), consistent with the DB schema `DEFAULT 0`. Developers explicitly toggle sharing to make a draft visible to all org members. This is the safer default — auto-sharing drafts org-wide on save is a data-leak footgun. The UI toggle is labelled *"Share with organization"* and is off by default.
