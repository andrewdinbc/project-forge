#!/usr/bin/env node
// scripts/check-server-client-usage.js
//
// Durable guard (2026-07-20) against a bug class that's now been found
// and fixed THREE times in this repo: a server route (app/api/**) calls
// a lib/bundles.js or lib/products.js function without passing the
// supabaseAdmin client, silently falling back to the anon client. Server
// routes have no browser session, so auth.uid() is null there and RLS
// blocks the read/write -- either a confusing "new row violates row-level
// security policy" error, or a silent empty-result 404, depending on the
// call. Found & fixed 2026-07-19 across most of lib/products.js's
// callers, missed on push-to-steering, and missed entirely on
// lib/bundles.js until the new auto-generate orchestrator hit it fresh
// 2026-07-20. Per-callsite fixes clearly don't stick -- this script is
// the structural guard instead: run it and it tells you exactly which
// callsite is still missing the client.
//
// Usage: node scripts/check-server-client-usage.js
// Exits non-zero (and prints every offending line) if it finds one.
//
// This is a regex-based heuristic, not real static analysis -- it can
// have false positives (e.g. a call whose client arg is a variable that
// happens not to be named admin/supabaseAdmin/client) and false
// negatives (multi-line calls where the client arg is on the following
// line). Good enough to catch the exact real-world pattern this bug has
// taken every time so far; not a substitute for actually reading the
// diff on a new server route.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API_DIR = path.join(ROOT, 'app', 'api');

// Functions whose LAST parameter is an optional Supabase client
// (client = supabase) -- see lib/bundles.js and lib/products.js.
const GUARDED_FNS = [
  'createBundle', 'getUserBundles', 'getBundle', 'updateBundle', 'deleteBundle',
  'addProductToBundle', 'removeProductFromBundle', 'reorderBundleItems',
  'createProduct', 'getUserProducts', 'getProduct', 'updateProduct', 'deleteProduct',
  'getBundleProducts',
];
const CLIENT_HINTS = /\b(admin|supabaseAdmin)\b/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/route\.(ts|tsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function checkFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  const problems = [];

  for (const fn of GUARDED_FNS) {
    const callRe = new RegExp(`\\b${fn}\\s*\\(`, 'g');
    let m;
    while ((m = callRe.exec(src))) {
      // Find the matching close paren via simple depth counting from the
      // call's open paren -- handles nested calls/objects fine for the
      // single-statement style this codebase uses.
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < src.length && depth > 0) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
        i++;
      }
      const argsText = src.slice(m.index + m[0].length, i - 1);
      if (!CLIENT_HINTS.test(argsText)) {
        const lineNo = src.slice(0, m.index).split('\n').length;
        problems.push({ fn, lineNo, line: lines[lineNo - 1]?.trim() });
      }
    }
  }
  return problems;
}

const files = fs.existsSync(API_DIR) ? walk(API_DIR) : [];
let found = 0;

for (const file of files) {
  const problems = checkFile(file);
  for (const p of problems) {
    found++;
    console.error(`${path.relative(ROOT, file)}:${p.lineNo}  ${p.fn}(...) called with no admin/supabaseAdmin client\n    ${p.line}`);
  }
}

if (found > 0) {
  console.error(`\n${found} server-route call(s) missing the admin client -- these will silently hit RLS. See lib/bundles.js / lib/products.js header comments.`);
  process.exit(1);
} else {
  console.log(`OK -- ${files.length} route file(s) checked, no missing-admin-client calls found.`);
}
