'use strict';

/**
 * A2A Agent Card v1.0 — Fully Self-Contained Offline Validator
 *
 * Tiers:
 *   Tier 1 — Syntax & structural schema validation (Ajv Draft 2020-12)
 *   Tier 2 — Network, HTTPS, MIME, CORS, latency  (live URL mode only)
 *   Tier 3 — Discovery & semantic quality audit    (offline + live)
 *   Tier 4 — Cryptographic JWS trust verification  (offline + live)
 *
 * All tiers run locally. No registry API is called.
 *
 * Platform adapters (optional — passed as `config` to validateJson / validateUrl):
 *
 *   config.fetch(url, options?)
 *     Called for Tier 2 live URL probing and JWKS fetching (Tier 4).
 *     Must return a Promise resolving to:
 *       { ok, status, statusText, headers: Headers-like, text: string,
 *         error?: string, responseTimeMs: number }
 *     Default: native globalThis.fetch (Node 18+).
 *
 *   config.resolveTxt(hostname)
 *     Called for the Tier 4 DNS TXT ownership check.
 *     Must return a Promise resolving to string[][] (same as node:dns/promises resolveTxt).
 *     Default: lazy-required node:dns/promises (Node.js only).
 *
 * Cloudflare Workers usage:
 *   Pass { fetch: myCfSafeFetch, resolveTxt: myCfDnsResolve } to avoid
 *   Node.js-only APIs being bundled into the Worker.
 */

const { flattenedVerify, importJWK } = require('jose');
const canonicalize = require('json-canonicalize');

// node:dns, node:https, Ajv and ajv-formats are NOT required here.
// They are provided via config adapters so that edge runtimes (Cloudflare
// Workers, Deno) that forbid eval() / new Function() never see them.

// --------------------------------------------------------------------------
// Ajv singleton — compiled once, reused across all validate() calls
// --------------------------------------------------------------------------
// REMOVED: Ajv is no longer compiled at module level.
// Callers must supply config.validateFn (pre-compiled or runtime-compiled).
// Node.js callers get this from node-defaults.js; CF Workers get it from
// validator-compiled.js via schema-only.js.

// --------------------------------------------------------------------------
// Public types (JSDoc only — this is plain JS)
// --------------------------------------------------------------------------
/**
 * @typedef {'tier1_schema'|'tier2_network'|'tier3_discovery'|'tier4_trust'} Tier
 * @typedef {'error'|'warning'|'info'|'pass'} Severity
 *
 * @typedef {Object} Finding
 * @property {Tier}     tier
 * @property {Severity} severity
 * @property {string}   code
 * @property {string}   title
 * @property {string}   message
 * @property {string}   [field]
 * @property {string}   [suggestion]
 *
 * @typedef {Object} ValidationReport
 * @property {boolean}   isValid
 * @property {number}    readinessScore   0–100
 * @property {string}    grade            A+ | A | B | C | Needs Work
 * @property {string}    specVersionDetected
 * @property {any}       [cardData]
 * @property {string}    [targetUrl]
 * @property {boolean}   isOffline
 * @property {Finding[]} findings
 * @property {Object}    summary
 * @property {Object}    [metadata]
 *
 * @typedef {Object} ValidatorConfig
 * @property {function} [validateFn]
 *   (data: any) => boolean — pre-compiled (or runtime-compiled) Ajv validate function.
 *   Must attach `.errors` on failure (same contract as Ajv ValidateFunction).
 *   Node.js callers get this from node-defaults.js (compiled with Ajv at require time).
 *   CF Workers get it from validator-compiled.js (zero-dependency standalone).
 * @property {function} [fetch]
 *   (url: string, options?: object) => Promise<{ok, status, statusText, headers, text, error?, responseTimeMs}>
 *   Used for Tier 2 live URL probing and JWKS fetching (Tier 4).
 *   Defaults to globalThis.fetch (Node 18+).
 * @property {function} [resolveTxt]
 *   (hostname: string) => Promise<string[][]>
 *   Used for Tier 4 DNS TXT ownership verification.
 *   Defaults to node:dns/promises resolveTxt (Node.js only).
 */

