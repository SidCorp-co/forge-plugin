/* The CLAUDE.md half of `forge doctor`: the guides are the authority and a project file that
   restates one has forked it. Why a pair is reported and never classified: docs/FORGE-CLI.md. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  findOverlapsAgainst,
  splitSentences,
} from "../hooks/vendor/text-overlap.js";

/* Not the shared 0.34/5: that was calibrated on comments inside one file, where two copies share
   twice the vocabulary two documents do. Measured over 28 CLAUDE.md files — docs/FORGE-CLI.md. */
export const GUIDE_OVERLAP_THRESHOLD = 0.25;
export const GUIDE_OVERLAP_FLOOR = 3;

const FENCE = /^\s*(?:```|~~~)/u;
const HEADING = /^#{1,6}\s/u;
const TABLE_ROW = /^\s*\|.*\|\s*$/u;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const MARKUP = /[*`_>[\]()]/gu;

/* The waiver grammar the ESLint rules use: a marker, an em dash, a reason that is not optional. */
const OVERRIDE = /overrides:\s*([a-z0-9][a-z0-9-]*)\s*(?:—|--)\s*(\S.*?)\s*$/u;

/* A fenced block is a code example, and an example of the marker is not a declaration of it. */
function* unfenced(text) {
  let fenced = false;
  for (const [index, line] of text.split("\n").entries()) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      yield [index, null];
    } else if (!fenced) yield [index, line];
  }
}

/* Sentences with the span of source they came from, blocks broken at a blank line, heading, table
   row or new bullet — so a finding points at one rule and not at the paragraph above it. */
export function statements(text, minLength = DEFAULT_MIN_SENTENCE_LENGTH) {
  const units = [];
  let block = [];
  let start = 0;
  const flush = (end) => {
    const prose = block.join(" ").replace(MARKUP, "");
    for (const sentence of splitSentences(prose, minLength)) units.push([{ start, end }, sentence]);
    block = [];
  };
  for (const [index, line] of unfenced(text)) {
    if (line === null) {
      flush(index);
      continue;
    }
    if (!line.trim() || HEADING.test(line) || TABLE_ROW.test(line) || BULLET.test(line)) {
      flush(index);
    }
    if (!line.trim() || HEADING.test(line) || TABLE_ROW.test(line)) continue;
    if (!block.length) start = index + 1;
    block.push(line.replace(BULLET, "").trim());
  }
  flush(text.split("\n").length);
  return units;
}

/** Every `overrides:` marker, with the line it sits on so a block can claim the ones inside it. */
export function overrideMarkers(text) {
  const found = [];
  for (const [index, line] of unfenced(text)) {
    const hit = line === null ? null : OVERRIDE.exec(line);
    if (hit) found.push({ line: index + 1, slug: hit[1], reason: hit[2] });
  }
  return found;
}

/* A tool namespace is the one mechanical evidence of scope in a guide body: forge's own tools are
   global by definition, and a foreign one names the integration the guide is really about. */
const FOREIGN_TOOL = /mcp__(?!forge__)([a-z0-9_]+?)__/gu;

/** Guides declared globally whose body only makes sense for one project. */
export function misScoped(guides) {
  const found = [];
  for (const guide of guides) {
    const vendors = new Set([...String(guide.body ?? "").matchAll(FOREIGN_TOOL)].map((m) => m[1]));
    if (vendors.size) found.push({ slug: guide.slug, evidence: [...vendors].sort() });
  }
  return found;
}

const guideUnits = (guides) =>
  guides.flatMap((guide) =>
    statements(String(guide.body ?? "")).map(([, sentence]) => [guide.slug, sentence]),
  );

/** Pure over its inputs: `guides` is data, so nothing here reaches the network. */
export function reviewClaudeMd(text, guides, options = {}) {
  const { threshold = GUIDE_OVERLAP_THRESHOLD, floor = GUIDE_OVERLAP_FLOOR } = options;
  const known = new Set(guides.map((guide) => guide.slug));
  const markers = overrideMarkers(text);
  const claimed = (span, slug) =>
    markers.some((m) => m.slug === slug && m.line >= span.start && m.line <= span.end);

  const overlaps = [];
  const seen = new Set();
  for (const [score, [span, ours], [slug, theirs]] of findOverlapsAgainst(
    statements(text),
    guideUnits(guides),
    { threshold, floor },
  )) {
    const key = `${slug}\0${theirs}\0${span.start}\0${ours}`;
    if (seen.has(key) || claimed(span, slug)) continue;
    seen.add(key);
    overlaps.push({ score, slug, theirs, line: span.start, ours });
  }
  return {
    overlaps,
    overrides: markers.map((m) => ({ ...m, known: known.has(m.slug) })),
    misScoped: misScoped(guides),
  };
}

/** The project root's own CLAUDE.md, or null. Nested ones are another scope and are not read. */
export function readClaudeMd(root) {
  if (!root) return null;
  const path = join(root, "CLAUDE.md");
  if (!existsSync(path)) return null;
  try {
    return { path, text: readFileSync(path, "utf8") };
  } catch {
    return null;
  }
}
