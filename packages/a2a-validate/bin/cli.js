#!/usr/bin/env node
'use strict';

/**
 * @a2a-registry/validate CLI
 * Linux Foundation A2A Protocol v1.0 — fully self-contained offline validator.
 * No registry API required. Runs Tier 1–4 locally.
 *
 * Usage:
 *   a2a-validate <url-or-filepath> [options]
 *
 * Arguments:
 *   <url-or-filepath>   https:// URL, GoDaddy ANS handle (a2a://), or path to a local .json file
 *
 * Options:
 *   --format=json       Output full structured JSON report to stdout
 *   --fail-on=warning   Exit 1 on any warning or error (default: exit 1 on error only)
 *   --fail-on=error     Exit 1 only on errors (default)
 *   --no-color          Disable ANSI colour output
 *   --help, -h          Show this help message
 *   --version, -v       Print version and exit
 *
 * Exit codes:
 *   0   Validation passed (within --fail-on threshold)
 *   1   Validation failed or errors/warnings found
 *   2   Usage error (bad arguments, file not found)
 */

const fs = require('node:fs');
const path = require('node:path');
const { validateJson, validateUrl } = require('../src/validator');

// ─── helpers ──────────────────────────────────────────────────────────────

const VERSION = '1.0.0';

function printUsage() {
  process.stdout.write(`
Usage: a2a-validate <url-or-filepath> [options]

Arguments:
  <url-or-filepath>   https:// URL, a2a:// ANS handle, or local path to agent-card.json

Options:
  --format=json       Output structured JSON report to stdout
  --fail-on=warning   Exit 1 on warnings or errors  (default: errors only)
  --fail-on=error     Exit 1 on errors only          (default)
  --no-color          Disable ANSI colour in human-readable output
  --help, -h          Show this help message
  --version, -v       Print version and exit

Examples:
  a2a-validate ./agent-card.json
  a2a-validate https://my-agent.example.com
  a2a-validate a2a://my-agent.godaddy.com --format=json
  a2a-validate ./agent-card.json --fail-on=warning
`);
}

// ANSI colour helpers — gracefully disabled with --no-color or non-TTY
let useColor = process.stdout.isTTY !== false;

const C = {
  reset:  () => useColor ? '\x1b[0m'  : '',
  bold:   () => useColor ? '\x1b[1m'  : '',
  dim:    () => useColor ? '\x1b[2m'  : '',
  green:  () => useColor ? '\x1b[32m' : '',
  yellow: () => useColor ? '\x1b[33m' : '',
  red:    () => useColor ? '\x1b[31m' : '',
  cyan:   () => useColor ? '\x1b[36m' : '',
  blue:   () => useColor ? '\x1b[34m' : '',
};

function severitySymbol(sev) {
  switch (sev) {
    case 'pass':    return `${C.green()}✔${C.reset()}`;
    case 'warning': return `${C.yellow()}▲${C.reset()}`;
    case 'error':   return `${C.red()}✖${C.reset()}`;
    default:        return `${C.cyan()}ℹ${C.reset()}`;
  }
}

function gradeColor(grade) {
  if (grade === 'A+' || grade === 'A') return C.green();
  if (grade === 'B')                   return C.cyan();
  if (grade === 'C')                   return C.yellow();
  return C.red();
}

// ─── human-readable renderer ──────────────────────────────────────────────

