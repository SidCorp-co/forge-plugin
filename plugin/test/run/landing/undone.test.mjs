/* A member of a landing whose clean merge still takes back work that landed under its branch
   (ISS-369): its builder replayed it onto the base and then committed copies that predate what
   landed there. It goes back to that builder at `head-owed` and the member beside it lands; the
   three shapes that are no take-back land as any branch does. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  BASE, BRANCH, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, OWNED, context, git, landingRan, ready,
  seeded, sha, tracker, world,
} from "./fixture.mjs";

const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

const TEN = Array.from({ length: 10 }, (_, at) => `line ${at + 1}`);
const LANDED = "line 9, as another run landed it";
const MOVED = join("docs", "moved.md");

const written = (work, path, lines) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), `${lines.join("\n")}\n`);
};

/* The change's own line, and line 9 as each shape leaves it. */
const SHAPES = {
  stale: { nine: "line 9" },
  rewrite: { nine: "line 9, as this change rewrote it" },
  move: { nine: "line 9", moved: [LANDED] },
  declared: { nine: "line 9", declares: true },
};

/* Another run lands a new line 9 under both branches; the first branch is then replayed onto it and
   committed as `shape` has it, and pushed again. The second branch is left as it was cut. */
const replayedWorld = (shape) => {
  const { at, work, next } = world({ second: true });
  written(work, OWNED, TEN.map((one) => (one === "line 9" ? LANDED : one)));
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "another run's line 9");
  const landed = sha(work, "HEAD");
  git(work, "push", "-q", "origin", `HEAD:${BASE}`);
  git(work, "checkout", "-q", BRANCH);
  git(work, "reset", "-q", "--hard", BASE);
  const { nine, moved, declares } = SHAPES[shape];
  written(work, OWNED, TEN.map((one) => (one === "line 2" ? "line 2, as the change wrote it" : one === "line 9" ? nine : one)));
  if (moved) written(work, MOVED, moved);
  git(work, "add", OWNED, ...(moved ? [MOVED] : []));
  git(work, "commit", "-qm", `the change, as a ${shape}`);
  if (declares) git(work, "commit", "-q", "--allow-empty", "-m", "that line is wrong", "-m", `Undoes: ${landed}`);
  git(work, "push", "-q", "-f", "origin", BRANCH);
  const head = sha(work, BRANCH);
  git(work, "checkout", "-q", BASE);
  seeded({
    landing: ready(head, landed, { files: [OWNED, ...(moved ? [MOVED] : [])] }),
    next: ready(next, landed, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
  });
  return { at, work, head, next, landed };
};

const onBase = (at, head) =>
  git(join(at, "origin.git"), "merge-base", "--is-ancestor", head, `refs/heads/${BASE}`).status === 0;

test("a member taking back landed work goes back at head-owed and the member beside it lands", async () => {
  const { at, work, head, next, landed } = replayedWorld("stale");
  const said = await landingRan([KEY, NEXT_KEY], work);
  assert.match(said, /takes back work that landed under it/u, said);
  assert.ok(said.includes(`${landed.slice(0, 7)} another run's line 9 — ${OWNED}`), said);
  assert.equal(landingOf(context()).state, "head-owed", said);
  assert.match(said, new RegExp(`forge claim ${KEY} --pushed --ready`, "u"), `no recapture line:\n${said}`);
  assert.ok(!onBase(at, head), `the refused member landed:\n${said}`);
  assert.ok(onBase(at, next), `the member beside it did not land:\n${said}`);
  assert.notEqual(landingOf(context(NEXT_UUID)).state, "head-owed", said);
});

for (const shape of ["rewrite", "move", "declared"]) {
  test(`a member whose change ${shape === "declared" ? "declares its take-back" : `is a ${shape}`} of landed work lands`, async () => {
    const { at, work, head } = replayedWorld(shape);
    const said = await landingRan([KEY, NEXT_KEY], work);
    assert.doesNotMatch(said, /takes back work that landed under it/u, said);
    assert.match(said, /1 commit\(s\) landed under this change since it was cut at .* takes back no hunk/u, said);
    assert.ok(onBase(at, head), `the member did not land:\n${said}`);
  });
}
