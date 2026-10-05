#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { validateJson, validateUrl } = require('../src/validator');
const { version } = require('../package.json');

const HELP = `Usage: a2a-validate <file | http(s)://URL | a2a://handle> [options]

Options:
  --help, -h          Show this help (alone)
  --version, -v       Show package version (alone)
  --format=json       JSON report (default: text; also --format json)
  --fail-on=warning   Fail on warnings or errors (default: error)
  --no-color         Plain output (the CLI emits no ANSI colors)
  --                 End options; allow filenames beginning with a dash

Exactly one target is required. Repeated or unknown options are errors.
Bare domains and dotted names are local files; URLs need an explicit scheme.
URL mode delegates to the existing library. Signed files may fetch JWS keys.
Exit codes: 0 passes threshold; 1 validation threshold; 2 usage or I/O failure.
`;

class CliError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function parseArgs(args) {
  const options = { format: 'text', failOn: 'error', target: null };
  const seen = new Set();
  let positional = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!positional && arg === '--') { positional = true; continue; }
    if (!positional && arg.startsWith('-')) {
      const [name, ...parts] = arg.split('=');
      const value = parts.join('=');
      const key = { '-h': 'help', '--help': 'help', '-v': 'version', '--version': 'version',
        '--format': 'format', '--fail-on': 'failOn', '--no-color': 'noColor' }[name];
      if (!key) throw new CliError('USAGE', 'Unknown option. See --help.');
      if (seen.has(key)) throw new CliError('USAGE', 'Repeated option. See --help.');
      seen.add(key);
      if (key === 'format' || key === 'failOn') {
        const setting = parts.length ? value : args[++i];
        const allowed = key === 'format' ? ['json', 'text'] : ['error', 'warning'];
        if (!allowed.includes(setting)) throw new CliError('USAGE', 'Invalid option value. See --help.');
        options[key] = setting;
      } else {
        if (parts.length) throw new CliError('USAGE', 'This option takes no value. See --help.');
        options[key] = true;
      }
    } else {
      if (options.target !== null || arg.length === 0) throw new CliError('USAGE', 'Exactly one target is required.');
      options.target = arg;
    }
  }
  if (options.help || options.version) {
    if (seen.size !== 1 || options.target !== null) throw new CliError('USAGE', 'Help and version must be used alone.');
    return options;
  }
  if (options.target === null) throw new CliError('USAGE', 'Exactly one target is required.');
  options.remote = /^[a-z][a-z0-9+.-]*:\/\//i.test(options.target);
  if (options.remote) {
    let url;
    try { url = new URL(options.target); } catch { throw new CliError('USAGE', 'Invalid explicit URL.'); }
    if (!['http:', 'https:', 'a2a:'].includes(url.protocol) || !url.hostname
        || url.username || url.password || /\s/.test(options.target)) {
      throw new CliError('USAGE', 'Use an HTTP(S) or a2a URL without embedded credentials or whitespace.');
    }
    options.target = url.href;
  }
  return options;
}

function wantsJson(args) {
  const end = args.indexOf('--');
  const flags = end < 0 ? args : args.slice(0, end);
  return flags.some((arg, i) => arg === '--format=json' || (arg === '--format' && flags[i + 1] === 'json'));
}

function plain(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}

async function run(args, io = { stdout: process.stdout, stderr: process.stderr },
                   api = { readFileSync, validateJson, validateUrl }) {
  let format = wantsJson(args) ? 'json' : 'text';
  try {
    const options = parseArgs(args);
    format = options.format;
    if (options.help) { io.stdout.write(HELP); return 0; }
    if (options.version) { io.stdout.write(version + '\n'); return 0; }
    let report;
    if (options.remote) {
      report = await api.validateUrl(options.target);
    } else {
      let raw;
      try { raw = api.readFileSync(options.target, 'utf8'); }
      catch { throw new CliError('IO', 'Unable to read input file.'); }
      // Explicit routing avoids the programmatic API's bare-domain heuristic.
      report = await api.validateJson(raw);
    }
    if (format === 'json') io.stdout.write(JSON.stringify(report) + '\n');
    else {
      io.stdout.write(`Grade: ${plain(report.grade)}\nReadiness Score: ${plain(report.readinessScore)}/100\n`);
      for (const finding of report.findings) {
        io.stdout.write(`${plain(finding.severity.toUpperCase())} ${plain(finding.code)}: ${plain(finding.message)}\n`);
      }
    }
    return report.findings.some(f => f.severity === 'error' ||
      (options.failOn === 'warning' && f.severity === 'warning')) ? 1 : 0;
  } catch (error) {
    const known = error instanceof CliError;
    const output = { error: { code: known ? error.code : 'IO',
      message: known ? error.message : 'Validation failed to complete.' } };
    if (format === 'json') io.stdout.write(JSON.stringify(output) + '\n');
    else io.stderr.write(`a2a-validate: ${output.error.message}\n`);
    return 2;
  }
}

module.exports = { parseArgs, run };
if (require.main === module) run(process.argv.slice(2)).then(code => { process.exitCode = code; });