// --------------------------------------------------------------------------
// Tier 1 helpers
// --------------------------------------------------------------------------

/** Detect A2A v0.3 legacy patterns and return migration findings. */
function detectV03Format(card) {
  const findings = [];
  if (!card || typeof card !== 'object') return findings;

  // 1. Structural legacy fields
  if (card.url && !card.supportedInterfaces) {
    findings.push({
      tier: 'tier1_schema', severity: 'error',
      code: 'V03_LEGACY_URL_FIELD',
      title: 'Legacy v0.3 Single URL Format',
      message: "Top-level 'url' field detected. A2A v1.0 requires a 'supportedInterfaces' array.",
      field: 'url',
      suggestion: "Replace with: supportedInterfaces: [{ url: \"...\", protocolBinding: \"JSONRPC\", protocolVersion: \"1.0\" }]",
    });
  }

  if (card.preferredTransport) {
    findings.push({
      tier: 'tier1_schema', severity: 'error',
      code: 'V03_LEGACY_TRANSPORT_FIELD',
      title: 'Legacy v0.3 preferredTransport Field',
      message: "'preferredTransport' is removed in v1.0.",
      field: 'preferredTransport',
      suggestion: "Declare transport via 'protocolBinding' inside 'supportedInterfaces[]'.",
    });
  }

  // 2. Phantom capability
  if (card.capabilities && card.capabilities.stateTransitionHistory !== undefined) {
    findings.push({
      tier: 'tier1_schema', severity: 'error',
      code: 'V03_PHANTOM_CAPABILITY',
      title: 'Non-Spec Capability: stateTransitionHistory',
      message: "'capabilities.stateTransitionHistory' does not exist in the v1.0 spec.",
      field: 'capabilities.stateTransitionHistory',
      suggestion: "Remove this field. Valid capability booleans: streaming, pushNotifications, extendedAgentCard.",
    });
  }

  // 3. Relocated field
  if (card.supportsAuthenticatedExtendedCard !== undefined) {
    findings.push({
      tier: 'tier1_schema', severity: 'warning',
      code: 'V03_RELOCATED_CAPABILITY',
      title: 'Relocated extendedAgentCard Flag',
      message: "'supportsAuthenticatedExtendedCard' at top level is deprecated in v1.0.",
      field: 'supportsAuthenticatedExtendedCard',
      suggestion: "Move to 'capabilities.extendedAgentCard: true'.",
    });
  }

  // 4. Deprecated skill fields
  if (Array.isArray(card.skills)) {
    card.skills.forEach((skill, idx) => {
      if (skill.inputSchema || skill.outputSchema) {
        findings.push({
          tier: 'tier1_schema', severity: 'warning',
          code: 'V03_LEGACY_SKILL_SCHEMA',
          title: `Skill [${skill.name || idx}]: inputSchema/outputSchema`,
          message: "inputSchema/outputSchema are not part of v1.0 AgentSkill. Use 'inputModes'/'outputModes' and 'examples'.",
          field: `skills[${idx}]`,
          suggestion: "Remove inputSchema/outputSchema and provide MIME types in inputModes/outputModes.",
        });
      }
    });
  }

  // 5. Enum casing check (v0.3 used lowercase, v1.0 uses SCREAMING_SNAKE_CASE for enums)
  const raw = JSON.stringify(card);
  if (/"role"\s*:\s*"(user|agent)"/.test(raw)) {
    findings.push({
      tier: 'tier1_schema', severity: 'warning',
      code: 'V03_LEGACY_ROLE_ENUM',
      title: 'Legacy Role Enum Values',
      message: "Detected lowercase role values (\"user\"/\"agent\"). v1.0 uses \"ROLE_USER\"/\"ROLE_AGENT\".",
      suggestion: "Update embedded message role values to \"ROLE_USER\" and \"ROLE_AGENT\".",
    });
  }

  if (/"state"\s*:\s*"(submitted|working|completed|failed|canceled|rejected|input-required|auth-required)"/.test(raw)) {
    findings.push({
      tier: 'tier1_schema', severity: 'warning',
      code: 'V03_LEGACY_STATE_ENUM',
      title: 'Legacy TaskState Enum Values',
      message: "Detected v0.3 lowercase TaskState values. v1.0 uses SCREAMING_SNAKE_CASE with TASK_STATE_ prefix.",
      suggestion: "E.g. replace \"completed\" with \"TASK_STATE_COMPLETED\".",
    });
  }

  if (/"kind"\s*:\s*"(text|file|data|blob)"/.test(raw)) {
    findings.push({
      tier: 'tier1_schema', severity: 'warning',
      code: 'V03_LEGACY_PART_KIND',
      title: 'Legacy Part kind Discriminator',
      message: "Detected 'kind' discriminator in message parts. v1.0 uses member-based discrimination (field presence).",
      suggestion: "Remove 'kind' field. Use { \"text\": \"...\" } or { \"url\": \"...\", \"mediaType\": \"...\" }.",
    });
  }

  return findings;
}

