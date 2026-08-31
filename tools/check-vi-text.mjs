#!/usr/bin/env node
// Every Vietnamese string this CLI can send must come from vi-text.mjs.
//
// The prose is the product, and typing it by hand is the failure a reviewer who does not read
// Vietnamese cannot see. So the invariant is structural rather than textual: no other source file
// may hold a Vietnamese string LITERAL at all. Comments are exempt — prose about the code is not
// something the gateway ever receives.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JS = join(ROOT, "plugin", "vi-natural");
const GENERATED = join(JS, "vi-text.mjs");
// Latin letters carrying diacritics — the Vietnamese alphabet. Deliberately not "non-ASCII": an em
// dash in an English format string is punctuation, and flagging it buries the real finding.
const VIETNAMESE = /[À-ɏḀ-ỿ]/;
const LITERAL = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".mjs")) out.push(path);
  }
  return out;
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, (line) => " ".repeat(line.length));
}

const offenders = [];
for (const file of walk(JS)) {
  if (file === GENERATED) continue;
  const source = stripComments(readFileSync(file, "utf8"));
  source.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(LITERAL)) {
      const value = match[1] ?? match[2] ?? match[3] ?? "";
      if (VIETNAMESE.test(value)) offenders.push([relative(ROOT, file), index + 1, value]);
    }
  });
}

for (const [file, line, value] of offenders) {
  process.stderr.write(`  ${file}:${line}  hand-typed Vietnamese: ${JSON.stringify(value.slice(0, 80))}\n`);
}
if (offenders.length) {
  process.stderr.write(
    `${offenders.length} Vietnamese literal(s) outside vi-text.mjs.\n` +
      "Move the text into the generated module; nothing else may hold product prose.\n",
  );
  process.exit(1);
}

if (process.argv.includes("--regenerate")) {
  // Ask for the extractor itself, not for the package it read: `vi_cli/` outlived its own deletion
  // as gitignored __pycache__, so a directory probe answered yes about source that was gone.
  const extractor = join(ROOT, "tools", "extract-vi-constants.py");
  if (!existsSync(extractor)) {
    process.stdout.write("no vietnamese outside vi-text.mjs; the python it was extracted from is gone\n");
    process.exit(0);
  }
  const before = readFileSync(GENERATED, "utf8");
  const run = spawnSync("python3", [extractor], { encoding: "utf8" });
  if (run.status !== 0) {
    process.stderr.write(`extractor failed: ${run.stderr}\n`);
    process.exit(2);
  }
  if (readFileSync(GENERATED, "utf8") !== before) {
    process.stderr.write("vi-text.mjs is not what the extractor produces — it was edited by hand\n");
    process.exit(1);
  }
  process.stdout.write("no vietnamese outside vi-text.mjs; the generated module matches the python\n");
  process.exit(0);
}

process.stdout.write("no Vietnamese literal outside the generated vi-text.mjs\n");
