// `plugin/skills/<name>/` is the one source; the standalone code-quality plugin
// ships a copy so a project without Forge still gets these two skills. Writes the
// copy, or with `--check` refuses when it has drifted — `pack:check` runs that.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE = join(ROOT, "plugin", "skills");
const TARGET = join(ROOT, "packages", "code-quality", "claude-plugin", "skills");
const SHARED = ["audit-code-quality", "setup-code-quality"];

const check = process.argv.includes("--check");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

function drift(name) {
  const src = join(SOURCE, name);
  const dst = join(TARGET, name);
  if (!existsSync(dst)) return [`${name}: copy missing`];
  const srcFiles = walk(src).map((f) => relative(src, f));
  const dstFiles = walk(dst).map((f) => relative(dst, f));
  const problems = [];
  for (const f of srcFiles) {
    if (!dstFiles.includes(f)) problems.push(`${name}/${f}: missing from copy`);
    else if (readFileSync(join(src, f), "utf8") !== readFileSync(join(dst, f), "utf8")) {
      problems.push(`${name}/${f}: copy differs from source`);
    }
  }
  for (const f of dstFiles) {
    if (!srcFiles.includes(f)) problems.push(`${name}/${f}: in copy but not in source`);
  }
  return problems;
}

const problems = SHARED.flatMap(drift);

if (check) {
  if (problems.length > 0) {
    console.error("code-quality skill copies have drifted from plugin/skills:");
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nRun `node tools/sync-skills.mjs` to rewrite them from the source.");
    process.exit(1);
  }
  console.log(`sync-skills: ${SHARED.length} skill(s) match plugin/skills.`);
  process.exit(0);
}

for (const name of SHARED) {
  const dst = join(TARGET, name);
  rmSync(dst, { recursive: true, force: true });
  mkdirSync(dst, { recursive: true });
  cpSync(join(SOURCE, name), dst, { recursive: true });
  console.log(`sync-skills: wrote ${relative(ROOT, dst)} from plugin/skills/${name}`);
}
