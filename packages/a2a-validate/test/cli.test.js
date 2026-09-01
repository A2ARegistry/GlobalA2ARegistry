'use strict';

/**
 * @a2a-registry/validate — Offline Test Suite
 *
 * Tests the programmatic API (src/validator.js + src/index.js) and the CLI
 * (bin/cli.js) entirely offline. No network calls, no registry API.
 *
 * Run with:  node test/cli.test.js
 * Or:        npm test  (add "test": "node test/cli.test.js" to package.json scripts)
 */

const { execSync } = require('node:child_process');
const { writeFileSync, unlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const { validateJson, validateUrl } = require('../src/validator');
const { validateManifest } = require('../src/index');

const CLI = path.resolve(__dirname, '../bin/cli.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(label, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m  ${label}`);
    passed++;
  } catch (e) {
    console.error(`  \x1b[31m✖\x1b[0m  ${label}`);
    console.error(`       ${e.message}`);
    failures.push({ label, error: e });
    failed++;
  }
}

function cli(args, opts = {}) {
  return execSync(`node "${CLI}" ${args}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function cliResult(args) {
  try {
    const stdout = execSync(`node "${CLI}" ${args} 2>/dev/null`, {
      encoding: 'utf-8',
    });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

/** Write a temp JSON file, return its path. Caller is responsible for cleanup. */
function writeTmp(obj) {
  const file = path.join(tmpdir(), `a2a_test_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(obj, null, 2), 'utf-8');
  return file;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CARD = {
  name: 'Test Currency Agent',
  description: 'Provides real-time foreign exchange rates and currency conversion.',
  version: '1.0.0',
  package_name: 'com.example.forex',
  provider: { organization: 'Example Corp', url: 'https://example.com' },
  supportedInterfaces: [
    { url: 'https://forex.example.com/a2a/v1', protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
  ],
  capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
  defaultInputModes: ['text', 'application/json'],
  defaultOutputModes: ['application/json'],
  skills: [
    {
      id: 'convert_currency',
      name: 'Convert Currency',
      description: 'Converts an amount between two currencies using live ECB exchange rates.',
      tags: ['forex', 'currency', 'finance'],
      examples: [
        'Convert 100 USD to EUR',
        'What is 50 GBP in JPY?',
        'How much is 1 BTC in USD today?',
      ],
    },
  ],
};

const MISSING_REQUIRED_CARD = {
  // Missing: name, description, version, supportedInterfaces, capabilities, defaultInputModes, defaultOutputModes, skills
  package_name: 'com.example.broken',
};

const V03_LEGACY_CARD = {
  name: 'Legacy Agent',
  description: 'An old v0.3 format card.',
  version: '0.3.0',
  url: 'https://agent.example.com/a2a',          // v0.3 flat URL
  preferredTransport: 'JSONRPC',                  // v0.3 flat transport
  capabilities: {
    streaming: false,
    stateTransitionHistory: true,                 // phantom v0.3 capability
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    { id: 's1', name: 'Skill 1', description: 'A skill.', tags: ['test'],
      inputSchema: { type: 'object' } },          // deprecated inputSchema
  ],
};

const GRPC_BAD_URL_CARD = {
  ...VALID_CARD,
  supportedInterfaces: [
    { url: 'https://agent.example.com:50051', protocolBinding: 'GRPC', protocolVersion: '1.0' },
  ],
};

const NO_EXAMPLES_CARD = {
  ...VALID_CARD,
  skills: [
    { id: 'skill1', name: 'Skill One', description: 'Does something useful.', tags: ['utility'] },
    { id: 'skill2', name: 'Skill Two', description: 'Does something else.', tags: ['utility'], examples: ['one example'] },
  ],
};

const SECURITY_MISMATCH_CARD = {
  ...VALID_CARD,
  securityRequirements: [{ myApiScheme: [] }],
  // securitySchemes is absent — mismatch
};

const OVERSIZED_CARD = (() => {
  const card = JSON.parse(JSON.stringify(VALID_CARD));
  // Pad description to exceed 10KB
  card.description = 'A'.repeat(11000);
  return card;
})();

// ── Test Sections ─────────────────────────────────────────────────────────────

async function runValidatorApiTests() {
  console.log('\n\x1b[1m▸ validateJson() — programmatic API\x1b[0m');

  await test('Valid v1.0 card returns isValid=true and grade A+', async () => {
    const r = await validateJson(VALID_CARD);
    assert.ok(r.isValid, `Expected isValid=true, got false. Errors: ${JSON.stringify(r.findings.filter(f => f.severity === 'error').map(f => f.message))}`);
    assert.ok(['A+', 'A'].includes(r.grade), `Expected A or A+, got ${r.grade}`);
    assert.ok(r.readinessScore >= 85, `Expected score >= 85, got ${r.readinessScore}`);
    assert.equal(r.specVersionDetected, 'v1.0');
    assert.ok(r.isOffline);
  });

  await test('Valid card: Tier 1 status is pass', async () => {
    const r = await validateJson(VALID_CARD);
    assert.equal(r.summary.tier1Status, 'pass');
  });

  await test('Valid card: Tier 2 status is skipped (offline mode)', async () => {
    const r = await validateJson(VALID_CARD);
    assert.equal(r.summary.tier2Status, 'skipped');
  });

  await test('Valid JSON string input is accepted', async () => {
    const r = await validateJson(JSON.stringify(VALID_CARD));
    assert.ok(r.isValid);
  });

  await test('Invalid JSON string returns INVALID_JSON_SYNTAX error', async () => {
    const r = await validateJson('{ "name": "broken" ');
    assert.ok(!r.isValid);
    assert.ok(r.findings.some(f => f.code === 'INVALID_JSON_SYNTAX'));
  });

  await test('Missing required fields produce schema errors', async () => {
    const r = await validateJson(MISSING_REQUIRED_CARD);
    assert.ok(!r.isValid);
    assert.ok(r.summary.totalErrors > 0, 'Expected errors for missing required fields');
    // Should catch at least name, version, supportedInterfaces, skills
    const codes = r.findings.filter(f => f.severity === 'error').map(f => f.code);
    assert.ok(codes.some(c => c.startsWith('SCHEMA_')), `Expected SCHEMA_ error codes, got: ${codes.join(', ')}`);
  });

  await test('v0.3 legacy card: detected as v0.3, all 4 legacy patterns flagged', async () => {
    const r = await validateJson(V03_LEGACY_CARD);
    assert.equal(r.specVersionDetected, 'v0.3');
    const codes = r.findings.map(f => f.code);
    assert.ok(codes.includes('V03_LEGACY_URL_FIELD'), 'Expected V03_LEGACY_URL_FIELD');
    assert.ok(codes.includes('V03_LEGACY_TRANSPORT_FIELD'), 'Expected V03_LEGACY_TRANSPORT_FIELD');
    assert.ok(codes.includes('V03_PHANTOM_CAPABILITY'), 'Expected V03_PHANTOM_CAPABILITY');
    assert.ok(codes.includes('V03_LEGACY_SKILL_SCHEMA'), 'Expected V03_LEGACY_SKILL_SCHEMA');
  });

  await test('gRPC interface with https:// prefix is flagged as GRPC_INVALID_URL_SCHEME', async () => {
    const r = await validateJson(GRPC_BAD_URL_CARD);
    assert.ok(r.findings.some(f => f.code === 'GRPC_INVALID_URL_SCHEME'),
      'Expected GRPC_INVALID_URL_SCHEME finding');
  });

  await test('Skill with no examples triggers SKILL_EXAMPLES_MISSING warning', async () => {
    const r = await validateJson(NO_EXAMPLES_CARD);
    assert.ok(r.findings.some(f => f.code === 'SKILL_EXAMPLES_MISSING'));
  });

  await test('Skill with 1 example triggers SKILL_EXAMPLES_FEW info', async () => {
    const r = await validateJson(NO_EXAMPLES_CARD);
    assert.ok(r.findings.some(f => f.code === 'SKILL_EXAMPLES_FEW'));
  });

  await test('Undeclared security scheme reference triggers SECURITY_SCHEME_UNDECLARED', async () => {
    const r = await validateJson(SECURITY_MISMATCH_CARD);
    assert.ok(r.findings.some(f => f.code === 'SECURITY_SCHEME_UNDECLARED'));
  });

  await test('Payload over 10KB triggers PAYLOAD_EXCEEDS_10KB warning', async () => {
    const r = await validateJson(OVERSIZED_CARD);
    assert.ok(r.findings.some(f => f.code === 'PAYLOAD_EXCEEDS_10KB'));
  });

  await test('No JWS signatures produces SIGNATURES_ABSENT info (not an error)', async () => {
    const r = await validateJson(VALID_CARD);
    const sig = r.findings.find(f => f.code === 'SIGNATURES_ABSENT');
    assert.ok(sig, 'Expected SIGNATURES_ABSENT info finding');
    assert.equal(sig.severity, 'info');
  });

  await test('Role enum v0.3 pattern detected', async () => {
    const card = { ...VALID_CARD, _embeddedMsg: { role: 'user', text: 'hello' } };
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'V03_LEGACY_ROLE_ENUM'));
  });

  await test('State enum v0.3 pattern detected', async () => {
    const card = { ...VALID_CARD, _status: { state: 'completed' } };
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'V03_LEGACY_STATE_ENUM'));
  });

  await test('Part kind discriminator v0.3 pattern detected', async () => {
    const card = { ...VALID_CARD, _parts: [{ kind: 'text', text: 'hi' }] };
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'V03_LEGACY_PART_KIND'));
  });

  await test('Package name reverse-DNS format is checked', async () => {
    const r = await validateJson(VALID_CARD);
    assert.ok(r.findings.some(f => f.code === 'PACKAGE_NAME_VALID'));
  });

  await test('Non-standard package_name triggers PACKAGE_NAME_NON_STANDARD warning', async () => {
    const card = { ...VALID_CARD, package_name: 'myagent' }; // no dots
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'PACKAGE_NAME_NON_STANDARD'));
  });

  await test('Valid documentationUrl is flagged as pass', async () => {
    const card = { ...VALID_CARD, documentationUrl: 'https://docs.example.com' };
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'DOCUMENTATION_URL_VALID'));
  });

  await test('Invalid documentationUrl is flagged as warning', async () => {
    const card = { ...VALID_CARD, documentationUrl: 'not-a-url' };
    const r = await validateJson(card);
    assert.ok(r.findings.some(f => f.code === 'DOCUMENTATION_URL_INVALID'));
  });

  await test('Score is capped at 40 when Tier 1 error exists', async () => {
    const r = await validateJson(MISSING_REQUIRED_CARD);
    assert.ok(r.readinessScore <= 40, `Expected score <= 40, got ${r.readinessScore}`);
  });

  await test('Grade is Needs Work when Tier 1 errors exist', async () => {
    const r = await validateJson(MISSING_REQUIRED_CARD);
    assert.equal(r.grade, 'Needs Work');
  });

  await test('cardData is returned in report', async () => {
    const r = await validateJson(VALID_CARD);
    assert.ok(r.cardData, 'Expected cardData in report');
    assert.equal(r.cardData.name, VALID_CARD.name);
  });
}

