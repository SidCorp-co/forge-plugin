#!/usr/bin/env node
// Find text stated twice — a skill's markdown, or the comments of a source tree.
//
// Why that costs anything, and how it is measured: hooks/vendor/text-overlap.js. The
// duplicate-comment ESLint rule applies the same measurement to one file at a time, so what this
// adds is every pair that spans two files, which is where a copy actually goes to drift.
//
// What belongs here is only the difference between the two kinds of input: markdown's fences,
// tables and headings, and a source file's comment markers and waivers.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { isIgnoredComment, isWaiver, RESTATEMENT_WAIVER } from "../hooks/vendor/line-metrics.js";
import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  DEFAULT_OVERLAP_FLOOR,
  DEFAULT_OVERLAP_THRESHOLD,
  findOverlapsAgainst,
  splitSentences,
} from "../hooks/vendor/text-overlap.js";

const FENCE = /```[\s\S]*?```/g;
const TABLE_ROW = /^[ \t]*\|.*\|[ \t]*$/gm;
const HEADING = /^#{1,6}\s.*$/gm;
const MARKUP = /[*`_>[\]()]/g;

export function sentences(text) {
  const stripped = text
    .replace(FENCE, " ")
    .replace(TABLE_ROW, " ")
    .replace(HEADING, " ")
    .replace(MARKUP, "");
  return splitSentences(stripped, DEFAULT_MIN_SENTENCE_LENGTH);
}

const COMMENT = /^[ \t]*\/\/([^\n]*)|\/\*([\s\S]*?)\*\//gm;
const STAR = /^\s*\*\s?/gm;
const newlines = (text, from, to) => (text.slice(from, to).match(/\n/g) ?? []).length;

/** ESLint hands its rule a parsed file; these comments are found by pattern, so a `//` opening a
 *  line inside a template literal reads as one. The grouping and the waiver reach are the rule's,
 *  because a sentence spanning two `//` lines is one sentence to whoever reads it. */
function blocks(text) {
  const out = [];
  let open = null;
  let waivedLine = 0;
  let line = 1;
  let at = 0;
  for (const m of text.matchAll(COMMENT)) {
    line += newlines(text, at, m.index);
    at = m.index;
    const isLine = m[1] !== undefined;
    const value = (isLine ? m[1] : m[2]).replace(STAR, "");
    const end = line + newlines(text, m.index, m.index + m[0].length);
    if (isIgnoredComment({ value }) || isWaiver({ value })) {
      if (RESTATEMENT_WAIVER.test(value)) waivedLine = end + 1;
      open = null;
    } else if (open && isLine && open.isLine && line === open.end + 1) {
      open.value += ` ${value}`;
      open.end = end;
    } else {
      open = { isLine, value, end, waived: line === waivedLine };
      out.push(open);
    }
  }
  return out.filter((block) => !block.waived);
}

export function commentSentences(text) {
  return blocks(text).flatMap((block) =>
    splitSentences(block.value.replace(/\s+/g, " ").trim(), DEFAULT_MIN_SENTENCE_LENGTH),
  );
}

/** Units are [label, sentence]. Returns [score, a, b], worst first. */
export function compare(aUnits, bUnits, threshold, floor) {
  return findOverlapsAgainst(aUnits, bUnits, { threshold, floor });
}

const SKIP = new Set(["node_modules", ".git"]);
const CODE = /\.(?:mjs|cjs|js|jsx|ts|tsx)$/;

export const KINDS = ["both", "comments", "prose"];

function walk(dir, kind, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, kind, out);
    else if (name.endsWith(".md") ? kind !== "comments" : CODE.test(name) && kind !== "prose")
      out.push(path);
  }
  return out;
}

export function load(root, exclude = new Set(), kind = "both") {
  const units = [];
  const skipped = [...exclude];
  for (const path of walk(root, kind)) {
    const rel = relative(root, path);
    if (skipped.some((entry) => rel === entry || rel.startsWith(`${entry}/`))) continue;
    const text = readFileSync(path, "utf8");
    const found = rel.endsWith(".md") ? sentences(text) : commentSentences(text);
    for (const sentence of found) units.push([rel, sentence]);
  }
  return units;
}

