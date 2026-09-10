import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";
import { skillGuidesRoot } from "../../../src/guides/skill-guides.mjs";

const SCRIPT = new URL("../../../scripts/skill-figures.mjs", import.meta.url).pathname;

const check = (...dirs) => {
  const run = spawnSync(process.execPath, [SCRIPT, ...dirs, "--json"], { encoding: "utf8" });
  return { status: run.status, ...JSON.parse(run.stdout) };
};

const PLANTED = `# Skill: alpha

Measured on a 3,895-character body, the file costs 153 against 4,202 inline.
Run \`forge issues --limit 1000\` and read ISS-290 as of 3.35.128; 600 bytes is the cap.
Since v3.35.129 a call waits 1000ms and reads 2048MB.

\`\`\`bash
chmod 600 ~/.config/alpha/config.json
\`\`\`

A round trip is about twenty bytes; 21× cheaper is still a rule.
`;

test("a measurement is red, with or without a unit glued on; a limit in a code span, an issue key, a version and a fenced block pass", (t) => {
  const root = tempRoom("skill-figures-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "alpha", "references"), { recursive: true });
  writeFileSync(join(root, "alpha", "SKILL.md"), PLANTED);
  writeFileSync(join(root, "alpha", "references", "one.md"), "# One\n\nNothing counted here.\n");
  const held = check(root);
  assert.equal(held.status, 1);
  assert.deepEqual(held.findings.map((one) => [one.line, one.figure]), [[3, "3,895"], [4, "600"], [5, "1000"]]);
});

test("the shipped skills carry no measurement", () => {
  const held = check();
  assert.deepEqual(held.findings, []);
  assert.equal(held.status, 0);
});

/* A default run walks the stubs and the one served root, so a figure in a served body is a figure in
   the skill: watched firing on the moved layout, and the root asserted to be the one it walks. */
test("a figure in a served body under the moved layout is named, and that root is a default one", (t) => {
  const root = tempRoom("skill-figures-served-");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, "guides", "skills", "alpha", "default");
  mkdirSync(join(dir, "guide"), { recursive: true });
  mkdirSync(join(dir, "references"), { recursive: true });
  writeFileSync(join(dir, "guide", "01-skill-alpha.md"), "# Skill: alpha\n\nThe opening.\n");
  writeFileSync(join(dir, "guide", "02-the-measure.md"),
    "## The measure\n\nMeasured over 4,096 runs of the gate.\n");
  const held = check(join(root, "guides", "skills"));
  assert.equal(held.status, 1);
  assert.deepEqual(held.findings.map((one) => one.figure), ["4,096"],
    "a part under the flow's own directory is walked, at whatever depth it has come to sit");
  const plugin = new URL("../../../", import.meta.url).pathname;
  assert.equal(skillGuidesRoot(plugin), join(plugin, "guides", "skills"),
    "and the root a default run walks is where every served body now sits");
});
