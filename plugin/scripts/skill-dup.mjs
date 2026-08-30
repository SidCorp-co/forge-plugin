#!/usr/bin/env node
// Find text a skill says twice.
//
// A skill that states a rule in its spine and again in a reference has two authorities for one
// rule, and the pair diverges the first time someone corrects only the copy they found. That
// divergence is silent: both files read as correct on their own. This measures the overlap
// instead of trusting a reading.
//
// The measurement itself is hooks/vendor/text-overlap.js, shared with the duplicate-comment
// ESLint rule; what belongs here is only what makes a markdown skill different from a source
// file — the fences, tables and headings that are not prose.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  DEFAULT_OVERLAP_FLOOR,
  DEFAULT_OVERLAP_THRESHOLD,
  findOverlapsAgainst,
  splitSentences,
} from '../hooks/vendor/text-overlap.js';

const FENCE = /```[\s\S]*?```/g;
const TABLE_ROW = /^[ \t]*\|.*\|[ \t]*$/gm;
const HEADING = /^#{1,6}\s.*$/gm;
const MARKUP = /[*`_>[\]()]/g;

export function sentences(text) {
  const stripped = text
    .replace(FENCE, ' ')
    .replace(TABLE_ROW, ' ')
    .replace(HEADING, ' ')
    .replace(MARKUP, '');
  return splitSentences(stripped, DEFAULT_MIN_SENTENCE_LENGTH);
}

/** Units are [label, sentence]. Returns [score, a, b], worst first. */
export function compare(aUnits, bUnits, threshold, floor) {
  return findOverlapsAgainst(aUnits, bUnits, { threshold, floor });
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.md')) out.push(path);
  }
  return out;
}

export function load(skillDir, exclude = new Set()) {
  const units = [];
  for (const path of walk(skillDir)) {
    const rel = relative(skillDir, path);
    if (exclude.has(rel)) continue;
    for (const s of sentences(readFileSync(path, 'utf8'))) units.push([rel, s]);
  }
  return units;
}

function report(hits, limit) {
  const seen = new Set();
  let shown = 0;
  for (const [score, [la, sa], [lb, sb]] of hits) {
    const key = [`${la}\0${sa}`, `${lb}\0${sb}`].sort().join('\x01');
    if (seen.has(key)) continue;
    seen.add(key);
    if ((shown += 1) > limit) continue;
    process.stdout.write(`${score.toFixed(2)}  ${la}\n        ${sa.slice(0, 150)}\n`);
    process.stdout.write(`      ${lb}\n        ${sb.slice(0, 150)}\n\n`);
  }
  return seen.size;
}

const USAGE = `Find text a skill says twice.

  skill-dup.mjs <skill-dir>              audit a whole skill
  skill-dup.mjs <skill-dir> --against -  read proposed text on stdin, compare it to the skill
  skill-dup.mjs <skill-dir> --exclude references/learning.md --threshold 0.4

  --against FILE   compare this text (or - for stdin) against the skill instead of comparing
                   the skill with itself
  --exclude REL    skip this path, relative to the skill dir; repeatable
  --threshold N    Jaccard index at which two sentences count as duplicates (default: 0.34)
  --floor N        content words two sentences must share before the index is computed (default: 5)
  --limit N        pairs to print (default: 10)

Exit 0 when clean, 1 when a duplicate is found, 2 on a usage error.`;

function main(argv) {
  const opts = {
    exclude: new Set(),
    threshold: DEFAULT_OVERLAP_THRESHOLD,
    floor: DEFAULT_OVERLAP_FLOOR,
    limit: 10,
    against: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (arg === '--against') opts.against = argv[++i];
    else if (arg === '--exclude') opts.exclude.add(argv[++i]);
    else if (arg === '--threshold') opts.threshold = Number(argv[++i]);
    else if (arg === '--floor') opts.floor = Number(argv[++i]);
    else if (arg === '--limit') opts.limit = Number(argv[++i]);
    else if (arg.startsWith('-')) {
      process.stderr.write(`unknown option: ${arg}\n${USAGE}\n`);
      return 2;
    } else positional.push(arg);
  }
  const skillDir = positional[0];
  if (!skillDir) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    if (!statSync(skillDir).isDirectory()) throw new Error();
  } catch {
    process.stderr.write(`not a directory: ${skillDir}\n`);
    return 2;
  }

  let hits;
  let label;
  if (opts.against) {
    const text = readFileSync(opts.against === '-' ? 0 : opts.against, 'utf8');
    const incoming = sentences(text).map((s) => ['<proposed>', s]);
    if (incoming.length === 0) return 0;
    hits = compare(incoming, load(skillDir, opts.exclude), opts.threshold, opts.floor);
    label = 'the proposed text repeats what the skill already says';
  } else {
    const units = load(skillDir, opts.exclude);
    hits = compare(units, units, opts.threshold, opts.floor);
    label = 'the skill says the same thing twice';
  }

  if (hits.length === 0) {
    process.stdout.write('clean — no duplicated statement found\n');
    return 0;
  }
  const n = report(hits, opts.limit);
  process.stdout.write(`${n} duplicate pair(s): ${label}.\n`);
  process.stdout.write(
    'Keep it in one place and cite it from the other; two authorities for one rule diverge the ' +
      'first time someone corrects only the copy they found.\n',
  );
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