function report(hits, limit) {
  const seen = new Set();
  let shown = 0;
  for (const [score, [la, sa], [lb, sb]] of hits) {
    const key = [`${la}\0${sa}`, `${lb}\0${sb}`].sort().join("\x01");
    if (seen.has(key)) continue;
    seen.add(key);
    if ((shown += 1) > limit) continue;
    process.stdout.write(`${score.toFixed(2)}  ${la}\n        ${sa.slice(0, 150)}\n`);
    process.stdout.write(`      ${lb}\n        ${sb.slice(0, 150)}\n\n`);
  }
  return seen.size;
}

const USAGE = `Find text stated twice: a skill's prose, or a source tree's comments.

  skill-dup.mjs <dir>              audit a directory — markdown prose and code comments
  skill-dup.mjs <dir> --against -  read proposed text on stdin, compare it to the directory
  skill-dup.mjs . --exclude plugin/hooks/vendor --threshold 0.4

  --against FILE   compare this text (or - for stdin) against the directory instead of comparing
                   the directory with itself
  --exclude REL    skip this file or directory, relative to <dir>; repeatable
  --only KIND      comments, prose, or both (default: both). A changelog restates its README by
                   design, so a source tree is usually audited for comments alone
  --threshold N    Jaccard index at which two sentences count as duplicates (default: 0.34)
  --floor N        content words two sentences must share before the index is computed (default: 5)
  --limit N        pairs to print (default: 10)

A comment reading \`restated: deliberate — <reason>\` waives the block beneath it, the same
marker the ESLint rule reads.

Exit 0 when clean, 1 when a duplicate is found, 2 on a usage error.`;

function main(argv) {
  const opts = {
    exclude: new Set(),
    threshold: DEFAULT_OVERLAP_THRESHOLD,
    floor: DEFAULT_OVERLAP_FLOOR,
    limit: 10,
    against: null,
    only: "both",
  };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else if (arg === "--against") opts.against = argv[++i];
    else if (arg === "--exclude") opts.exclude.add(argv[++i]);
    else if (arg === "--threshold") opts.threshold = Number(argv[++i]);
    else if (arg === "--floor") opts.floor = Number(argv[++i]);
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--only") opts.only = argv[++i];
    else if (arg.startsWith("-")) {
      process.stderr.write(`unknown option: ${arg}\n${USAGE}\n`);
      return 2;
    } else positional.push(arg);
  }
  const root = positional[0];
  if (!root) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  if (!KINDS.includes(opts.only)) {
    process.stderr.write(`--only takes ${KINDS.join(", ")}\n`);
    return 2;
  }
  try {
    if (!statSync(root).isDirectory()) throw new Error();
  } catch {
    process.stderr.write(`not a directory: ${root}\n`);
    return 2;
  }

  let hits;
  let label;
  if (opts.against) {
    const text = readFileSync(opts.against === "-" ? 0 : opts.against, "utf8");
    const incoming = sentences(text).map((s) => ["<proposed>", s]);
    if (incoming.length === 0) return 0;
    hits = compare(incoming, load(root, opts.exclude, opts.only), opts.threshold, opts.floor);
    label = "the proposed text repeats what is already written";
  } else {
    const units = load(root, opts.exclude, opts.only);
    hits = compare(units, units, opts.threshold, opts.floor);
    label = "the same thing is stated in two places";
  }

  if (hits.length === 0) {
    process.stdout.write("clean — no duplicated statement found\n");
    return 0;
  }
  const n = report(hits, opts.limit);
  process.stdout.write(`${n} duplicate pair(s): ${label}.\n`);
  process.stdout.write(
    "Keep it in one place and cite it from the other; two authorities for one rule diverge the " +
      "first time someone corrects only the copy they found.\n",
  );
  return 1;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
