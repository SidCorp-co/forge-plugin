#!/usr/bin/env node
// A skill that names a repository's path has stopped being method.

const HELP = `Find repository paths named in a skill's own text.

  skill-paths.mjs                 check every skill under plugin/skills
  skill-paths.mjs <skill-dir>     check one

A skill is method, not project facts: issue-flow says so in its own second paragraph. A path it
names is a claim about somebody's checkout, and the claim goes stale in silence — issue-flow cited
\`scripts/migration-risk.mjs\` for months against a repo that had no such file.

Three kinds of path are not that claim and are not reported:

  the skill's own          references/verification.md — resolves inside the skill directory
  the plugin's own         hooks/learning-gate.mjs — resolves inside plugin/
  a bare filename          CLAUDE.md, eslint.config.mjs — a name any project has, not one path

Exit 0 when clean, 1 when a path is found, 2 on a usage error.`;

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { claims } from "../src/claude-md.mjs";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = join(plugin, "skills");

const unknown = args.filter((arg) => arg.startsWith("-"));
if (unknown.length) {
  process.stderr.write(`No such option: ${unknown.join(" ")}\n\n${HELP}\n`);
  process.exit(2);
}

const markdown = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) markdown(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
};

// A bare filename is a name, not a path; a model id and a well-known directory are neither. Only a
// path carrying a directory AND a source or config extension is a claim about a checkout.
const NAMES_A_FILE = /\/.*\.(?:mjs|cjs|[jt]sx?|json|md|sql|ya?ml|sh|py|toml)$/u;

const skillDirs = args.length
  ? args.map((arg) => resolve(arg))
  : readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(skillsRoot, entry.name));

const found = [];
for (const dir of skillDirs) {
  for (const file of markdown(dir)) {
    for (const path of claims(readFileSync(file, "utf8")).paths) {
      if (!NAMES_A_FILE.test(path)) continue;
      if (existsSync(join(dir, path)) || existsSync(join(plugin, path))) continue;
      found.push([relative(plugin, file), path]);
    }
  }
}

for (const [file, path] of found) console.log(`  ${file}\n      ${path}`);
if (found.length === 0) {
  console.log(`  clean — ${skillDirs.length} skill(s) name no repository path`);
  process.exit(0);
}
console.log(
  `\n  ${found.length} repository path(s) in skill text. A skill carries method; a path is a fact\n` +
    "  about one checkout, and it is wrong silently. State what the project must supply, and let\n" +
    "  the project name it.",
);
process.exit(1);
