/* What a landing leaves the harness readers: the release reading `ship` writes, taken through the
   same writer by `land-ready`, keyed on every member it landed and held once however often the step
   that takes it is reached (ISS-2435). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, UUID, context, ctx, forgetInstall, ready,
  seeded, sha, tracker, world,
} from "../landing/fixture.mjs";

const { landReady } = await import("../../../run/land-ready.mjs");
const { Stop } = await import("../../../checkout.mjs");
const { RELEASES, marksOf, scopeOf } = await import("../../../../plugin/src/stats/marks/marks.mjs");
const { slugFor } = await import("../../../../plugin/src/stats/corpus/corpus.mjs");

test.after(() => tracker.close());

const ran = async (keys, work) => {
  const out = [];
  const kept = [console.log, console.error];
  console.log = (...said) => out.push(said.join(" "));
  console.error = (...said) => out.push(said.join(" "));
  try {
    await landReady({ flags: new Map(), words: keys }, ctx(work));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    out.push(error.message);
  } finally {
    [console.log, console.error] = kept;
    process.exitCode = 0;
  }
  return out.join("\n");
};

/* One issue-flow run in the checkout's own transcript store, under the HOME the fixture gave this
   process: a release reading pins a corpus, and a corpus of none writes nothing. */
const oneRun = (work) => {
  const store = join(process.env.HOME, ".claude", "projects", slugFor(work), "session-0", "subagents");
  mkdirSync(store, { recursive: true });
  const at = (seconds) => new Date(Date.parse("2026-09-01T00:00:00.000Z") + seconds * 1000).toISOString();
  writeFileSync(join(store, "agent-a0.jsonl"), [
    { timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-1" } },
    { timestamp: at(30), message: { role: "assistant", content: [{ type: "tool_use", id: "c1", name: "Bash", input: { command: "forge claim ISS-1" } }] } },
    { timestamp: at(600), message: { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "ISS-1  claim: session iss-1 (agent, pid 1), renewed for 30 minute(s)" }] } },
  ].map((one) => JSON.stringify(one)).join("\n") + "\n");
};

const releasesOf = (work) => marksOf(RELEASES, scopeOf(work));

test("a release land-ready installs holds one release reading with its version, its head and every member", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true });
  seeded({ landing: ready(head, base), next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  /* After the install record is cleared, which takes the whole of the fixture's `.claude` with it. */
  forgetInstall();
  oneRun(work);
  const said = await ran([KEY, NEXT_KEY], work);
  const landed = sha(join(at, "origin.git"), `refs/heads/${BASE}`);
  const held = releasesOf(work);
  assert.equal(held.length, 1, `criterion 1: one release reading, and this landing said:\n${said}`);
  const [reading] = held;
  assert.equal(reading.version, "1.0.1", "criterion 1: the version the landing released");
  assert.equal(reading.head, landed, "criterion 1: the head it pushed");
  assert.deepEqual(reading.issues, [KEY, NEXT_KEY], "criterion 1: the key of every member it landed");
  assert.match(said, /stats: this release is held as 1\.0\.1 over 1 run\(s\)/u,
    "criterion 3: the line `releaseMark` returns, which no other writer prints");

  /* The mark step reached again over that release, as a resume after a death inside it would. */
  for (const documentId of [UUID, NEXT_UUID]) context(documentId).landing.state = "installed";
  const again = await ran([KEY, NEXT_KEY], work);
  assert.match(again, /Version 1\.0\.1 was already held, so nothing was written/u, again);
  assert.equal(releasesOf(work).length, 1, "criterion 2: the second pass writes no second reading");
});
