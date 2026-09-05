/* Twenty-six runs on one prose-vi project met a translation refusal and forty then read
   `vi-natural -h` for the verb that writes the text, so the refusal is judged by running the
   wrapper for real against a gateway that is not configured (ISS-288). */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempRoom } from "../fixtures.mjs";
import { BUNDLED, commandLine } from "../../src/tools/vi.mjs";

const SOURCE = new URL("../../src/tools/vi.mjs", import.meta.url);

/** The layer run for real on a machine that has never run `vi-natural login`: a field it reaches
 *  is refused there, and one it leaves alone comes back on stdout. */
const layerOn = (payload) => {
  const room = tempRoom("vi-refusal-");
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: "any", translate: "vi" }));
  const call = `import("${SOURCE.href}")`
    + `.then((m) => console.log(JSON.stringify(m.translated(${JSON.stringify(payload)}))))`;
  return ranAsync(process.execPath, ["-e", call], { ...process.env, XDG_CONFIG_HOME: room }, room);
};

const refusalFor = (field, value) => layerOn({ [field]: value });

test("a body the gateway cannot write is refused with the doc command that writes it", async () => {
  const { stderr, status } = await refusalFor("description", "The release note in English.");
  assert.equal(status, 1, "the write is refused, not attempted");
  assert.match(stderr, /vi-natural could not write the Vietnamese/u);
  assert.match(stderr, /This is the command that writes it/u, "the refusal hands over the producing command");
  assert.ok(stderr.includes(`${BUNDLED} doc -o`), `the shipped binary and the verb, not a bare name:\n${stderr}`);
  assert.ok(stderr.includes("--register san-pham --no-glossary"), "with the flags this CLI itself passes");
  assert.ok(!/\/tmp\/forge-vi-/u.test(stderr), "and no temp path that is gone by the time it is read");
});

test("a title is refused with the translate command, not the doc one", async () => {
  const { stderr } = await refusalFor("title", "The tracker holds this line");
  assert.ok(stderr.includes(`${BUNDLED} translate --kind doc 'The tracker holds this line'`),
    `the verb named is the one that field goes through:\n${stderr}`);
});

test("the register flags are written once, so the printed command cannot drift from the spawned one", async () => {
  const read = await import("node:fs/promises").then((fs) => fs.readFile(SOURCE, "utf8"));
  assert.equal(read.split("san-pham").length - 1, 1, "a second copy of the register is what goes stale");
  assert.match(commandLine(["doc", "x.md"]), /--register san-pham --no-glossary$/u);
});

/* The user-facing half is the only half of a note the layer walks: an enum and a payload stay put. */
test("a release note's user-facing half goes through the layer, and its other two halves do not", async () => {
  const note = { section: "Fixed", userFacing: "You write it in English.", technical: "One path in PROSE_FIELDS." };
  const { stderr, status } = await layerOn({ releaseNotes: note });
  assert.equal(status, 1, "the half is reached, so an unwritable gateway refuses the whole note");
  assert.ok(stderr.includes(`${BUNDLED} doc -o`), `and by the verb a description goes through:\n${stderr}`);

  const written = await layerOn({ releaseNotes: { ...note, userFacing: "" } });
  assert.equal(written.status, 0, `the enum and the payload half reach no gateway:\n${written.stderr}`);
  assert.deepEqual(JSON.parse(written.stdout).releaseNotes, { ...note, userFacing: "" }, "and come back as written");
});
