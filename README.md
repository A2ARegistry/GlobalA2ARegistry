# Global A2A Registry

> **The public, open, community-driven directory for AI agents built on the [Agent-to-Agent (A2A) Protocol](https://a2a-protocol.org/).**

🌐 **Live Portal:** [https://www.a2a-registry.org](https://www.a2a-registry.org)

---

## What Is the Global A2A Registry?

The **Global A2A Registry** is a free, open registry where developers, businesses, and researchers can **register**, **discover**, and **verify** AI agents. It is the authoritative global directory for agents implementing the [A2A Protocol](https://a2a-protocol.org/) — an open standard that allows AI agents to communicate, negotiate, and transact autonomously across the web.

Think of it as the **"DNS for AI agents"**: just as DNS maps human-readable domain names to IP addresses, the A2A Registry maps agent names to their capabilities, endpoints, and verified identities.

The registry is **free to use, open for everyone, and community-driven**.

---

## ✨ Major Features

### � 1. Agent Discovery
Browse a public, searchable directory of registered AI agents. Filter by **category**, **target audience**, **verification level**, and more. The registry exposes a public `/browse` interface and a machine-readable A2A discovery API so that other agents can autonomously locate and connect to the agents they need.

### 🏢 2. Organization Management
Create and manage **Personal** or **Business** organizations directly in the [Developer Console](https://www.a2a-registry.org/console). Organizations act as namespaces for your registered agents, keeping them grouped under a single verified identity.

### 🛡️ 3. Domain Verification (DNS-Based)
**Businesses** can verify ownership of their domain by adding a TXT DNS record (`a2a-registry-verify=<token>`). Once verified, all agents published under that domain are marked as **DNS Verified**, establishing trust across the network. Domain verification also supports:

- **GoDaddy ANS (Agent Name Service):** Instant verification for domains already registered with GoDaddy's ANS, using `_agent.<domain>` TXT records.
- **Domain transfer:** If a domain verification is successful and the domain was previously owned by another organization, ownership is securely transferred and all parties are notified.

### 🐙 4. GitHub-Based Verification (for Individual Developers)
Individual developers can connect their **GitHub account** to verify their identity. Agents published under a GitHub-verified identity are shown with a personal developer badge, building trust without requiring a business domain.

### 📦 5. Agent Registration & Lifecycle Management
Register new agents and manage their full lifecycle:
- Define agent **capabilities**, **endpoints**, **categories**, and **target audiences**.
- Publish agents as public, unlisted, or private.
- Update agent metadata at any time through the console.
- Manage **API keys** and **API tokens** for programmatic access.

### 🤖 6. A2A Protocol Endpoints (Machine-to-Machine)
The registry exposes standardized **A2A discovery and utility endpoints** (`/a2a/discover`, `/a2a/utility`) that other AI agents and automated systems can call to:
- Search for agents by capability or category.
- Retrieve verified agent card metadata.
- Perform utility operations within the A2A protocol specification.

These endpoints require **API token authentication**, enabling secure machine-to-machine interactions.

### 🧪 7. Playground — Live Agent Testing
The [Playground](https://www.a2a-registry.org/playground) lets users **test agent interactions in real-time**. Key features:
- Run live discovery queries against the registry from within a session.
- Send prompts to agents and inspect their responses.
- Supports **BYOK (Bring Your Own Key)** for OpenAI, Gemini, or use the built-in registry AI.
- The playground backend uses **Cloudflare Durable Objects** for stateful session management.

### 🤖 8. The Mega Agent — Registry as a Single Contact Point
See the **[dedicated section below](#-the-registry-mega-agent--your-single-contact-point)** for full details. In short: the Registry exposes itself as an A2A-protocol-compliant agent so other agents can call it directly to discover, select, and chain to any registered agent — **without hardcoding any endpoints in your business logic**.

### 📰 9. Industry Insights
The landing page surfaces **curated A2A ecosystem news and best practices**, powered by the Content Growth API. Stay informed on A2A trends, new protocol developments, and community announcements without leaving the portal.

### 📬 10. Newsletter & Community Feedback
A built-in **newsletter subscription** and **feedback widget** on the landing page allow community members to stay updated and help shape the registry's future.

---

## 🤖 The Registry Mega Agent — Your Single Contact Point

> **The A2A Registry is itself a fully A2A-compliant agent.** Instead of discovering agents manually, browsing a directory, and hardcoding endpoints, you can point your AI system at a single URL — the Registry Agent — and let it handle everything automatically.

### How It Works

The Registry publishes its own **Agent Card** at:
```
https://www.a2a-registry.org/.well-known/agent-card.json
```
This makes the Registry a first-class citizen of the A2A ecosystem — just another agent that any other agent can discover and call.

### The Autonomous ReAct Loop

When another AI system (or the built-in Playground Executor) uses the Registry Agent, it runs a **ReAct (Reason → Act → Observe)** loop:

```
1. THINK:  LLM analyzes user intent and decides which agent to call next
2. ACT:    Call the Registry Agent with a natural language query
3. OBSERVE: Registry returns a ranked list of matching agents
4. THINK:  LLM selects the best match from results
5. ACT:    Call the selected agent with the task payload
6. OBSERVE: Get result, decide if task is done or if more calls are needed
7. REPEAT until complete or limit reached
```

### Core Capability of the Registry Agent

The Registry Agent exposes **one primary capability** for other agents to call:

| Capability | Endpoint | Description |
|---|---|---|
| `search_agents` | `POST /a2a/discover` | Natural language semantic search across all registered agents. Combines **vector embeddings + keyword matching** and returns a ranked list with agent cards. |

> **Tip:** The `search_agents` endpoint is all your agent needs. Once it discovers the right agents, it calls them directly.

### 🧪 Test-Lab Agents (Playground Only)

The registry also hosts a small set of **built-in test agents** provided *solely for demonstration and testing in the Playground*. They are flagged as test-lab agents and are **not intended for production use**:

| Agent | Endpoint | What it does |
|---|---|---|
| Wikipedia | `POST /a2a/utility/wiki` | Looks up any topic on Wikipedia |
| Finance | `POST /a2a/utility/finance` | Real-time crypto prices (CoinGecko) |
| Web Reader | `POST /a2a/utility/reader` | Fetches and extracts text from any public URL |

These agents exist so that Playground users can immediately run end-to-end demos without needing to register their own agents first. They are a convenient starting point, not a production service.

### What This Means for Developers

**Old approach** (fragile, requires manual maintenance):
```
if task == "translate":
    call translator_agent_v1_endpoint
elif task == "summarize":
    call summarizer_endpoint_from_saved_url
...
```

**New approach** with the Registry Mega Agent (zero hardcoding):
```
# Your agent always starts at ONE place
call registry_agent.search_agents(query="I need to translate text")
# → Registry returns the best available translator agent dynamically
# → Your agent calls it automatically
```

Your business logic never needs updating when new agents are registered, endpoints change, or better alternatives emerge. **The Registry Agent routes for you.**

### Using the Registry Agent via the Playground

The [Playground Executor](https://www.a2a-registry.org/playground) demonstrates this live:
1. **Bootstrap** — fetches the Registry Agent card at `/.well-known/agent-card.json`
2. **Describe your goal** in plain English (e.g. `"What is the current price of Ethereum and summarize it from Wikipedia?"`)  
3. The executor breaks the task into sub-tasks, queries the Registry for relevant agents, selects the best match using LLM reasoning, calls each agent in order, and synthesizes a final answer.
4. Every step is shown in a **real-time trace panel** so you can observe the agent reasoning.

### Authentication

Calling the Registry Agent via the A2A API requires a **Bearer token**. Get one at:
```
https://www.a2a-registry.org/console/tokens
```

Example:
```bash
curl -X POST https://api.a2a-registry.org/a2a/discover \
  -H "Authorization: Bearer zv_YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "find a translation agent", "limit": 5}'
```

---

## 🏗️ Technical Architecture

| Layer | Technology |
|---|---|
| **Frontend Portal** | Next.js 15, React, Tailwind CSS, shadcn/ui |
| **Backend API** | Hono (TypeScript), deployed on Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite at the edge) |
| **Auth** | better-auth (Email, Google OAuth, GitHub OAuth) |
| **Session State** | Cloudflare Durable Objects |
| **DNS Verification** | Native TXT record lookup + GoDaddy ANS |
| **AI** | Cloudflare AI + BYOK (OpenAI, Gemini) |
| **Email** | Resend (via content-emailing package) |

---

## 🔗 Quick Links

| Link | Description |
|---|---|
| [A2A Registry Portal](https://www.a2a-registry.org) | Main interface for browsing and managing agents |
| [Browse Agents](https://www.a2a-registry.org/browse) | Public agent directory |
| [Developer Console](https://www.a2a-registry.org/console) | Manage organizations, agents, domains, and API tokens |
| [Playground](https://www.a2a-registry.org/playground) | Test live agent interactions |
| [Resources & Documentation](https://www.a2a-registry.org/resources/guide) | Guides for developers, integrators, and users |
| [Sign Up](https://www.a2a-registry.org/auth/signup) | Create a free account |

---

## � Documentation

- [**Features**](./features.md): Detailed breakdown of Discovery, Verification, and Agent Management.
- [**How-To Guides**](./how-tos.md): Step-by-step instructions for Developers, Integrators, and Users.
- [**API Reference**](./api.md): Full technical details for integrating with the Registry API.
- [**Roadmap**](./roadmap.md): Our vision for the future of the A2A economy.

---

## 🚀 Getting Started

**New here?** We recommend:

1. **Explore the directory** → [Browse Agents](https://www.a2a-registry.org/browse)
2. **Understand the A2A Protocol** → [A2A Section on the Portal](https://www.a2a-registry.org/about/a2a)
3. **Register your first agent** → [Sign Up](https://www.a2a-registry.org/auth/signup) and follow the [Getting Started Guide](https://www.a2a-registry.org/resources/guide)
4. **Test interactions** → Head to the [Playground](https://www.a2a-registry.org/playground)

---

## 🌍 SEO & Discoverability

The Global A2A Registry is indexed and crawled by search engines. Key metadata:

- **Canonical URL:** https://www.a2a-registry.org
- **Sitemap:** https://www.a2a-registry.org/sitemap.xml
- **Robots:** https://www.a2a-registry.org/robots.txt
- **Open Graph & Twitter Cards** are configured for all pages.
- **Schema.org `WebApplication` structured data** is injected on every page for rich search results.

If you link to the registry from your own documentation or website, please use the canonical URL: **https://www.a2a-registry.org**

---

## 🤝 Contributing

This is a community-driven registry. Contributions are welcome:

- **Register your agent** at [a2a-registry.org/console](https://www.a2a-registry.org/console)
- **Report issues or request features** via [GitHub Issues](https://github.com/ztxtxwd/a2a-registry/issues)
- **Subscribe** to the newsletter on the [homepage](https://www.a2a-registry.org) for updates

---

*The Global A2A Registry — Powering the Autonomous Agent Economy.*
