#!/usr/bin/env node
// A skill that names a repository's path has stopped being method.

const HELP = `Find repository paths named in a skill's own text.

  skill-paths.mjs                 check every skill under plugin/skills
  skill-paths.mjs <skill-dir>     check one

A skill is method, not project facts: issue-flow says so in its own second paragraph. A path it
names is a claim about somebody's checkout, and the claim goes stale in silence — issue-flow cited
\`scripts/migration-risk.mjs\` for months, and the run that finally typed it resolved it against the
skill's own directory and found nothing there. That citation is what this check now catches.

A skill is loaded with its own directory as the root, so that is the one root a path may resolve
against. Two kinds are not a claim about a checkout and are not reported:

  the skill's own          references/verification.md — resolves inside the skill directory
  a bare filename          CLAUDE.md, eslint.config.mjs — a name any project has, not one path

A path resolving inside this plugin but not inside the skill is reported like any other: the skill
is read from wherever it is installed, so this plugin's own files are no more addressable from its
text than the project's are.

Exit 0 when clean, 1 when a path is found, 2 on a usage error.`;

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { claims } from "../src/checks/claude-md.mjs";

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* A skill is two directories now: the stub Claude Code loads, and the body `forge guide` serves. */
const skillRoots = [join(plugin, "skills"), join(plugin, "guides", "skills")];

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
  : skillRoots.flatMap((root) => readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name)));

/* Containment of the real file, not existence at the written path: `..` normalises away and a
   symlink resolves elsewhere, so either can name a file that exists while the copy of the skill a
   reader installs holds nothing there. `realpathSync` throws on an absent path, which is the same
   answer. */
const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

const holds = (root, target) => {
  const [base, file] = [real(root), real(target)];
  return base !== null && file !== null && (file === base || file.startsWith(`${base}${sep}`));
};

const found = [];
for (const dir of skillDirs) {
  for (const file of markdown(dir)) {
    for (const path of claims(readFileSync(file, "utf8")).paths) {
      if (!NAMES_A_FILE.test(path)) continue;
      if (holds(dir, resolve(dir, path))) continue;
      const inPlugin = holds(plugin, resolve(dir, path)) || holds(plugin, resolve(plugin, path));
      const shown = relative(plugin, file);
      found.push([shown.startsWith("..") ? file : shown, path, inPlugin]);
    }
  }
}

const ours = found.filter(([, , inPlugin]) => inPlugin);
for (const [file, path, inPlugin] of found) {
  console.log(`  ${file}\n      ${path}${inPlugin ? "   — this plugin's own, and unaddressable from a skill" : ""}`);
}
if (found.length === 0) {
  console.log(`  clean — ${skillDirs.length} skill(s) name no path they cannot open`);
  process.exit(0);
}
// The two kinds need different remedies: a project's file is the project's to name, and this
// plugin's own has no name a skill can write at all.
console.log(`\n  ${found.length} path(s) in skill text that no reader of that skill can open.`);
if (found.length > ours.length) {
  console.log(
    "\n  A skill carries method; a path is a fact about one checkout, and it is wrong silently.\n" +
      "  State what the project must supply, and let the project name it.",
  );
}
if (ours.length > 0) {
  console.log(
    `\n  ${ours.length} path(s) inside this plugin, which a skill cannot reach: it is loaded from\n` +
      "  wherever it is installed, against a checkout that holds no plugin directory. State the\n" +
      "  method in the text instead, or name the route a run can type — `forge hooks --how <hook>`,\n" +
      "  `forge <verb> -h`.",
  );
}
process.exit(1);
