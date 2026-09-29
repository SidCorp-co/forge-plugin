/* What the two door gates say is one module's, so a log reader it hands out is shared by every tree a
   call gates; the refusals themselves are held word for word by each gate's own suite. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../fixtures.mjs";
import { escapeFor, logReader, malformed } from "../../src/codex/log/owed-refusal.mjs";

const homeWith = (rows) => {
  const home = tempRoom("owed-refusal-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "codex-log.jsonl"), rows);
  return home;
};

test("one reader parses a home's log once, and a second home's apart from it", () => {
  const was = process.env.XDG_CONFIG_HOME;
  const [one, two] = [homeWith('{"a":1}\n'), homeWith('{"b":2}\n')];
  try {
    const read = logReader();
    process.env.XDG_CONFIG_HOME = one;
    const first = read();
    assert.equal(read(), first, "the same home is answered from what was read");
    process.env.XDG_CONFIG_HOME = two;
    assert.notEqual(read(), first, "another home is read on its own");
    process.env.XDG_CONFIG_HOME = one;
    assert.equal(read(), first, "and the first is still held");
    assert.notEqual(logReader()(), first, "while a reader handed to the next call reads afresh");
  } finally {
    if (was === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = was;
  }
});

test("each gate's escape names its own switch, the malformed door among them", () => {
  assert.match(escapeFor("codex-owed"), /^Past the gate: `forge hooks --off codex-owed`/u);
  assert.match(malformed("push", "codex-second"), /`forge hooks --off codex-second`[\s\S]*\n\npush is no door this reads/u);
});