function renderHumanReport(report, target) {
  const { readinessScore, grade, specVersionDetected, findings, summary, metadata } = report;

  const isOfflineLabel = report.isOffline ? ' (offline)' : '';
  const timeLabel = metadata?.responseTimeMs ? ` — ${metadata.responseTimeMs}ms` : '';

  // Header
  process.stdout.write('\n');
  process.stdout.write(`${C.bold()}══════════════════════════════════════════════════════${C.reset()}\n`);
  process.stdout.write(` ${C.bold()}A2A Agent Card Validation Report${C.reset()}${isOfflineLabel}\n`);
  process.stdout.write(` Target : ${C.cyan()}${target}${C.reset()}${timeLabel}\n`);
  process.stdout.write(` Spec   : ${specVersionDetected}  │  `);
  process.stdout.write(`Grade : ${gradeColor(grade)}${C.bold()}${grade}${C.reset()}  │  `);
  process.stdout.write(`Score : ${gradeColor(grade)}${C.bold()}${readinessScore}/100${C.reset()}\n`);
  process.stdout.write(`${C.bold()}══════════════════════════════════════════════════════${C.reset()}\n\n`);

  // Group findings by tier
  const tiers = ['tier1_schema', 'tier2_network', 'tier3_discovery', 'tier4_trust'];
  const tierNames = {
    tier1_schema:    '1. Schema & Structure',
    tier2_network:   '2. Network & Hosting',
    tier3_discovery: '3. Discovery & Semantics',
    tier4_trust:     '4. Cryptographic Trust',
  };
  const tierStatuses = {
    tier2_network: summary.tier2Status,
  };

  for (const tier of tiers) {
    const tierFindings = findings.filter((f) => f.tier === tier);
    if (tierFindings.length === 0) continue;

    const status = tierStatuses[tier];
    const skipped = status === 'skipped';

    process.stdout.write(`${C.bold()}${C.blue()}${tierNames[tier]}${C.reset()}`);
    if (skipped) process.stdout.write(`  ${C.dim()}(skipped — offline mode)${C.reset()}`);
    process.stdout.write('\n');

    for (const f of tierFindings) {
      process.stdout.write(`  ${severitySymbol(f.severity)} ${C.bold()}${f.title}${C.reset()}\n`);
      process.stdout.write(`     ${f.message}\n`);
      if (f.suggestion) {
        process.stdout.write(`     ${C.dim()}→ ${f.suggestion}${C.reset()}\n`);
      }
      process.stdout.write('\n');
    }
  }

  // Summary footer
  const errStr  = summary.totalErrors   > 0 ? `${C.red()}${summary.totalErrors} error(s)${C.reset()}`   : `${C.dim()}0 errors${C.reset()}`;
  const warnStr = summary.totalWarnings > 0 ? `${C.yellow()}${summary.totalWarnings} warning(s)${C.reset()}` : `${C.dim()}0 warnings${C.reset()}`;
  const passStr = `${C.green()}${summary.totalPasses} passed${C.reset()}`;

  process.stdout.write(`${C.bold()}Summary:${C.reset()}  ${passStr}  •  ${warnStr}  •  ${errStr}\n`);

  if (metadata?.signaturesVerified !== undefined && metadata.signaturesVerified > 0) {
    process.stdout.write(`${C.green()}  ✔ ${metadata.signaturesVerified} JWS signature(s) cryptographically verified${C.reset()}\n`);
  }
  if (metadata?.dnsTxtFound) {
    process.stdout.write(`${C.green()}  ✔ DNS TXT ownership record verified${C.reset()}\n`);
  }

  process.stdout.write('\n');

  // CTA when clean
  if (summary.totalErrors === 0 && summary.totalWarnings === 0) {
    process.stdout.write(`${C.green()}${C.bold()}✔ Card is ready to publish!${C.reset()} → https://a2a-registry.org/submit\n\n`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2);

  // Flags
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUsage();
    process.exit(rawArgs.length === 0 ? 2 : 0);
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }

  if (rawArgs.includes('--no-color')) useColor = false;

  const isJsonFormat  = rawArgs.includes('--format=json');
  const failOnWarning = rawArgs.includes('--fail-on=warning');

  // First positional arg is the target
  const target = rawArgs.find((a) => !a.startsWith('-'));
  if (!target) {
    process.stderr.write('Error: Please provide a target URL or file path.\n');
    printUsage();
    process.exit(2);
  }

  // ── Decide: URL/ANS vs local file ────────────────────────────────────────
  let report;

  const isUrl =
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('a2a://');

  if (isUrl) {
    // Live URL probe — Tiers 1–4, network required
    if (!isJsonFormat) {
      process.stderr.write(`${C.dim()}Probing ${target} …${C.reset()}\n`);
    }
    report = await validateUrl(target);

  } else {
    // Local file — offline, Tiers 1, 3, 4
    const resolved = path.resolve(process.cwd(), target);

    if (!fs.existsSync(resolved)) {
      process.stderr.write(`Error: File not found: '${resolved}'\n`);
      process.exit(2);
    }

    let rawContent;
    try {
      rawContent = fs.readFileSync(resolved, 'utf-8');
    } catch (e) {
      process.stderr.write(`Error: Could not read file '${resolved}': ${e.message}\n`);
      process.exit(2);
    }

    if (!isJsonFormat) {
      process.stderr.write(`${C.dim()}Validating ${resolved} (offline) …${C.reset()}\n`);
    }

    report = await validateJson(rawContent);
  }

  // ── Output ────────────────────────────────────────────────────────────────
  if (isJsonFormat) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    renderHumanReport(report, target);
  }

  // ── Exit code ─────────────────────────────────────────────────────────────
  const hasErrors   = report.summary.totalErrors   > 0;
  const hasWarnings = report.summary.totalWarnings > 0;

  if (hasErrors || (failOnWarning && hasWarnings)) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.message}\n`);
  if (process.env.DEBUG) process.stderr.write(err.stack + '\n');
  process.exit(1);
});
