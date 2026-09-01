'use strict';

/**
 * @a2a-registry/validate — Programmatic API
 *
 * Fully self-contained: runs Tier 1–4 locally using Ajv + jose + json-canonicalize.
 * No registry API required. Works offline for JSON/file validation.
 * Live URL mode requires network access for Tier 2 probing.
 */

const { validateJson, validateUrl } = require('./validator');

/**
 * Validate an A2A v1.0 Agent Card.
 *
 * @param {string | object} target
 *   - A parsed object or JSON string → offline validation (Tiers 1, 3, 4)
 *   - An https:// URL or a2a:// ANS handle → live validation (all 4 tiers)
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
async function validateManifest(target) {
  if (
    typeof target === 'string' &&
    (target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('a2a://') ||
      // bare domain heuristic: no whitespace, contains a dot
      (/^[a-zA-Z0-9]/.test(target) && target.includes('.') && !target.includes(' ')))
  ) {
    return validateUrl(target);
  }

  return validateJson(target);
}

module.exports = {
  validateManifest,
  // Also export the lower-level helpers for callers that want explicit control
  validateJson,
  validateUrl,
};
