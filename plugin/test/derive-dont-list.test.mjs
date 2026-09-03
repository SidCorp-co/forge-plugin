/* The one registered hook with no suite: a mutation sweep found both of its decisions unasked, and
   what a nudge says had never been read by anything but a developer. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = new URL("../hooks/entries/derive-dont-list.mjs", import.meta.url).pathname;
const HOME = homeEnv("derive-dont-list");
const room = mkdtempSync(join(tmpdir(), "derive-dont-list-"));

// The literal is the fixture: four names, because three is the floor the hook nudges at.
const LIST = 'const KINDS = ["OPEN", "CLOSED", "MERGED", "DRAFT"];\n';

/* The hook reads the file rather than the event: a `sed -i` leaves no content to judge. */
const nudge = (name, content, session = randomUUID()) => {
  const file = join(room, name);
  writeFileSync(file, content);
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Write", tool_input: { file_path: file } },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim() ? JSON.parse(run.stdout).reason : null;
};

test("a checker hard-coding what it could derive is asked once, and told where to look", () => {
  const session = randomUUID();
  const first = nudge("check-status.mjs", LIST, session);
  assert.match(first, /check-status\.mjs/u);
  assert.match(first, /OPEN, CLOSED, MERGED, DRAFT/u);
  assert.match(first, /derive them from the source/u);
  assert.match(first, /forge hooks --how derive-dont-list/u);
  assert.equal(nudge("check-status.mjs", LIST, session), null, "asked once, then the file is yours");
});

/* Enumerating is sometimes the point, and the way to say so is the comment a reader needs anyway. */
test("a comment above the list is the answer, so it is not asked again", () => {
  const said = `// The four the API returns; enumerating is the point.\n${LIST}`;
  assert.equal(nudge("check-explained.mjs", said), null);
});

test("two constants are a pair, not a list", () => {
  assert.equal(nudge("check-pair.mjs", 'const KINDS = ["OPEN", "CLOSED"];\n'), null);
});

/* Every array literal would earn an ignore list, so only a file whose job is to check something. */
test("a file that checks nothing keeps its own lists", () => {
  assert.equal(nudge("colours.mjs", LIST), null);
});

test("a test file's case table is the point, so it is not a checker", () => {
  assert.equal(nudge("status.test.mjs", LIST), null);
});
