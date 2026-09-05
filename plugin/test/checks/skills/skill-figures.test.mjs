import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../../fixtures.mjs";

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
