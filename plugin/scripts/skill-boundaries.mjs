#!/usr/bin/env node
// Two skills a model cannot choose between are one skill with two names.

const HELP = `Find skill descriptions that overlap, and references to skills that do not exist.

  skill-boundaries.mjs            check every skill under plugin/skills
  skill-boundaries.mjs <dir>      check the skills under another directory
  skill-boundaries.mjs --json     the measurements, for a report

Only \`description\` decides whether a skill is offered, so two descriptions covering the same
vocabulary make the choice between them a coin toss — and nothing in a review catches it, because
each description reads well on its own. This measures the overlap and asks for a boundary.

A pair above the threshold passes when one of them names the other AND says which to prefer:
issue-flow already carries "For reading, listing or filing issues without implementing them, use
the forge skill instead." A bare mention does not earn it — "works with the alpha skill" tells a
reader nothing about which to reach for.

Also reported: a skill named in another skill's prose that is not installed here. That reference is
an instruction to invoke something that will never load.

Exit 0 when clean, 1 on a finding, 2 on a usage error.`;

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}
const unknown = args.filter((arg) => arg.startsWith("-") && arg !== "--json");
if (unknown.length) {
  process.stderr.write(`No such option: ${unknown.join(" ")}\n\n${HELP}\n`);
  process.exit(2);
}

const named = args.filter((arg) => !arg.startsWith("-"));
const skillsRoot = named.length
  ? resolve(named[0])
  : join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "skills");

/* Overlap is measured on what a description is *about*, so the words every description shares are
   removed first — they inflate every pair equally and rank nothing. */
const EVERYWHERE = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "into",
  "invoke", "is", "it", "its", "of", "on", "or", "so", "than", "that", "the", "them", "then", "this",
  "to", "triggers", "use", "used", "user", "uses", "when", "which", "with", "without", "you", "your",
]);
/* Calibrated rather than inherited: two descriptions of the same job with a few words swapped
   measure 60%, two unrelated skills under 3%, and this repo's closest real pair — forge and
   issue-flow, genuinely adjacent — 18%. 35% sits between the last two, and the numbers are in
   `skill-boundaries.test.mjs` so a change to the tokeniser has to face them. */
const OVERLAP_LIMIT = 0.35;
const MIN_CHARS = 60;

/* A description that does not say when to reach for the skill is a description the model has to
   guess from. The cue is a small vocabulary rather than one required phrase: the point is that
   *some* invocation condition is stated, not that it is worded our way. */
const SAYS_WHEN = /\b(use|invoke|reach for|run|call)\b[^.]{0,80}\b(when|whenever|for|if|before|after)\b|\btriggers on\b/i;

const frontmatter = (text) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const found = {};
  let key = null;
  for (const raw of match[1].split("\n")) {
    const pair = /^([a-zA-Z_-]+):\s*(.*)$/.exec(raw);
    if (pair) {
      key = pair[1];
      found[key] = pair[2].replace(/^>-?\s*$/, "").trim();
    } else if (key && raw.trim()) {
      found[key] = `${found[key]} ${raw.trim()}`.trim();
    }
  }
  return found;
};

/* Stemmed so issue/issues and list/listing count once. This sees shared VOCABULARY, not shared
   meaning — one job written in a different vocabulary escapes it, and the test asserts that miss
   rather than prose admitting it. A floor under the obvious duplicate, not a judge. */
const stem = (word) => word.replace(/(?:ies|ing|ions?|ed|es|s)$/u, "");

const meaningful = (description) =>
  new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter((word) => word.length > 2 && !EVERYWHERE.has(word))
      .map(stem)
      .filter((word) => word.length > 2),
  );

const overlap = (left, right) => {
  const shared = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : shared / union;
};

/* Naming the other skill is not stating a boundary; a direction is. The cue list is a vocabulary
   for "prefer that one over this one" — short on purpose, because a checker that accepts any
   mention lets the overlap through, and one that demands a fixed sentence gets worked around. */
const DIRECTS = /\b(instead|rather than|not for|prefer|only when|unless|if you are|before using)\b/i;

const prefers = (from, to) => {
  const at = from.description.search(new RegExp(`\\b${to.name}\\b`));
  if (at === -1) return false;
  /* The direction has to travel with the name, so the sentence holding it is what is read. */
  const around = from.description.slice(Math.max(0, at - 160), at + 160);
  return DIRECTS.test(around);
};

const skills = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const text = readFileSync(join(skillsRoot, entry.name, "SKILL.md"), "utf8");
    const held = frontmatter(text);
    /* Read with the frontmatter: whatever a guide directory of the same name holds, when one exists. */
    const served = join(skillsRoot, "..", "guides", "skills", entry.name, "guide.md");
    const body = existsSync(served) ? `${text}\n${readFileSync(served, "utf8")}` : text;
    return { name: entry.name, description: held.description ?? "", body, words: meaningful(held.description ?? "") };
  });

const names = new Set(skills.map((skill) => skill.name));
const findings = [];
const pairs = [];

for (const skill of skills) {
  if (skill.description.length < MIN_CHARS) {
    findings.push([skill.name, `description is ${skill.description.length} chars; under ${MIN_CHARS} it cannot carry a trigger`]);
  } else if (!SAYS_WHEN.test(skill.description)) {
    findings.push([skill.name, "description never says when to reach for it"]);
  }
  /* A skill naming another one is how a boundary gets stated, so the reference has to resolve. */
  for (const match of skill.body.matchAll(/\bthe `?([a-z][a-z0-9-]{2,})`? skill\b/g)) {
    if (!names.has(match[1])) findings.push([skill.name, `names the \`${match[1]}\` skill, which is not installed here`]);
  }
}

for (let left = 0; left < skills.length; left += 1) {
  for (let right = left + 1; right < skills.length; right += 1) {
    const [one, two] = [skills[left], skills[right]];
    const score = overlap(one.words, two.words);
    pairs.push({ one: one.name, two: two.name, overlap: Number(score.toFixed(3)) });
    if (score < OVERLAP_LIMIT) continue;
    if (!prefers(one, two) && !prefers(two, one)) {
      findings.push([
        `${one.name} + ${two.name}`,
        `descriptions overlap ${(score * 100).toFixed(0)}% and neither says which to prefer — name the other and direct the reader`,
      ]);
    }
  }
}

if (args.includes("--json")) {
  console.log(JSON.stringify({ pairs: pairs.sort((a, b) => b.overlap - a.overlap), findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}

for (const [where, what] of findings) console.log(`  ${where}\n      ${what}`);
if (!findings.length) {
  const worst = pairs.sort((a, b) => b.overlap - a.overlap)[0];
  const closest = worst ? `; closest pair ${worst.one}/${worst.two} at ${(worst.overlap * 100).toFixed(0)}%` : "";
  console.log(`  clean — ${skills.length} skill(s), each with a stated trigger${closest}`);
  process.exit(0);
}
console.log(
  `\n  ${findings.length} boundary finding(s). Only \`description\` decides which skill loads, so an\n` +
    "  overlap nobody stated is a choice nobody makes deliberately.",
);
process.exit(1);