async function runIndexApiTests() {
  console.log('\n\x1b[1m▸ validateManifest() — index.js routing\x1b[0m');

  await test('Object input routes to validateJson (isOffline=true)', async () => {
    const r = await validateManifest(VALID_CARD);
    assert.ok(r.isOffline);
    assert.ok(r.isValid);
  });

  await test('JSON string input routes to validateJson (isOffline=true)', async () => {
    const r = await validateManifest(JSON.stringify(VALID_CARD));
    assert.ok(r.isOffline);
    assert.ok(r.isValid);
  });

  await test('https:// string routes to validateUrl (isOffline=false)', async () => {
    // We can't actually hit a network in tests, but we can check the routing
    // by passing a clearly invalid host and confirming Tier 2 fires
    const r = await validateManifest('https://a2a-validate-nonexistent-host-12345.invalid');
    assert.ok(!r.isOffline);
    assert.ok(r.findings.some(f => f.tier === 'tier2_network' && f.severity === 'error'),
      'Expected a Tier 2 network error for unreachable host');
  });
}

async function runCliTests() {
  console.log('\n\x1b[1m▸ CLI — bin/cli.js\x1b[0m');

  // ── Flag tests (no file needed) ────────────────────────────────────────

  await test('--help outputs usage text and exits 0', () => {
    const out = cli('--help');
    assert.ok(out.includes('Usage: a2a-validate'), 'Missing "Usage: a2a-validate" in --help output');
    assert.ok(out.includes('--format=json'), 'Missing --format=json in --help output');
  });

  await test('-h flag works as alias for --help', () => {
    const out = cli('-h');
    assert.ok(out.includes('Usage: a2a-validate'));
  });

  await test('--version outputs semver and exits 0', () => {
    const v = cli('--version').trim();
    assert.match(v, /^\d+\.\d+\.\d+$/, `Expected semver, got: '${v}'`);
  });

  await test('-v flag works as alias for --version', () => {
    const v = cli('-v').trim();
    assert.match(v, /^\d+\.\d+\.\d+$/);
  });

  await test('No arguments exits with code 2', () => {
    const r = cliResult('');
    assert.equal(r.code, 2, `Expected exit code 2, got ${r.code}`);
  });

  await test('Nonexistent file exits with code 2', () => {
    const r = cliResult('"/tmp/this-file-does-not-exist-9999.json"');
    assert.equal(r.code, 2, `Expected exit code 2, got ${r.code}`);
  });

  // ── Valid card: exit 0 ─────────────────────────────────────────────────

  await test('Valid card file exits 0', async () => {
    const file = writeTmp(VALID_CARD);
    try {
      const r = cliResult(`"${file}"`);
      assert.equal(r.code, 0, `Expected exit 0, got ${r.code}. stderr: ${r.stderr}`);
    } finally {
      unlinkSync(file);
    }
  });

  await test('Valid card: human output contains grade', async () => {
    const file = writeTmp(VALID_CARD);
    try {
      const r = cliResult(`"${file}" --no-color`);
      assert.ok(r.stdout.includes('Grade'), `Expected "Grade" in output, got: ${r.stdout.slice(0, 300)}`);
    } finally {
      unlinkSync(file);
    }
  });

  await test('Valid card --format=json outputs parseable JSON', async () => {
    const file = writeTmp(VALID_CARD);
    try {
      const r = cliResult(`"${file}" --format=json`);
      assert.equal(r.code, 0, `Expected exit 0, got ${r.code}`);
      const report = JSON.parse(r.stdout);
      assert.ok(report.isValid, 'Expected isValid=true in JSON output');
      assert.ok(typeof report.readinessScore === 'number');
      assert.ok(Array.isArray(report.findings));
    } finally {
      unlinkSync(file);
    }
  });

  // ── Invalid card: exit 1 ───────────────────────────────────────────────

  await test('Missing-required-fields card exits 1', async () => {
    const file = writeTmp(MISSING_REQUIRED_CARD);
    try {
      const r = cliResult(`"${file}"`);
      assert.equal(r.code, 1, `Expected exit 1, got ${r.code}`);
    } finally {
      unlinkSync(file);
    }
  });

  await test('Invalid JSON file exits 1', async () => {
    const file = path.join(tmpdir(), `a2a_bad_${Date.now()}.json`);
    require('node:fs').writeFileSync(file, '{ broken json !!!', 'utf-8');
    try {
      const r = cliResult(`"${file}"`);
      assert.equal(r.code, 1, `Expected exit 1, got ${r.code}`);
    } finally {
      unlinkSync(file);
    }
  });

  // ── --fail-on=warning ──────────────────────────────────────────────────

  await test('Card with warnings exits 0 by default (no --fail-on=warning)', async () => {
    // NO_EXAMPLES_CARD has warnings but no errors
    const file = writeTmp(NO_EXAMPLES_CARD);
    try {
      const r = cliResult(`"${file}"`);
      assert.equal(r.code, 0, `Expected exit 0 without --fail-on=warning, got ${r.code}`);
    } finally {
      unlinkSync(file);
    }
  });

  await test('Card with warnings exits 1 with --fail-on=warning', async () => {
    const file = writeTmp(NO_EXAMPLES_CARD);
    try {
      const r = cliResult(`"${file}" --fail-on=warning`);
      assert.equal(r.code, 1, `Expected exit 1 with --fail-on=warning, got ${r.code}`);
    } finally {
      unlinkSync(file);
    }
  });

  // ── v0.3 card detection in CLI ─────────────────────────────────────────

  await test('v0.3 card: JSON output specVersionDetected=v0.3', async () => {
    const file = writeTmp(V03_LEGACY_CARD);
    try {
      const r = cliResult(`"${file}" --format=json`);
      const report = JSON.parse(r.stdout);
      assert.equal(report.specVersionDetected, 'v0.3');
    } finally {
      unlinkSync(file);
    }
  });

  // ── --no-color ─────────────────────────────────────────────────────────

  await test('--no-color suppresses ANSI escape sequences', async () => {
    const file = writeTmp(VALID_CARD);
    try {
      const r = cliResult(`"${file}" --no-color`);
      assert.ok(!r.stdout.includes('\x1b['), `Expected no ANSI codes, found some in output`);
    } finally {
      unlinkSync(file);
    }
  });

  // ── gRPC URL error appears in CLI output ───────────────────────────────

  await test('gRPC bad URL: error in --format=json findings', async () => {
    const file = writeTmp(GRPC_BAD_URL_CARD);
    try {
      const r = cliResult(`"${file}" --format=json`);
      const report = JSON.parse(r.stdout);
      assert.ok(
        report.findings.some(f => f.code === 'GRPC_INVALID_URL_SCHEME'),
        'Expected GRPC_INVALID_URL_SCHEME in JSON findings'
      );
    } finally {
      unlinkSync(file);
    }
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

(async () => {
  console.log('\x1b[1m@a2a-registry/validate — Offline Test Suite\x1b[0m');
  console.log('─────────────────────────────────────────────');

  await runValidatorApiTests();
  await runIndexApiTests();
  await runCliTests();

  console.log('\n─────────────────────────────────────────────');
  if (failed === 0) {
    console.log(`\x1b[32m\x1b[1m✔ All ${passed} tests passed.\x1b[0m\n`);
    process.exit(0);
  } else {
    console.error(`\x1b[31m\x1b[1m✖ ${failed} test(s) failed, ${passed} passed.\x1b[0m`);
    for (const { label, error } of failures) {
      console.error(`\n  ✖ ${label}`);
      console.error(`    ${error.message}`);
    }
    console.log('');
    process.exit(1);
  }
})();
