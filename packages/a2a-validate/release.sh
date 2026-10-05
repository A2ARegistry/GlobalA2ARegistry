#!/bin/bash
# Release script for @a2aregistry/validate
# Usage: ./release.sh
#
# Steps:
#   1. Preflight checks (node, npm, auth)
#   2. Run full test suite
#   3. Preview package contents + security check
#   4. Confirm and publish

set -euo pipefail

PACKAGE_NAME="@a2aregistry/validate"
VERSION=$(node -p "require('./package.json').version")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Release: ${PACKAGE_NAME}@${VERSION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Preflight ──────────────────────────────────────────────────────────────

echo "▸ Preflight checks..."

# Node.js >= 18 required
NODE_MAJOR=$(node -p "parseInt(process.versions.node)")
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "  ✖ Node.js >= 18 required (found $(node --version))"
  exit 1
fi
echo "  ✔ Node.js $(node --version)"

# npm logged in?
NPM_USER=$(npm whoami 2>/dev/null || true)
if [[ -z "$NPM_USER" ]]; then
  echo "  ✖ Not logged in to npm. Run: npm login"
  exit 1
fi
echo "  ✔ npm logged in as: ${NPM_USER}"

# Uncommitted changes?
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo ""
  echo "  ⚠  Uncommitted changes detected:"
  git status --short
  echo ""
  read -rp "  Continue anyway? (y/N) " reply
  echo ""
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled."
    exit 1
  fi
else
  echo "  ✔ Working tree clean"
fi

# Check the version doesn't already exist on npm
PUBLISHED=$(npm view "${PACKAGE_NAME}@${VERSION}" version 2>/dev/null || true)
if [[ "$PUBLISHED" == "$VERSION" ]]; then
  echo ""
  echo "  ✖ ${PACKAGE_NAME}@${VERSION} is already published on npm."
  echo "    Bump the version in package.json and bin/cli.js before releasing."
  exit 1
fi
echo "  ✔ Version ${VERSION} not yet published"

echo ""

echo "▸ Running build (compile-schema)..."
node scripts/compile-schema.mjs
echo ""

# ── 2. Test suite ─────────────────────────────────────────────────────────────

echo "▸ Running test suite..."
echo ""

node test/security.test.js
node test/cli.test.js

echo ""

# ── 3. Package preview + security check ──────────────────────────────────────

echo "▸ Package contents preview (npm pack --dry-run):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PACK_OUTPUT=$(npm pack --dry-run 2>&1)
echo "$PACK_OUTPUT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Block .env files from being included
if echo "$PACK_OUTPUT" | grep -qE "(^|\s)\.env(\s|$)"; then
  echo "🚨 SECURITY: .env file detected in package contents."
  echo "❌ Release cancelled."
  exit 1
fi

# Block node_modules from being included
if echo "$PACK_OUTPUT" | grep -q "node_modules"; then
  echo "🚨 node_modules detected in package contents — check your .npmignore."
  echo "❌ Release cancelled."
  exit 1
fi

echo "  ✔ No .env files or node_modules in package"
echo ""

# ── 4. Confirm and publish ────────────────────────────────────────────────────

read -rp "▸ Publish ${PACKAGE_NAME}@${VERSION} to npm? (y/N) " confirm
echo ""
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "❌ Release cancelled."
  exit 1
fi

echo "▸ Publishing..."
npm publish --access public

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Published ${PACKAGE_NAME}@${VERSION}"
echo ""
echo "  npx ${PACKAGE_NAME} --version"
echo "  https://www.npmjs.com/package/${PACKAGE_NAME}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
