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
 * All tiers run locally in Node.js. No registry API is called.
 */

const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const { flattenedVerify, importJWK } = require('jose');
const canonicalize = require('json-canonicalize');
const dns = require('node:dns/promises');
const https = require('node:https');
const { A2A_V1_SCHEMA } = require('./schema');

// --------------------------------------------------------------------------
// Ajv singleton — compiled once, reused across all validate() calls
// --------------------------------------------------------------------------
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv); // registers uri, email, date-time, etc. (ajv-formats)
const validateSchema = ajv.compile(A2A_V1_SCHEMA);

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
 * @property {boolean}  isValid
 * @property {number}   readinessScore   0–100
 * @property {string}   grade            A+ | A | B | C | Needs Work
 * @property {string}   specVersionDetected
 * @property {any}      [cardData]
 * @property {string}   [targetUrl]
 * @property {boolean}  isOffline
 * @property {Finding[]} findings
 * @property {Object}   summary
 * @property {Object}   [metadata]
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
  // Reverse-DNS package_name
  if (card.package_name) {
    if (/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(card.package_name)) {
      findings.push({
        tier: 'tier3_discovery', severity: 'pass',
        code: 'PACKAGE_NAME_VALID',
        title: 'Reverse-DNS Package Name Valid',
        message: `'${card.package_name}' follows global namespace conventions.`,
      });
    } else {
      findings.push({
        tier: 'tier3_discovery', severity: 'warning',
        code: 'PACKAGE_NAME_NON_STANDARD',
        title: 'Non-Standard Package Identifier',
        message: `'${card.package_name}' should follow reverse-DNS convention (e.g. 'com.example.myagent').`,
        field: 'package_name',
      });
    }
  }

  // Skill example richness
  if (Array.isArray(card.skills)) {
    card.skills.forEach((skill, idx) => {
      const count = Array.isArray(skill.examples) ? skill.examples.length : 0;
      if (count === 0) {
        findings.push({
          tier: 'tier3_discovery', severity: 'warning',
          code: 'SKILL_EXAMPLES_MISSING',
          title: `Skill [${skill.name || idx}] Has No Examples`,
          message: `Skill '${skill.name || skill.id}' has 0 prompt examples. Adding 3–5 diverse variations boosts vector discovery hit-rates.`,
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
      for (const schemeName of Object.keys(req)) {
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
          for (const schemeName of Object.keys(req)) {
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

async function verifyJwsSignatures(card, findings) {
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
      // Decode JWS protected header
      const headerJson = JSON.parse(base64UrlDecode(sig.protected).toString('utf8'));
      const { alg, kid, jku, jwk: inlineJwk } = headerJson;

      let publicKey = null;

      if (inlineJwk) {
        // Case A: inline JWK in protected header
        publicKey = await importJWK(inlineJwk, alg || 'ES256');
      } else if (jku) {
        // Case B: fetch JWKS from URL
        const jwksText = await httpGet(jku, 5000);
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

      // Verify with detached payload (A2A uses detached JWS)
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

/** Minimal HTTPS GET for JWKS fetching (no external deps). */
function httpGet(url, timeoutMs = 5000) {
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

// --------------------------------------------------------------------------
// Tier 2 — live network probe (available in Node.js, no SSRF risk since
// the CLI runs on the developer's own machine)
// --------------------------------------------------------------------------

/**
 * Fetches a URL and returns { ok, status, statusText, headers, text, responseTimeMs }.
 * Uses native fetch (Node 18+).
 */
async function safeFetchNode(url, timeoutMs = 6000, maxBytes = 524288) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

    // Stream with byte cap
    const reader = res.body?.getReader();
    let bytes = 0;
    const chunks = [];
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
      error: isTimeout ? `Timed out after ${timeoutMs}ms` : e.message,
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

  // HTTPS
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

  // MIME
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

  // CORS
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

  // Latency
  if (fetchRes.responseTimeMs > 1500) {
    findings.push({
      tier: 'tier2_network', severity: 'warning',
      code: 'LATENCY_HIGH', title: 'High Latency',
      message: `Response took ${fetchRes.responseTimeMs}ms (recommended < 1500ms).`,
    });
  }
}

/** Tier 4 DNS TXT check. */
async function checkDnsTxt(hostname, findings) {
  try {
    const records = await dns.resolveTxt(`_a2a.${hostname}`);
    if (records.length > 0) {
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
      if (f.tier === 'tier4_trust') score += 5; // trust bonus
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
 * @returns {Promise<ValidationReport>}
 */
async function validateJson(rawInput) {
  const findings = [];

  // Parse if string
  let cardData;
  const rawString = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput, null, 2);

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

  // Payload size (10KB registry guardrail)
  const byteSize = Buffer.byteLength(rawString, 'utf8');
  if (byteSize > 10240) {
    findings.push({
      tier: 'tier1_schema', severity: 'warning',
      code: 'PAYLOAD_EXCEEDS_10KB',
      title: 'Manifest Exceeds 10KB',
      message: `Card is ${(byteSize / 1024).toFixed(1)}KB. The registry guardrail is 10KB.`,
      suggestion: 'Trim long descriptions or move extended content to documentationUrl.',
    });
  } else {
    findings.push({
      tier: 'tier1_schema', severity: 'pass',
      code: 'PAYLOAD_SIZE_OK',
      title: 'Payload Size OK',
      message: `Card payload is ${(byteSize / 1024).toFixed(1)}KB (within 10KB limit).`,
    });
  }

  // v0.3 detection (before schema validation so hints appear first)
  const v03Hints = detectV03Format(cardData);
  let specVersion = v03Hints.length > 0 ? 'v0.3' : 'v1.0';
  findings.push(...v03Hints);

  // Tier 1: Ajv schema validation (Draft 2020-12)
  const valid = validateSchema(cardData);
  if (!valid && validateSchema.errors) {
    for (const err of validateSchema.errors) {
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
  } else if (valid) {
    findings.push({
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

  // Tier 4: JWS signatures (offline — verifies against inline jwk or fetches jku)
  const verifiedSigs = await verifyJwsSignatures(cardData, findings);

  return buildReport(findings, valid && v03Hints.length === 0, specVersion, cardData, {
    isOffline: true,
    contentLengthBytes: byteSize,
    signaturesVerified: verifiedSigs,
  });
}

/**
 * Fetch and validate a live Agent Card URL.
 * Runs all 4 tiers. Requires network access.
 *
 * @param {string} targetUrl  https:// URL, base domain, or a2a:// ANS handle
 * @returns {Promise<ValidationReport>}
 */
async function validateUrl(targetUrl) {
  const findings = [];

  let cleanUrl = targetUrl.trim();

  // Normalise to https:// if bare domain
  if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(cleanUrl)) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Resolve to canonical .well-known path
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
  const fetchRes = await safeFetchNode(probeUrl);
  runTier2(fetchRes, new URL(probeUrl), findings);

  if (!fetchRes.ok) {
    // Try to parse whatever came back for partial T1/T3 info
    let partial;
    if (fetchRes.text) { try { partial = JSON.parse(fetchRes.text); } catch { /* ignore */ } }
    return buildReport(findings, false, 'unknown', partial, {
      isOffline: false, targetUrl: probeUrl,
      responseTimeMs: fetchRes.responseTimeMs,
    });
  }

  // Tier 1 + 3 + 4 on the fetched content
  const jsonReport = await validateJson(fetchRes.text);
  findings.push(...jsonReport.findings);

  // Tier 4: DNS TXT
  let dnsTxtFound = false;
  try {
    const hostname = new URL(probeUrl).hostname;
    dnsTxtFound = await checkDnsTxt(hostname, findings);
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
