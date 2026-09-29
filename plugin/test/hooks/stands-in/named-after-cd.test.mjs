/* Where `named()` places the names a Bash call spells. It answers without the disk, so a name is
   placed by the text alone: in every tree a `cd` before it could have left the shell in (ISS-2860). */
import assert from "node:assert/strict";
import test from "node:test";

import { named } from "../../../hooks/_hook.mjs";

const HERE = "/home/elsewhere";
const spelled = (command) => named({ tool_name: "Bash", tool_input: { command }, cwd: HERE });

test("a relative name after a cd is placed in the tree that cd reached", () => {
  assert.deepEqual(spelled("cd /tmp/wt && sed -i s/a/b/ plugin/skills/x/SKILL.md"), ["/tmp/wt/plugin/skills/x/SKILL.md"]);
  assert.deepEqual(spelled("sed -i s/a/b/ plugin/skills/x/SKILL.md"), [`${HERE}/plugin/skills/x/SKILL.md`]);
});

test("a relative name after a cd on its own line is placed in both trees the shell could stand in", () => {
  assert.deepEqual(spelled("cd /tmp/wt\nsed -i s/a/b/ plugin/skills/x/SKILL.md"),
    ["/tmp/wt/plugin/skills/x/SKILL.md", `${HERE}/plugin/skills/x/SKILL.md`]);
});

test("a name spelled absolutely, after a ~ or after a $ is placed as spelled whatever cd came before", () => {
  assert.deepEqual(spelled("cd /tmp/wt && sed -i s/a/b/ /abs/plugin/skills/x/SKILL.md"), ["/abs/plugin/skills/x/SKILL.md"]);
  for (const command of ["cd /tmp/wt && sed -i s/a/b/ ~/plugin/skills/x/SKILL.md", "cd /tmp/wt && sed -i s/a/b/ $HOME/plugin/skills/x/SKILL.md"]) {
    const found = spelled(command);
    assert.equal(found.length, 1, command);
    assert.ok(!found[0].startsWith("/tmp/wt/"), `${command} was moved by the cd: ${found[0]}`);
  }
});

test("a relative name after a cd whose destination the text does not carry is placed in the event's cwd", () => {
  assert.deepEqual(spelled('cd "$(mktemp -d)" && sed -i s/a/b/ plugin/skills/x/SKILL.md'), [`${HERE}/plugin/skills/x/SKILL.md`]);
  assert.deepEqual(spelled("cd - && sed -i s/a/b/ plugin/skills/x/SKILL.md"), [`${HERE}/plugin/skills/x/SKILL.md`]);
});