/** Validate interface URLs based on protocolBinding. */
function checkInterfaceUrls(card, findings) {
  if (!Array.isArray(card.supportedInterfaces)) return;

  card.supportedInterfaces.forEach((iface, idx) => {
    const binding = String(iface.protocolBinding || '').toLowerCase();
    const isGrpc = binding === 'grpc' || binding.includes('/grpc');

    if (isGrpc) {
      if (iface.url && /^https?:\/\//i.test(iface.url)) {
        findings.push({
          tier: 'tier1_schema', severity: 'error',
          code: 'GRPC_INVALID_URL_SCHEME',
          title: `Interface [${idx}] gRPC URL Has http(s):// Prefix`,
          message: `gRPC interface '${iface.url}' should use 'hostname:port' format without a scheme prefix.`,
          field: `supportedInterfaces[${idx}].url`,
          suggestion: `Change to '${iface.url.replace(/^https?:\/\//, '')}'.`,
        });
      }
    } else {
      if (iface.url && !/^https?:\/\//i.test(iface.url) && !/^\w+:\/\//.test(iface.url)) {
        findings.push({
          tier: 'tier1_schema', severity: 'warning',
          code: 'HTTP_URL_MISSING_SCHEME',
          title: `Interface [${idx}] Missing URL Scheme`,
          message: `Interface URL '${iface.url}' does not start with https://.`,
          field: `supportedInterfaces[${idx}].url`,
          suggestion: "Prefix with 'https://'.",
        });
      }
    }
  });
}

// --------------------------------------------------------------------------
// Tier 3 helpers
// --------------------------------------------------------------------------

