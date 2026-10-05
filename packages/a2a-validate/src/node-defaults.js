'use strict';
/**
 * Node.js platform defaults for @a2aregistry/validate.
 *
 * Compiles the Ajv schema at require() time and provides native
 * Node.js implementations of fetch and DNS resolution.
 *
 * NEVER import this file from a Cloudflare Worker or Deno entry point —
 * it uses node:dns/promises and new Function() (via Ajv's compiler), both
 * of which are forbidden in edge runtimes.
 *
 * Usage (automatic via index.js):
 *   const { validateJson } = require('@a2aregistry/validate');
 *
 * Usage (explicit):
 *   const { nodeConfig } = require('@a2aregistry/validate/src/node-defaults');
 *   const { validateJson } = require('@a2aregistry/validate/src/validator');
 *   const report = await validateJson(card, nodeConfig);
 */

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const dns = require('node:dns/promises');
const { A2A_V1_SCHEMA } = require('./schema');

// Compile once at module load — safe here because this file is Node.js only.
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const compiledValidateFn = ajv.compile(A2A_V1_SCHEMA);

/**
 * ValidatorConfig pre-wired for Node.js 18+.
 *
 * @type {import('./validator').ValidatorConfig}
 */
const nodeConfig = {
    // Tier 1: use the Ajv runtime-compiled validate function
    validateFn: compiledValidateFn,

    // Tier 2 + Tier 4 JWKS: native globalThis.fetch (Node 18+)
    // No wrapper needed — probeFetch falls back to globalThis.fetch when
    // config.fetch is absent, so we deliberately omit it here.

    // Tier 4 DNS TXT: node:dns/promises
    resolveTxt: (hostname) => dns.resolveTxt(hostname),
};

module.exports = { nodeConfig, compiledValidateFn };
