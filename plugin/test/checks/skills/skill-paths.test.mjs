import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";
import { WITHIN as ROLES, rolesIn, skillDirsIn, skillRootsIn } from "../../../src/tools/roles.mjs";

const SCRIPT = new URL("../../../scripts/skill-paths.mjs", import.meta.url).pathname;
const PLUGIN = new URL("../../../", import.meta.url).pathname;

const skillSaying = (body) => {
  const room = tempRoom("skill-paths-");
  const skill = join(room, "skill");
  mkdirSync(join(skill, "references"), { recursive: true });
  writeFileSync(join(skill, "references", "verification.md"), "the method\n");
  mkdirSync(join(room, "outside"));
  writeFileSync(join(room, "outside", "tool.mjs"), "// a real file the skill does not hold\n");
  writeFileSync(join(skill, "SKILL.md"), `---\nname: planted\ndescription: a skill\n---\n\n${body}\n`);
  return skill;
};

const check = (body) => spawnSync(process.execPath, [SCRIPT, skillSaying(body)], { encoding: "utf8" });

/* The case the check was blind to: a path resolving under the plugin root was exempt however far it
   sat from the skill naming it, which is how `scripts/migration-risk.mjs` stood for months. */
test("a path inside the plugin but not inside the skill is refused, with its own remedy", () => {
  const run = check("The gate is `hooks/entries/learning-gate.mjs`, which stops the first write.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /SKILL\.md/u);
  assert.match(run.stdout, /hooks\/entries\/learning-gate\.mjs/u);
  assert.match(run.stdout, /inside this plugin/u);
  assert.match(run.stdout, /forge hooks --how/u);
  assert.doesNotMatch(run.stdout, /let the project name it/u, "a plugin path is nothing the project can supply");
});

/* `..` normalises away, so a citation can climb out of the skill onto a file that exists — which
   an existence test passes and a containment test does not. */
test("a path climbing out of the skill is refused, however real what it lands on", () => {
  const run = check("The measure is `../outside/tool.mjs`.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /\.\.\/outside\/tool\.mjs/u);
});

/* A symlink is lexically inside the skill and resolves outside it, so the copy a reader installs
   carries a link to nothing. Containment of the real file is what sees that. */
test("a symlink out of the skill is refused, though the path reads as the skill's own", () => {
  const skill = skillSaying("Run `references/tool.mjs`.");
  symlinkSync(join(skill, "..", "outside", "tool.mjs"), join(skill, "references", "tool.mjs"));
  const run = spawnSync(process.execPath, [SCRIPT, skill], { encoding: "utf8" });
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /references\/tool\.mjs/u);
});

test("a skill-relative path that resolves nowhere is refused", () => {
  const run = check("Read `references/nope.md` first.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /references\/nope\.md/u);
});

/* The remedies are two because the readings are two, and a refusal a developer cannot act on is
   the defect this check exists to catch. */
test("a project's path is refused and left to the project to name", () => {
  const run = check("Run the migration through `db/scripts/migrate.sql`.");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /let the project name it/u);
  assert.doesNotMatch(run.stdout, /inside this plugin/u);
});

test("a path inside the skill passes, and a bare filename is not a path", () => {
  const run = check("Read `references/verification.md`, then the project's `CLAUDE.md` and `eslint.config.mjs`.");
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /clean/u);
});

/* Passing the root as an argument would not catch this: that branch skips the enumeration (ISS-316). */
test("a flat root is walked whole, and a subdirectory in it takes no role out of the walk", () => {
  const room = tempRoom("skill-roots-");
  const roles = join(room, "agents");
  const skills = join(room, "skills");
  mkdirSync(join(roles, "references"), { recursive: true });
  mkdirSync(join(skills, "alpha"), { recursive: true });
  writeFileSync(join(roles, "runner.md"), "a role\n");
  writeFileSync(join(roles, "triage.md"), "another\n");
  writeFileSync(join(roles, "references", "notes.md"), "a supporting file\n");
  writeFileSync(join(skills, "alpha", "SKILL.md"), "a skill\n");
  const walked = skillDirsIn([{ dir: roles, flat: true }, { dir: skills, flat: false }]);
  assert.deepEqual(walked, [roles, join(skills, "alpha")],
    "inferring flatness from what the root holds let one subdirectory drop every role");
});

/* A check walking two roots of three is a clean tree and an unguarded one, alike from outside. */
test("the roles directory is one of the roots a skill check walks, and it is flat", () => {
  assert.deepEqual(skillRootsIn("/p"), [
    { dir: "/p/skills", flat: false },
    { dir: "/p/guides/skills", flat: false },
    { dir: join("/p", ROLES), flat: true },
  ], "a root out of this list is a tree no skill check reads");
});

/* Only the bare run says the roles were reached. */
test("the default walk reaches every role and skill, and none of them names a path", () => {
  const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout);
  const counted = Number(/clean — (\d+) skill/u.exec(run.stdout)?.[1]);
  const owed = readdirSync(join(PLUGIN, "skills")).length
    + readdirSync(join(PLUGIN, "guides", "skills")).length + 1;
  assert.equal(counted, owed,
    `${counted} directory(ies) walked where ${owed} are shipped: a root is out of the walk, and the `
      + `${rolesIn().length} role(s) it holds are unguarded`);
});