function runTier3(card, findings) {
  // Skill example richness
  if (Array.isArray(card.skills)) {
    card.skills.forEach((skill, idx) => {
      const count = Array.isArray(skill.examples) ? skill.examples.length : 0;
      if (count === 0) {
        findings.push({
          tier: 'tier3_discovery', severity: 'warning',
          code: 'SKILL_EXAMPLES_MISSING',
          title: `Skill [${skill.name || idx}] Has No Examples`,
          message: `Skill '${skill.name || skill.id}' has 0 prompt examples. Adding 3–5 diverse variations helps clients and agents understand when to invoke this skill.`,
          field: `skills[${idx}].examples`,
          suggestion: "Add natural-language queries that users would send to trigger this skill.",
        });
      } else if (count < 3) {
        findings.push({
          tier: 'tier3_discovery', severity: 'info',
          code: 'SKILL_EXAMPLES_FEW',
          title: `Skill [${skill.name || idx}] Has Only ${count} Example(s)`,
          message: `Recommended minimum is 3 diverse prompt variations.`,
          field: `skills[${idx}].examples`,
        });
      }
    });
  }

  // Security scheme consistency
  if (Array.isArray(card.securityRequirements) && card.securityRequirements.length > 0) {
    const declared = card.securitySchemes ? Object.keys(card.securitySchemes) : [];
    for (const req of card.securityRequirements) {
      // Schema errors are reported separately; malformed requirements must not throw.
      if (!req || typeof req.schemes !== 'object' || !req.schemes || Array.isArray(req.schemes)) continue;
      for (const schemeName of Object.keys(req.schemes)) {
        if (!declared.includes(schemeName)) {
          findings.push({
            tier: 'tier3_discovery', severity: 'warning',
            code: 'SECURITY_SCHEME_UNDECLARED',
            title: `Undeclared Security Scheme: '${schemeName}'`,
            message: `Card requires scheme '${schemeName}' but it is not defined in 'securitySchemes'.`,
            field: 'securityRequirements',
            suggestion: `Add a '${schemeName}' entry to 'securitySchemes'.`,
          });
        }
      }
    }
  }

  // Per-skill security requirements referencing undeclared schemes
  if (Array.isArray(card.skills)) {
    const declared = card.securitySchemes ? Object.keys(card.securitySchemes) : [];
    card.skills.forEach((skill, idx) => {
      if (Array.isArray(skill.securityRequirements)) {
        for (const req of skill.securityRequirements) {
          if (!req || typeof req.schemes !== 'object' || !req.schemes || Array.isArray(req.schemes)) continue;
          for (const schemeName of Object.keys(req.schemes)) {
            if (!declared.includes(schemeName)) {
              findings.push({
                tier: 'tier3_discovery', severity: 'warning',
                code: 'SKILL_SECURITY_SCHEME_UNDECLARED',
                title: `Skill [${skill.name || idx}]: Undeclared Scheme '${schemeName}'`,
                message: `Skill references security scheme '${schemeName}' not defined in card-level 'securitySchemes'.`,
                field: `skills[${idx}].securityRequirements`,
                suggestion: `Add '${schemeName}' to top-level 'securitySchemes'.`,
              });
            }
          }
        }
      }
    });
  }

  // Documentation URL
  if (card.documentationUrl) {
    if (/^https?:\/\//i.test(card.documentationUrl)) {
      findings.push({
        tier: 'tier3_discovery', severity: 'pass',
        code: 'DOCUMENTATION_URL_VALID',
        title: 'Documentation URL Present',
        message: `Agent references public documentation: ${card.documentationUrl}`,
      });
    } else {
      findings.push({
        tier: 'tier3_discovery', severity: 'warning',
        code: 'DOCUMENTATION_URL_INVALID',
        title: 'Invalid Documentation URL',
        message: "'documentationUrl' must be a valid https:// URL.",
        field: 'documentationUrl',
      });
    }
  }
}

// --------------------------------------------------------------------------
// Tier 4 helpers
// --------------------------------------------------------------------------

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

/**
 * Fetch a URL as text, using config.fetch if provided, else native globalThis.fetch.
 * Returns the response body text.
 * @param {string} url
 * @param {number} timeoutMs
 * @param {ValidatorConfig} config
 * @returns {Promise<string>}
 */
async function httpGetText(url, timeoutMs, config) {
  if (config && typeof config.fetch === 'function') {
    // Use injected adapter (e.g. CF safeFetch)
    const res = await config.fetch(url, { timeoutMs });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text;
  }

  // Default: native Node.js https.get (lazy require — never bundled into CF Workers)
  const https = require('node:https'); // eslint-disable-line
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`JWKS fetch timed out: ${url}`)); });
  });
}

/**
 * @param {any} card
 * @param {Finding[]} findings
 * @param {ValidatorConfig} config
 */
