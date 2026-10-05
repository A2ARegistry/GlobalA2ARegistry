'use strict';
/**
 * CF Workers-safe entry point — zero Node.js dependencies.
 *
 * Imports only the pre-compiled Ajv standalone validator (pure ESM, no
 * require() calls) and the raw schema object. Safe to bundle with Wrangler
 * for Cloudflare Workers, Deno, or any edge runtime.
 *
 * Does NOT export validateJson / validateUrl / validateManifest — those
 * use node:dns and node:https and are Node.js-only.
 */

const { A2A_V1_SCHEMA } = require('./schema');

// The compiled validator is ESM (export const validate = ...).
// We load it via a compatibility shim so this CJS file can re-export it.
// Wrangler's esbuild bundler handles the ESM→CJS interop at build time.
const compiled = require('./validator-compiled');
const validate_v1_0 = compiled.validate || compiled.default;

const schema_v1_0 = A2A_V1_SCHEMA;

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

module.exports = {
    schema_v1_0,
    validate_v1_0,
    A2A_SCHEMA_REGISTRY,
    getA2AValidator,
};
