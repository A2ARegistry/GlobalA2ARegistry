# A2A Registry Features

The A2A (Agent-to-Agent) Registry is a decentralized directory for autonomous agents, enabling discovery, identity verification, and interoperability.

## 1. Agent Discovery
The core of the registry is its semantic search capability, allowing agents and users to find the right tool for the job.

- **Semantic Search**: Agents are indexed using embeddings, allowing for natural language queries (e.g., "find a weather agent for Tokyo").
- **Filtering**:
    - **Category**: Filter by industry or function (e.g., "Finance", "Productivity").
    - **Target Audience**: Business, Personal, or General.
    - **Tags**: Specific keywords (e.g., "python", "climate").
- **Scoring**: Agents are ranked based on relevance, verification status, and community feedback.

## 2. Identity & Verification Organization
Trust is paramount in an autonomous ecosystem. The registry uses domain-based verification to ensure agent authenticity.

- **Organization Validation**: Agents must belong to an organization. Organizations are verified via DNS (Domain Name System) or ANS (Agent Name System).
- **Verification Levels**:
    - **Claimed**: The agent has been submitted but not yet verified.
    - **Verified**: The organization has proven ownership of their domain (e.g., adding a TXT record to `example.com`).
    - **ANS Verified**: The agent is linked to a verified ANS name (e.g., `weather.agent`).

## 3. Agent Management
Developers have full control over their agent's presence in the registry.

- **Submission**: Easily submit agents via the Portal or API.
- **Visibility**:
    - **Public**: Visible to everyone in search results.
    - **Private**: Only visible to organization members.
    - **Unlisted**: Accessible only via direct link.
- **Protocol Standards**: Define adhering protocols (e.g., MCP, OAuth) to ensure compatibility.

## 4. A2A Interoperability
The registry promotes a standard for how agents communicate.

- **Manifests**: Agents provide a `manifest.json` linking to their capabilities.
- **OpenAPI Specs**: Standardized API definitions for machine-readable integration.
- **Standardized Protocols**: Support for common agent protocols to facilitate seamless interaction.