async function verifyJwsSignatures(card, findings, config) {
  if (!Array.isArray(card.signatures) || card.signatures.length === 0) {
    findings.push({
      tier: 'tier4_trust', severity: 'info',
      code: 'SIGNATURES_ABSENT',
      title: 'No JWS Signatures Attached',
      message: 'Card is unsigned. Attaching a RFC 7515/8785 JWS signature provides tamper-evident trust verification.',
    });
    return 0;
  }

  // Build canonical payload (RFC 8785 JCS) excluding the signatures field
  const cardWithoutSigs = { ...card };
  delete cardWithoutSigs.signatures;

  let canonicalPayload;
  try {
    canonicalPayload = Buffer.from(canonicalize(cardWithoutSigs), 'utf8');
  } catch (e) {
    findings.push({
      tier: 'tier4_trust', severity: 'error',
      code: 'JCS_CANONICALIZATION_FAILED',
      title: 'JCS Canonicalization Failed',
      message: `Could not canonicalize card payload: ${e.message}`,
    });
    return 0;
  }

  let verified = 0;

  for (let i = 0; i < card.signatures.length; i++) {
    const sig = card.signatures[i];
    try {
      const headerJson = JSON.parse(base64UrlDecode(sig.protected).toString('utf8'));
      const { alg, kid, jku, jwk: inlineJwk } = headerJson;

      let publicKey = null;

      if (inlineJwk) {
        publicKey = await importJWK(inlineJwk, alg || 'ES256');
      } else if (jku) {
        const jwksText = await httpGetText(jku, 5000, config);
        const jwks = JSON.parse(jwksText);
        if (Array.isArray(jwks.keys)) {
          const match = jwks.keys.find((k) => k.kid === kid) || jwks.keys[0];
          if (match) publicKey = await importJWK(match, alg || match.alg || 'ES256');
        }
      }

      if (!publicKey) {
        findings.push({
          tier: 'tier4_trust', severity: 'warning',
          code: 'JWS_KEY_UNRESOLVED',
          title: `Signature [${i}] Key Unresolved`,
          message: `Could not resolve public key (kid: '${kid || 'unknown'}', jku: '${jku || 'none'}').`,
        });
        continue;
      }

      await flattenedVerify(
        { protected: sig.protected, signature: sig.signature, header: sig.header },
        publicKey,
        { detachedPayload: canonicalPayload }
      );

      verified++;
      findings.push({
        tier: 'tier4_trust', severity: 'pass',
        code: 'JWS_SIGNATURE_VERIFIED',
        title: `JWS Signature [${i}] Verified`,
        message: `Cryptographic signature verified (alg: ${alg || 'ES256'}, kid: '${kid || 'default'}').`,
      });
    } catch (e) {
      findings.push({
        tier: 'tier4_trust', severity: 'error',
        code: 'JWS_VERIFICATION_FAILED',
        title: `Signature [${i}] Verification Failed`,
        message: `JWS verification error: ${e.message}`,
      });
    }
  }

  return verified;
}

// --------------------------------------------------------------------------
// Tier 2 — live network probe
// --------------------------------------------------------------------------

/**
 * Fetches a URL for Tier 2 probing.
 * Uses config.fetch if provided, otherwise native globalThis.fetch (Node 18+).
 * @param {string} url
 * @param {ValidatorConfig} config
 */
async function probeFetch(url, config) {
  if (config && typeof config.fetch === 'function') {
    return config.fetch(url, { timeoutMs: 6000, maxBytes: 524288 });
  }

  // Default: native fetch (Node 18+). Lazy — no top-level import needed.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'a2a-validate/1.0 (+https://github.com/a2a-registry/validate)',
        'Accept': 'application/a2a+json, application/json;q=0.9, */*;q=0.5',
      },
    });
    clearTimeout(timer);

    const reader = res.body?.getReader();
    let bytes = 0;
    const chunks = [];
    const maxBytes = 524288;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > maxBytes) {
          reader.cancel();
          return {
            ok: false, status: 413, statusText: 'Payload Too Large',
            headers: res.headers, text: '',
            error: `Response exceeded ${maxBytes} bytes`,
            responseTimeMs: Date.now() - start,
          };
        }
        chunks.push(value);
      }
    }

    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
    return {
      ok: res.ok, status: res.status, statusText: res.statusText,
      headers: res.headers, text, responseTimeMs: Date.now() - start,
    };
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e.name === 'AbortError';
    return {
      ok: false,
      status: isTimeout ? 408 : 0,
      statusText: isTimeout ? 'Request Timeout' : 'Fetch Error',
      headers: new Headers(),
      text: '',
      error: isTimeout ? `Timed out after 6000ms` : e.message,
      responseTimeMs: Date.now() - start,
    };
  }
}

