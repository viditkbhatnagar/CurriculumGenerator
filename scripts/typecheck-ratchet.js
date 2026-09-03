#!/usr/bin/env node
/**
 * Fail a commit that adds TypeScript errors, and say which ones.
 *
 * A `config is not defined` error reached production and cost the programme's reviewer
 * forty-five minutes: she started a Step 8 regeneration, waited, and was handed a
 * ReferenceError at the end of it. The compiler had reported that error all along. Nothing
 * was checking — the pre-commit hook ran eslint and prettier, neither of which resolves
 * identifiers across modules.
 *
 * A plain `tsc` gate cannot work here: the repository already carries a few hundred known
 * errors in files nobody is touching (seed data, examples, a mock repository), so demanding
 * zero would mean the hook is switched off on day one. This is a ratchet instead — the count
 * may fall, never rise.
 *
 * Errors are compared by SIGNATURE (file + code + message) rather than by raw line, because
 * line numbers shift with every edit and comparing them literally reports dozens of false
 * "new" errors for a one-line change. That way the hook prints the error you actually
 * introduced instead of the several hundred that were already there.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..', 'packages', 'backend');
const BASELINE = path.join(__dirname, 'typecheck-baseline.json');

/** `src/a.ts(12,3): error TS2304: Cannot find name 'x'.` -> `src/a.ts|TS2304|Cannot find name 'x'.` */
function signature(line) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  return m ? `${m[1]}|${m[4]}|${m[5]}` : line.trim();
}

function currentErrors() {
  try {
    execSync('npx tsc --noEmit -p tsconfig.json', { cwd: PKG, stdio: 'pipe' });
    return [];
  } catch (err) {
    const out = String(err.stdout || '') + String(err.stderr || '');
    return out.split('\n').filter((l) => / error TS\d+: /.test(l));
  }
}

const errors = currentErrors();
const sigs = errors.map(signature).sort();

if (!fs.existsSync(BASELINE)) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify({ count: sigs.length, signatures: sigs }, null, 2) + '\n'
  );
  console.log(`[typecheck] baseline recorded at ${sigs.length} errors`);
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const baseSigs = base.signatures || [];

// Multiset difference: an error signature appearing more often than at baseline is new.
const remaining = baseSigs.slice();
const added = [];
for (const s of sigs) {
  const at = remaining.indexOf(s);
  if (at === -1) added.push(s);
  else remaining.splice(at, 1);
}

if (added.length > 0) {
  console.error(
    `\n[typecheck] BLOCKED: this commit introduces ${added.length} TypeScript error(s).\n`
  );
  for (const s of added) {
    const [file, code, msg] = s.split('|');
    const full = errors.find((e) => signature(e) === s) || '';
    const loc = full.match(/\((\d+),(\d+)\)/);
    console.error(`  ${file}${loc ? `:${loc[1]}` : ''}  ${code}: ${msg}`);
  }
  console.error('\n[typecheck] Fix these before committing (--no-verify overrides, but this is');
  console.error('[typecheck] the check that would have caught the config error users hit).\n');
  process.exit(1);
}

if (sigs.length < baseSigs.length) {
  fs.writeFileSync(
    BASELINE,
    JSON.stringify({ count: sigs.length, signatures: sigs }, null, 2) + '\n'
  );
  console.log(`[typecheck] errors down ${baseSigs.length} -> ${sigs.length}; baseline tightened`);
} else {
  console.log(`[typecheck] ${sigs.length} errors, none new`);
}
