#!/usr/bin/env node
// Classify a migration by whether deploying it can be undone.
//
// A pipeline that ships without asking needs one thing a human was previously supplying: the
// judgement that this particular change is recoverable. Most of that judgement has a shape. A
// deploy can be rolled back, a status reopened, a branch reverted — but a column that has been
// dropped is gone, and re-adding it restores the schema and not the values.
//
// So this splits migrations three ways rather than warning about all of them, because a checker
// that fires on every migration is one nobody reads:
//
//   destructive  data cannot be reconstructed from the schema after this runs
//   tightening   the statement can fail on existing rows, so the deploy can halt midway
//   additive     reversible by dropping what it added
//
// Statements inside a transaction that also rewrites the data are still destructive: this reads
// SQL text, not intent, and says so rather than guessing.

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DESTRUCTIVE = [
  [/\bDROP\s+COLUMN\b/i, 'drops a column — its values are not recoverable'],
  [/\bDROP\s+TABLE\b/i, 'drops a table — its rows are not recoverable'],
  [/\bTRUNCATE\b/i, 'truncates — every row goes'],
  [/\bDELETE\s+FROM\b/i, 'deletes rows'],
  [/\bDROP\s+TYPE\b/i, 'drops a type — columns using it go with it'],
  [
    /\bALTER\s+COLUMN\s+\S+\s+TYPE\b/i,
    "changes a column's type — a narrowing cast silently loses precision or truncates",
  ],
];
const TIGHTENING = [
  [/\bSET\s+NOT\s+NULL\b/i, 'fails if any existing row holds NULL'],
  [/\bADD\s+CONSTRAINT\b[\s\S]*\b(UNIQUE|CHECK|FOREIGN\s+KEY)\b/i, 'fails if existing rows violate it'],
  [/\bCREATE\s+UNIQUE\s+INDEX\b/i, 'fails if existing rows are not unique'],
];
// DROP INDEX and DROP CONSTRAINT are deliberately absent: both are rebuilt from the schema alone,
// so losing one costs a migration, never data.

const RANK = { additive: 0, tightening: 1, destructive: 2, unreadable: 2 };

function classify(path) {
  let sql;
  try {
    sql = readFileSync(path, 'utf8');
  } catch (error) {
    return ['unreadable', [String(error.message ?? error)]];
  }
  // A line comment can contain the word DROP without doing anything.
  const body = sql.replace(/--[^\n]*/g, ' ');
  for (const [group, verdict] of [
    [DESTRUCTIVE, 'destructive'],
    [TIGHTENING, 'tightening'],
  ]) {
    const hits = group.filter(([rx]) => rx.test(body)).map(([, why]) => why);
    if (hits.length) return [verdict, hits];
  }
  return ['additive', []];
}

function walkSql(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkSql(path, out);
    else if (name.endsWith('.sql')) out.push(path);
  }
  return out;
}

function since(ref, directory) {
  let known = new Set();
  try {
    const out = spawnSync('git', ['ls-tree', '-r', '--name-only', ref, '--', directory], {
      encoding: 'utf8',
      timeout: 10_000,
    });
    if (!out.error && out.status === 0) known = new Set(out.stdout.split(/\s+/).filter(Boolean));
  } catch {
    /* no git answer: treat everything as new, which errs toward classifying more */
  }
  return walkSql(directory).filter((p) => !known.has(relative('.', p)));
}

const USAGE = `Classify migrations by whether deploying them can be undone.

  migration-risk.mjs <file.sql>...          classify each
  migration-risk.mjs --since <git-ref> DIR  classify only what that ref does not have

Exit 0 additive only, 1 something tightening, 2 something destructive.`;

function main(argv) {
  let ref = null;
  const paths = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '-h' || argv[i] === '--help') {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (argv[i] === '--since') ref = argv[++i];
    else paths.push(argv[i]);
  }
  if (paths.length === 0) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  const files = ref ? since(ref, paths[0]) : paths;
  if (files.length === 0) {
    process.stdout.write('no migrations to classify\n');
    return 0;
  }

  let worst = 0;
  for (const path of files) {
    const [verdict, why] = classify(path);
    worst = Math.max(worst, RANK[verdict]);
    process.stdout.write(`${verdict.padEnd(12)} ${path}\n`);
    for (const line of why) process.stdout.write(`             ${line}\n`);
  }

  if (worst === 2) {
    process.stdout.write(
      '\nA destructive migration is the one deploy this pipeline does not take on its own: ' +
        're-adding a column restores the schema and not the values, so no automatic rollback ' +
        'exists. Say what is lost and ask.\n',
    );
  } else if (worst === 1) {
    process.stdout.write(
      '\nTightening can halt a deploy midway on existing rows. Run it against a copy of the ' +
        'deployed data before shipping; if it passes there, ship without asking.\n',
    );
  }
  return worst;
}

process.exit(main(process.argv.slice(2)));