/** Run Tier 2 network findings against a live fetch result. */
function runTier2(fetchRes, urlObj, findings) {
  if (!fetchRes.ok) {
    findings.push({
      tier: 'tier2_network', severity: 'error',
      code: 'NETWORK_HTTP_ERROR',
      title: 'Live Network Probe Failed',
      message: `HTTP ${fetchRes.status} (${fetchRes.statusText}) at ${urlObj.href}${fetchRes.error ? ': ' + fetchRes.error : ''}`,
      suggestion: 'Verify the agent service is running and publicly reachable.',
    });
    return;
  }

  findings.push({
    tier: 'tier2_network', severity: 'pass',
    code: 'HTTP_200_OK',
    title: 'HTTP 200 OK',
    message: `Endpoint responded in ${fetchRes.responseTimeMs}ms.`,
  });

  if (urlObj.protocol === 'https:') {
    findings.push({
      tier: 'tier2_network', severity: 'pass',
      code: 'HTTPS_OK', title: 'HTTPS Encryption',
      message: 'Endpoint served over secure TLS/HTTPS.',
    });
  } else {
    findings.push({
      tier: 'tier2_network', severity: 'error',
      code: 'HTTPS_MISSING', title: 'Insecure HTTP',
      message: 'Production agent cards must be served over HTTPS.',
      suggestion: 'Enable a TLS certificate on your agent host.',
    });
  }

  const ct = fetchRes.headers.get('content-type') || '';
  if (ct.includes('application/a2a+json')) {
    findings.push({
      tier: 'tier2_network', severity: 'pass',
      code: 'MIME_A2A_CANONICAL', title: 'Canonical MIME Type',
      message: `Content-Type '${ct}' matches the official A2A v1.0 standard.`,
    });
  } else if (ct.includes('application/json') || ct.includes('application/problem+json')) {
    findings.push({
      tier: 'tier2_network', severity: 'warning',
      code: 'MIME_JSON_ADVISORY', title: 'Standard JSON MIME Type',
      message: `Content-Type '${ct}'. The canonical header is 'application/a2a+json'.`,
      suggestion: "Set 'Content-Type: application/a2a+json; charset=utf-8'.",
    });
  } else {
    findings.push({
      tier: 'tier2_network', severity: 'error',
      code: 'MIME_INVALID', title: 'Invalid MIME Type',
      message: `Content-Type '${ct}' is not JSON. Agents will fail to parse this card.`,
      suggestion: "Set 'Content-Type: application/a2a+json'.",
    });
  }

  const corsOrigin = fetchRes.headers.get('access-control-allow-origin');
  if (corsOrigin) {
    findings.push({
      tier: 'tier2_network', severity: 'pass',
      code: 'CORS_OK', title: 'CORS Header Present',
      message: `Access-Control-Allow-Origin: '${corsOrigin}'.`,
    });
  } else {
    findings.push({
      tier: 'tier2_network', severity: 'warning',
      code: 'CORS_MISSING', title: 'Missing CORS Header',
      message: "No 'Access-Control-Allow-Origin' header found. Browser-based agents may fail to fetch this card.",
      suggestion: "Add 'Access-Control-Allow-Origin: *' to your agent card endpoint.",
    });
  }

  if (fetchRes.responseTimeMs > 1500) {
    findings.push({
      tier: 'tier2_network', severity: 'warning',
      code: 'LATENCY_HIGH', title: 'High Latency',
      message: `Response took ${fetchRes.responseTimeMs}ms (recommended < 1500ms).`,
    });
  }
}

/**
 * Tier 4 DNS TXT check.
 * Uses config.resolveTxt if provided, otherwise lazy-requires node:dns/promises.
 * @param {string} hostname
 * @param {Finding[]} findings
 * @param {ValidatorConfig} config
 */
