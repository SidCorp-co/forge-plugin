/* Text stated twice across files, which the duplicate-comment ESLint rule cannot see one file at a
   time. What belongs here is the difference between the two inputs: markdown's fences, tables and
   headings, and a source file's comment markers. hooks/vendor/text-overlap.js measures. */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { isIgnoredComment, isWaiver, RESTATEMENT_WAIVER } from "../../hooks/vendor/line-metrics.js";
import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  findOverlapsAgainst,
  splitSentences,
} from "../../hooks/vendor/text-overlap.js";
import { TABLE_ROW_PATTERN, withoutSpans } from "../markdown.mjs";

const FENCE = /```[\s\S]*?```/g;
const TABLE_ROW = new RegExp(TABLE_ROW_PATTERN, "gmu");
const HEADING = /^#{1,6}\s.*$/gm;
const MARKUP = /[*`_>[\]()]/g;

/** The sentences of a document's own prose, which is the unit a restatement is measured in. */
export function sentences(text) {
  const stripped = withoutSpans(text.replace(FENCE, " "))
    .replace(TABLE_ROW, " ")
    .replace(HEADING, " ")
    .replace(MARKUP, "");
  return splitSentences(stripped, DEFAULT_MIN_SENTENCE_LENGTH);
}

// A glob is not a comment: `"dist/**"` opens one to a scanner and swallows the code after it,
// so an opener preceded by a word character, a quote or a slash is one of those.
const COMMENT = /^[ \t]*\/\/([^\n]*)|(?<![\w"'`/])\/\*([\s\S]*?)\*\//gm;
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

const wanted = (name, kind) =>
  name.endsWith(".md") ? kind !== "comments" : CODE.test(name) && kind !== "prose";

function walk(dir, kind, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, kind, out);
    else if (wanted(name, kind)) out.push(path);
  }
  return out;
}

/** A build directory holds a compiled copy of the source, so scanning one reports every comment in
 *  the project twice. Which files a project keeps is git's answer rather than a list of directory
 *  names guessed at here; a tree that is not a repository falls back to walking it. */
function tracked(root, kind) {
  const args = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"];
  const git = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (git.status !== 0) return null;
  return git.stdout
    .split("\0")
    .filter((rel) => rel && wanted(rel, kind))
    .map((rel) => join(root, rel))
    .filter((path) => existsSync(path));
}

export function load(root, exclude = new Set(), kind = "both") {
  const units = [];
  const skipped = [...exclude];
  for (const path of tracked(root, kind) ?? walk(root, kind)) {
    const rel = relative(root, path);
    if (skipped.some((entry) => rel === entry || rel.startsWith(`${entry}/`))) continue;
    const text = readFileSync(path, "utf8");
    const found = rel.endsWith(".md") ? sentences(text) : commentSentences(text);
    for (const sentence of found) units.push([rel, sentence]);
  }
  return units;
}
