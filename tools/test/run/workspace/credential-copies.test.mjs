/* The reading `finish` takes of a run's scratch before it removes anything: which files hold a copy of
   one of this machine's credentials (ISS-2612). The end-to-end refusal is `finish.test.mjs`'s. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../../../plugin/test/fixtures.mjs";
import { copiesIn } from "../../../run/workspace/credential-copies.mjs";

const SECRET = "a-machine-token-0123456789";

test("every file under the scratch holding a secret is named, however deep, and no other", () => {
  const scratch = tempRoom("copies-");
  mkdirSync(join(scratch, "xdg", "forge"), { recursive: true });
  const config = join(scratch, "xdg", "forge", "config.json");
  writeFileSync(config, JSON.stringify({ token: SECRET }));
  const log = join(scratch, "probe.log");
  writeFileSync(log, `sent with ${SECRET} in a header\n`);
  writeFileSync(join(scratch, "clean.log"), "nothing of the machine's\n");
  assert.deepEqual(copiesIn(scratch, [SECRET]).sort(), [config, log].sort());
});

test("a link is not followed, the file it names being somewhere else's", () => {
  const scratch = tempRoom("copies-link-");
  const elsewhere = join(tempRoom("copies-elsewhere-"), "config.json");
  writeFileSync(elsewhere, JSON.stringify({ token: SECRET }));
  symlinkSync(elsewhere, join(scratch, "linked.json"));
  assert.deepEqual(copiesIn(scratch, [SECRET]), []);
});

test("a scratch that is gone, or a machine holding no secret, names nothing", () => {
  assert.deepEqual(copiesIn(join(tempRoom("copies-gone-"), "absent"), [SECRET]), []);
  const scratch = tempRoom("copies-none-");
  writeFileSync(join(scratch, "any.log"), "anything\n");
  assert.deepEqual(copiesIn(scratch, []), []);
});
