'use strict';

/**
 * @a2aregistry/validate — Programmatic API
 *
 * Fully self-contained: runs Tier 1–4 locally using Ajv + jose + json-canonicalize.
 * No registry API required. Works offline for JSON/file validation.
 * Live URL mode requires network access for Tier 2 probing.
 *
 * Low-level schema exports (for consumers that need the raw Ajv validator and
 * schema object directly, e.g. a Cloudflare Worker backend):
 *   - schema_v1_0         — raw JSON Schema object (A2A v1.0)
 *   - validate_v1_0       — pre-compiled Ajv ValidateFunction
 *   - A2A_SCHEMA_REGISTRY — map of version keys → { validate, schema }
 *   - getA2AValidator     — helper that resolves the right entry by version string
 */

const { validateJson: _validateJson, validateUrl: _validateUrl } = require('./validator');
const { nodeConfig } = require('./node-defaults');
const { A2A_V1_SCHEMA } = require('./schema');

// ---------------------------------------------------------------------------
// Low-level schema exports — for consumers (e.g. a Cloudflare Worker) that
// need the compiled Ajv validator and raw schema object directly.
// The Ajv instance is shared with validator.js (compiled once at require time).
// ---------------------------------------------------------------------------

// Re-export the raw JSON Schema object
const schema_v1_0 = A2A_V1_SCHEMA;

// Re-export the compiled Ajv ValidateFunction from node-defaults
// (node-defaults.js compiles it at module load via ajv.compile(A2A_V1_SCHEMA))
const { compiledValidateFn: validate_v1_0 } = require('./node-defaults');

// Registry of all supported versions — keyed by both 'v1_0' and '1.0'
const A2A_SCHEMA_REGISTRY = {
  v1_0: { validate: validate_v1_0, schema: schema_v1_0 },
  '1.0': { validate: validate_v1_0, schema: schema_v1_0 },
};

/**
 * Resolve the Ajv validator entry for a given spec version string.
 * Defaults to v1.0 if the version is unrecognised or omitted.
 *
 * @param {string} [version]  e.g. 'v1_0' or '1.0'
 * @returns {{ validate: Function, schema: object }}
 */
function getA2AValidator(version) {
  if (version && A2A_SCHEMA_REGISTRY[version]) {
    return A2A_SCHEMA_REGISTRY[version];
  }
  return A2A_SCHEMA_REGISTRY['v1_0'];
}

/**
 * Validate an A2A v1.0 Agent Card from JSON string or object (offline).
 *
 * @param {string | object} rawInput
 * @param {object} [config] Optional ValidatorConfig to override Node.js defaults
 * @returns {Promise<import('./validator').ValidationReport>}
 */
async function validateJson(rawInput, config = {}) {
  const mergedConfig = { ...nodeConfig, ...config };
  return _validateJson(rawInput, mergedConfig);
}

/**
 * Validate an A2A v1.0 Agent Card from a live URL (all 4 tiers).
 *
 * @param {string} targetUrl
 * @param {object} [config] Optional ValidatorConfig to override Node.js defaults
 * @returns {Promise<import('./validator').ValidationReport>}
 */
async function validateUrl(targetUrl, config = {}) {
  const mergedConfig = { ...nodeConfig, ...config };
  return _validateUrl(targetUrl, mergedConfig);
}

/**
 * Validate an A2A v1.0 Agent Card.
 *
 * @param {string | object} target
 *   - A parsed object or JSON string → offline validation (Tiers 1, 3, 4)
 *   - An https:// URL or a2a:// ANS handle → live validation (all 4 tiers)
 * @param {object} [config] Optional ValidatorConfig to override Node.js defaults
 * @returns {Promise<import('./validator').ValidationReport>}
 *
 * @example
 * // Offline — from object
 * const report = await validateManifest({ name: 'My Agent', ... });
 *
 * @example
 * // Offline — from local file (caller reads the file)
 * const fs = require('fs');
 * const json = JSON.parse(fs.readFileSync('agent-card.json', 'utf-8'));
 * const report = await validateManifest(json);
 *
 * @example
 * // Live URL probe
 * const report = await validateManifest('https://agent.example.com');
 * console.log(report.grade, report.readinessScore);
 */
async function validateManifest(target, config = {}) {
  // Merge Node.js defaults with user-supplied config (user config takes precedence)
  const mergedConfig = { ...nodeConfig, ...config };

  if (
    typeof target === 'string' &&
    (target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('a2a://') ||
      (/^[a-zA-Z0-9]/.test(target) && target.includes('.') && !target.includes(' ')))
  ) {
    return _validateUrl(target, mergedConfig);
  }

  return _validateJson(target, mergedConfig);
}

module.exports = {
  // High-level API
  validateManifest,
  validateJson,
  validateUrl,

  // Low-level schema exports (for backend / Cloudflare Worker consumers)
  schema_v1_0,
  validate_v1_0,
  A2A_SCHEMA_REGISTRY,
  getA2AValidator,
};
