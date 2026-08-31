#!/usr/bin/env node
// Classify a migration by whether deploying it can be undone: destructive (data cannot be
// reconstructed from the schema), tightening (can fail on existing rows and halt a deploy midway),
// additive (reversible by dropping what it added). Three ways rather than one warning, because a
// checker that fires on every migration is one nobody reads. It reads SQL text, not intent.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const DESTRUCTIVE = [
  [/\bDROP\s+COLUMN\b/i, "drops a column — its values are not recoverable"],
  [/\bDROP\s+TABLE\b/i, "drops a table — its rows are not recoverable"],
  [/\bTRUNCATE\b/i, "truncates — every row goes"],
  [/\bDELETE\s+FROM\b/i, "deletes rows"],
  [/\bDROP\s+TYPE\b/i, "drops a type — columns using it go with it"],
  [
    /\bALTER\s+COLUMN\s+\S+\s+TYPE\b/i,
    "changes a column's type — a narrowing cast silently loses precision or truncates",
  ],
];
const TIGHTENING = [
  [/\bSET\s+NOT\s+NULL\b/i, "fails if any existing row holds NULL"],
  [/\bADD\s+CONSTRAINT\b[\s\S]*\b(UNIQUE|CHECK|FOREIGN\s+KEY)\b/i, "fails if existing rows violate it"],
  [/\bCREATE\s+UNIQUE\s+INDEX\b/i, "fails if existing rows are not unique"],
];
// DROP INDEX and DROP CONSTRAINT are absent on purpose: rebuilt from the schema, so no data is
// at stake.

const RANK = { additive: 0, tightening: 1, destructive: 2, unreadable: 2, unreversible: 2 };

function classify(path) {
  let sql;
  try {
    sql = readFileSync(path, "utf8");
  } catch (error) {
    return ["unreadable", [String(error.message ?? error)]];
  }
  // A line comment can contain the word DROP without doing anything.
  const body = sql.replace(/--[^\n]*/g, " ");
  for (const [group, verdict] of [
    [DESTRUCTIVE, "destructive"],
    [TIGHTENING, "tightening"],
  ]) {
    const hits = group.filter(([rx]) => rx.test(body)).map(([, why]) => why);
    if (hits.length) return [verdict, hits];
  }
  return ["additive", []];
}

// A `.down.sql` is never classified: undoing what the up added is its whole job, so it reads
// destructive by construction and says nothing about the deploy.
const isDown = (name) => name.endsWith(".down.sql");

function walkSql(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkSql(path, out);
    else if (name.endsWith(".sql") && !isDown(name)) out.push(path);
  }
  return out;
}

// Only where the project evidently pairs them: a repo that keeps no down files at all has a
// convention, not 35 findings. Self-calibrating, so this stays a plugin script and not a policy.
function missingDowns(files) {
  const dirs = new Set(files.map((path) => dirname(path)));
  const paired = new Set();
  const uses = new Set();
  for (const dir of dirs) {
    // An unreadable directory is already reported as unreadable by classify; crashing here would
    // lose that finding and every other file's with it.
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!isDown(name)) continue;
      uses.add(dir);
      paired.add(join(dir, name.replace(/\.down\.sql$/u, ".sql")));
    }
  }
  return files.filter((path) => uses.has(dirname(path)) && !paired.has(path));
}

function since(ref, directory) {
  let known = new Set();
  try {
    const out = spawnSync("git", ["ls-tree", "-r", "--name-only", ref, "--", directory], {
      encoding: "utf8",
      timeout: 10_000,
    });
    if (!out.error && out.status === 0) known = new Set(out.stdout.split(/\s+/).filter(Boolean));
  } catch {
    /* no git answer: everything counts as new, which errs toward classifying more */
  }
  return walkSql(directory).filter((p) => !known.has(relative(".", p)));
}

const USAGE = `Classify migrations by whether deploying them can be undone.

  migration-risk.mjs <file.sql|DIR>...      classify each, walking a directory
  migration-risk.mjs --since <git-ref> DIR  classify only what that ref does not have

A \`.down.sql\` is skipped: undoing the up is its job, so it reads destructive by construction.
Where a directory holds down files at all, an up migration without one is reported — there is no
way back from that at all, whatever its SQL says.

Exit 0 additive only, 1 something tightening, 2 something destructive or unreversible.`;

function main(argv) {
  let ref = null;
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "-h" || argv[i] === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (argv[i] === "--since") ref = argv[++i];
    else paths.push(argv[i]);
  }
  if (paths.length === 0) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  const files = ref
    ? since(ref, paths[0])
    : paths.flatMap((path) => {
        try {
          return statSync(path).isDirectory() ? walkSql(path) : [path];
        } catch {
          return [path];
        }
      });
  if (files.length === 0) {
    process.stdout.write("no migrations to classify\n");
    return 0;
  }

  // One verdict per file: having no down migration outranks whatever the SQL does, because it is
  // the same finding at full strength — there is nothing to run either way.
  const orphans = new Set(missingDowns(files));
  let worst = 0;
  for (const path of files) {
    const [sqlVerdict, why] = classify(path);
    const verdict = orphans.has(path) ? "unreversible" : sqlVerdict;
    worst = Math.max(worst, RANK[verdict]);
    process.stdout.write(`${verdict.padEnd(12)} ${path}\n`);
    if (orphans.has(path)) process.stdout.write("             no paired .down.sql — nothing to run\n");
    for (const line of why) process.stdout.write(`             ${line}\n`);
  }

  if (worst === 2) {
    process.stdout.write(
      "\nA destructive migration is the one deploy this pipeline does not take on its own: " +
        "re-adding a column restores the schema and not the values, so no automatic rollback " +
        "exists. Say what is lost and ask.\n",
    );
  } else if (worst === 1) {
    process.stdout.write(
      "\nTightening can halt a deploy midway on existing rows. Run it against a copy of the " +
        "deployed data before shipping; if it passes there, ship without asking.\n",
    );
  }
  return worst;
}

process.exit(main(process.argv.slice(2)));
