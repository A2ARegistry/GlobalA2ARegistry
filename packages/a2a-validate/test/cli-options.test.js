'use strict';
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { run } = require('../bin/cli');

let checks = 0;
async function invoke(args, api = {}) {
  let stdout = '', stderr = '';
  const calls = [];
  const report = { grade: 'A', readinessScore: 90, findings: [], isValid: true };
  const defaults = {
    readFileSync(file, encoding) { calls.push(['file', file, encoding]); return '{}'; },
    async validateJson(raw) { calls.push(['json', raw]); return report; },
    async validateUrl(url) { calls.push(['url', url]); return report; },
  };
  const code = await run(args, { stdout: { write(s) { stdout += s; } },
    stderr: { write(s) { stderr += s; } } }, { ...defaults, ...api });
  checks++;
  return { code, stdout, stderr, calls };
}

(async () => {
  for (const args of [[], ['--bogus'], ['--format=xml', 'https://example.invalid'],
    ['--format'], ['--fail-on=info', 'https://example.invalid'],
    ['--help', 'https://example.invalid'], ['--help', '--version'],
    ['card.json', 'other.json'], ['--format=json', '--format=text', 'card.json'],
    ['--format=json', '--format=json', 'card.json'], ['--no-color=true', 'card.json'],
    ['--no-color', '--no-color', 'card.json'], ['ftp://example.invalid'],
    ['https://user:password@example.invalid'], ['a2a://user@example.invalid'],
    ['https://example.invalid/a b'], ['https://']]) {
    const result = await invoke(args);
    assert.equal(result.code, 2);
    assert.deepEqual(result.calls, []);
    if (args.includes('--format=json')) assert.equal(JSON.parse(result.stdout).error.code, 'USAGE');
  }
  for (const target of ['agent-card.json', 'example.com', 'space ; $(touch proof) `x`.json', './https://card.json']) {
    const result = await invoke([target, '--format=json']);
    assert.equal(result.code, 0);
    assert.deepEqual(result.calls, [['file', target, 'utf8'], ['json', '{}']]);
    assert.equal(JSON.parse(result.stdout).isValid, true);
  }
  const dash = await invoke(['--', '-card.json']);
  assert.equal(dash.calls[0][1], '-card.json');
  for (const target of ['http://example.invalid/card.json', 'https://example.invalid', 'a2a://example.invalid']) {
    const result = await invoke([target]);
    assert.equal(result.code, 0);
    assert.deepEqual(result.calls, [['url', new URL(target).href]]);
  }
  const warnings = { grade: 'B', readinessScore: 75, findings: [{ severity: 'warning', code: 'W', message: 'Fabricated warning' }] };
  assert.equal((await invoke(['card.json'], { validateJson: async () => warnings })).code, 0);
  assert.equal((await invoke(['card.json', '--fail-on', 'warning'], { validateJson: async () => warnings })).code, 1);
  const errors = { ...warnings, findings: [{ severity: 'error', code: 'E', message: 'Fabricated error' }] };
  assert.equal((await invoke(['card.json', '--fail-on=warning'], { validateJson: async () => errors })).code, 1);
  const controls = { ...warnings, findings: [{ severity: 'warning', code: 'W', message: '\x1b[31munsafe\x1b[0m' }] };
  const plain = await invoke(['card.json', '--no-color'], { validateJson: async () => controls });
  assert.ok(!plain.stdout.includes('\x1b'));
  const io = await invoke(['card.json', '--format=json'], { readFileSync: () => { throw new Error('private detail'); } });
  assert.equal(io.code, 2);
  assert.equal(JSON.parse(io.stdout).error.code, 'IO');
  assert.equal(io.stderr, '');
  assert.ok(!io.stdout.includes('private detail'));

  if (process.argv.includes('--in-process')) {
    console.log(`CLI options: ${checks} in-process cases passed; child execution NOT RUN.`);
    return;
  }

  // Real unsigned file and invalid JSON are processed without fetch/DNS/JWKS.
  const root = mkdtempSync(path.join(tmpdir(), 'a2a-cli-path-'));
  try {
    const guard = path.join(root, 'guard.cjs');
    writeFileSync(guard, `const stop=()=>{throw new Error('Network forbidden')};globalThis.fetch=stop;require('node:https').get=stop;require('node:dns/promises').resolveTxt=stop;require('node:net').Socket.prototype.connect=stop;`);
    const file = path.join(root, 'card ; $(touch PROOF) `echo x`.json');
    writeFileSync(file, '{}');
    const cli = path.resolve(__dirname, '../bin/cli.js');
    function child(target) {
      try { return { code: 0, out: execFileSync(process.execPath, ['--require', guard, cli, target, '--format=json'], { encoding: 'utf8' }) }; }
      catch (e) {
        if (e.error || e.code === 'EPERM' || e.status === null) throw e;
        return { code: e.status, out: e.stdout.toString() };
      }
    }
    const invalid = child(file);
    checks++;
    assert.equal(invalid.code, 1);
    assert.ok(JSON.parse(invalid.out).findings.some(f => f.severity === 'error'));
    writeFileSync(file, '{invalid');
    const syntax = child(file);
    checks++;
    assert.equal(syntax.code, 1);
    assert.ok(JSON.parse(syntax.out).findings.some(f => f.code === 'INVALID_JSON_SYNTAX'));
    assert.equal(require('node:fs').existsSync(path.join(root, 'PROOF')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
  console.log(`CLI options: ${checks} cases passed, all I/O fabricated or guarded unsigned TEMP files.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