async function checkDnsTxt(hostname, findings, config) {
  try {
    let records;
    if (config && typeof config.resolveTxt === 'function') {
      records = await config.resolveTxt(`_a2a.${hostname}`);
    } else {
      // Lazy require — never evaluated in CF Workers when an adapter is provided
      const dns = require('node:dns/promises'); // eslint-disable-line
      records = await dns.resolveTxt(`_a2a.${hostname}`);
    }
    if (records && records.length > 0) {
      findings.push({
        tier: 'tier4_trust', severity: 'pass',
        code: 'DNS_TXT_VERIFIED',
        title: 'DNS TXT Record Verified',
        message: `Found '_a2a.${hostname}' DNS verification record.`,
      });
      return true;
    }
  } catch {
    // No TXT record — not an error, just unverified
  }
  return false;
}

// --------------------------------------------------------------------------
// Score & grade calculator
// --------------------------------------------------------------------------

function buildReport(findings, isValid, specVersion, cardData, meta) {
  let score = 100;
  let tier1Error = false;
  let tier2Error = false;
  let errors = 0, warnings = 0, passes = 0;

  for (const f of findings) {
    if (f.severity === 'error') {
      errors++;
      if (f.tier === 'tier1_schema') { score -= 25; tier1Error = true; }
      else if (f.tier === 'tier2_network') { score -= 15; tier2Error = true; }
    } else if (f.severity === 'warning') {
      warnings++;
      score -= 5;
    } else if (f.severity === 'pass') {
      passes++;
      if (f.tier === 'tier4_trust') score += 5;
    }
  }

  if (tier1Error) score = Math.min(score, 40);
  if (tier2Error) score = Math.min(score, 20);
  score = Math.max(0, Math.min(100, score));

  let grade = 'Needs Work';
  if (score >= 95) grade = 'A+';
  else if (score >= 85) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 50) grade = 'C';

  function tierStatus(tier) {
    const tf = findings.filter((f) => f.tier === tier);
    if (tf.some((f) => f.severity === 'error')) return 'fail';
    if (tf.some((f) => f.severity === 'warning')) return 'warn';
    if (tf.some((f) => f.severity === 'pass')) return 'pass';
    return 'pass';
  }

  return {
    isValid: errors === 0,
    readinessScore: score,
    grade,
    specVersionDetected: specVersion || 'v1.0',
    cardData,
    targetUrl: meta?.targetUrl,
    isOffline: !!meta?.isOffline,
    findings,
    summary: {
      totalErrors: errors,
      totalWarnings: warnings,
      totalPasses: passes,
      tier1Status: tierStatus('tier1_schema'),
      tier2Status: meta?.isOffline ? 'skipped' : tierStatus('tier2_network'),
      tier3Status: tierStatus('tier3_discovery'),
      tier4Status: tierStatus('tier4_trust'),
    },
    metadata: meta || {},
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Validate an Agent Card from raw JSON string or parsed object.
 * Runs Tiers 1, 3, and 4 (offline). Tier 2 is skipped.
 *
 * @param {string|object} rawInput
 * @param {ValidatorConfig} [config]  Optional platform adapters (fetch, resolveTxt).
 * @returns {Promise<ValidationReport>}
 */
async function validateJson(rawInput, config = {}) {
  const findings = [];

  let cardData;
  if (typeof rawInput === 'string') {
    try {
      cardData = JSON.parse(rawInput);
    } catch (e) {
      findings.push({
        tier: 'tier1_schema', severity: 'error',
        code: 'INVALID_JSON_SYNTAX',
        title: 'Invalid JSON Syntax',
        message: `Failed to parse JSON: ${e.message}`,
        suggestion: 'Check for trailing commas, unescaped quotes, or missing brackets.',
      });
      return buildReport(findings, false, 'unknown', undefined, { isOffline: true });
    }
  } else {
    cardData = rawInput;
  }

  // v0.3 detection (before schema validation so hints appear first)
  const v03Hints = detectV03Format(cardData);
  let specVersion = v03Hints.length > 0 ? 'v0.3' : 'v1.0';
  findings.push(...v03Hints);

  // Tier 1: Ajv schema validation
  // config.validateFn is required — provided by node-defaults.js (Node.js) or
  // schema-only.js / makeCfValidatorConfig() (CF Workers).
  const validateFn = config.validateFn;
  if (!validateFn) {
    findings.push({
      tier: 'tier1_schema', severity: 'error',
      code: 'VALIDATOR_NOT_CONFIGURED',
      title: 'No Schema Validator Provided',
      message: 'config.validateFn is required. Pass a compiled Ajv ValidateFunction via config.',
    });
    return buildReport(findings, false, specVersion, cardData, { isOffline: true });
  }

  const valid = validateFn(cardData);
  if (!valid && validateFn.errors) {
    for (const err of validateFn.errors) {
      const field = err.instancePath || err.params?.missingProperty || 'root';
      findings.push({
        tier: 'tier1_schema', severity: 'error',
        code: `SCHEMA_${err.keyword.toUpperCase()}`,
        title: `Schema Error: ${field}`,
        message: `${field} ${err.message}`,
        field,
        suggestion: `Refer to the A2A v1.0 specification for field '${field}'.`,
      });
    }
  } else if (valid) {    findings.push({
      tier: 'tier1_schema', severity: 'pass',
      code: 'SCHEMA_VALID',
      title: 'A2A v1.0 Schema Conformance',
      message: 'All required fields and structures conform to A2A v1.0.',
    });
  }

  // Interface URL format enforcement
  checkInterfaceUrls(cardData, findings);

  // Tier 3: discovery & semantic quality
  runTier3(cardData, findings);

  // Tier 4: JWS signatures
  const verifiedSigs = await verifyJwsSignatures(cardData, findings, config);

  return buildReport(findings, valid && v03Hints.length === 0, specVersion, cardData, {    isOffline: true,
    signaturesVerified: verifiedSigs,
  });
}

/**
 * Fetch and validate a live Agent Card URL.
 * Runs all 4 tiers.
 *
 * @param {string} targetUrl
 * @param {ValidatorConfig} [config]  Optional platform adapters (fetch, resolveTxt).
 * @returns {Promise<ValidationReport>}
 */
async function validateUrl(targetUrl, config = {}) {
  const findings = [];

  let cleanUrl = targetUrl.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(cleanUrl);
  } catch {
    findings.push({
      tier: 'tier2_network', severity: 'error',
      code: 'INVALID_URL', title: 'Invalid URL',
      message: `'${targetUrl}' is not a valid URL.`,
    });
    return buildReport(findings, false, 'unknown', undefined, { isOffline: false, targetUrl });
  }

  const probeUrl = urlObj.pathname.endsWith('.json')
    ? urlObj.href
    : `${urlObj.href.replace(/\/+$/, '')}/.well-known/agent-card.json`;

  // Tier 2: live network probe
  const fetchRes = await probeFetch(probeUrl, config);
  runTier2(fetchRes, new URL(probeUrl), findings);

  if (!fetchRes.ok) {
    let partial;
    if (fetchRes.text) { try { partial = JSON.parse(fetchRes.text); } catch { /* ignore */ } }
    return buildReport(findings, false, 'unknown', partial, {
      isOffline: false, targetUrl: probeUrl,
      responseTimeMs: fetchRes.responseTimeMs,
    });
  }

  // Tier 1 + 3 + 4 on the fetched content
  const jsonReport = await validateJson(fetchRes.text, config);
  findings.push(...jsonReport.findings);

  // Tier 4: DNS TXT
  let dnsTxtFound = false;
  try {
    dnsTxtFound = await checkDnsTxt(new URL(probeUrl).hostname, findings, config);
  } catch { /* DNS check is best-effort */ }

  const ct = fetchRes.headers.get('content-type') || '';
  return buildReport(
    findings,
    jsonReport.isValid && fetchRes.ok,
    jsonReport.specVersionDetected,
    jsonReport.cardData,
    {
      isOffline: false,
      targetUrl: probeUrl,
      responseTimeMs: fetchRes.responseTimeMs,
      contentLengthBytes: fetchRes.text.length,
      contentType: ct,
      dnsTxtFound,
      signaturesVerified: jsonReport.metadata?.signaturesVerified,
    }
  );
}

module.exports = { validateJson, validateUrl };
