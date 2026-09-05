#!/usr/bin/env node
// A measurement in a skill is a justification; the rule it argued for fits one line.

const HELP = `Find skill lines carrying a figure of three digits or more outside a code span.

  skill-figures.mjs               check plugin/skills and plugin/guides/skills
  skill-figures.mjs <dir>...      check other directories
  skill-figures.mjs --json        the findings, for a report

A figure inside a code span or a fenced block is a limit a reader copies, and passes. An issue key
(ISS-290) and a dotted version (3.35.128) pass. Everything else of three digits or more is a
measurement, and a measurement belongs on the issue that took it or on the docs page that owns
the decision, with the skill keeping the rule.

Exit 0 when clean, 1 on a finding, 2 on a usage error.`;

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
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

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const named = args.filter((arg) => !arg.startsWith("-")).map((one) => resolve(one));
const roots = named.length ? named : [join(plugin, "skills"), join(plugin, "guides", "skills")];

const walk = (dir) => {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(walk(path));
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
};

const EXEMPT = [/`[^`]*`/gu, /\bISS-\d+\b/gu, /\bv?\d+\.\d+\.\d+\b/gu];
/* No boundary after the digits: a unit glued on (1000ms, 2048MB) is still a measurement. */
const FIGURE = /\b\d{1,3}(?:,\d{3})+|\b\d{3,}/u;

/** Each line of one text carrying a figure the rule counts, with the line number. */
export const figuresIn = (text) => {
  const out = [];
  let fenced = false;
  text.split("\n").forEach((line, at) => {
    if (/^\s*(```|~~~)/u.test(line)) fenced = !fenced;
    if (fenced) return;
    const bare = EXEMPT.reduce((rest, pattern) => rest.replace(pattern, " "), line);
    const found = FIGURE.exec(bare);
    if (found) out.push({ line: at + 1, figure: found[0], text: line.trim() });
  });
  return out;
};

const findings = [];
for (const root of roots) {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of walk(root)) {
    for (const hit of figuresIn(readFileSync(file, "utf8"))) {
      findings.push({ file: relative(process.cwd(), file), ...hit });
    }
  }
}

if (args.includes("--json")) {
  console.log(JSON.stringify({ findings }, null, 2));
  process.exit(findings.length ? 1 : 0);
}
for (const one of findings) console.log(`  ${one.file}:${one.line}  ${one.figure}\n      ${one.text}`);
if (!findings.length) {
  console.log("  clean — no skill line carries a measurement");
  process.exit(0);
}
console.log(`\n  ${findings.length} figure(s). A measurement goes to the issue that took it; the skill keeps the rule.`);
process.exit(1);
