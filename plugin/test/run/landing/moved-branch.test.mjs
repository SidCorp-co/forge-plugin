/* The branch under the landing, against the head the checkpoint names: a builder who committed after
   `--ready`, and a branch rewritten under it. What the landing merges is the judged head either way,
   so the only thing these judge is whether it is said before the push (ISS-1644). */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  BASE, BRANCH, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, OWNED,
  ctx, git, ready, seeded, sha, tracker, world,
} from "./fixture.mjs";

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { tipSaid } = await import("../../../../tools/run/land-ready/branch.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");

const SELF = "node tools/run.mjs";

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

const remote = (at, ref = `refs/heads/${BASE}`) => sha(join(at, "origin.git"), ref);
const short = (one) => one.slice(0, 7);

/** What a builder does after the checkpoint is written: another commit on the branch, pushed. */
const commitOn = (work, branch, subject) => {
  git(work, "checkout", "-q", branch);
  writeFileSync(join(work, OWNED), `${subject}\n`, { flag: "a" });
  git(work, "add", OWNED);
  git(work, "commit", "-qm", subject);
  git(work, "push", "-q", "origin", branch);
  git(work, "checkout", "-q", BASE);
  return sha(work, branch);
};

test("a branch standing past the judged head refuses the landing, naming what is between them", async () => {
  const { at, work, head, base } = world();
  const tip = commitOn(work, BRANCH, "the fix the builder wrote after --ready");
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.ok(said.includes(short(head)), `the judged head is named:\n${said}`);
  assert.ok(said.includes(short(tip)), `and so is the tip:\n${said}`);
  assert.match(said, /1 commit\(s\) past it/u, said);
  assert.match(said, /the fix the builder wrote after --ready/u, "the subject, not only a count");
  assert.ok(said.includes(`--force-with-lease=${BRANCH}:${tip} origin ${head}:refs/heads/${BRANCH}`),
    `the push that clears it, leased on the tip:\n${said}`);
  assert.match(said, /forge claim ISS-673 --pushed --ready/u, "and the second route, this being `ready`");
  assert.equal(remote(at), base, `nothing was landed:\n${said}`);
});

test("past ready the refusal offers the push alone, the capture being refused at that state", async () => {
  const { work, head, base } = world();
  const tip = commitOn(work, BRANCH, "a commit made while the landing held the branch");
  seeded({ landing: ready(head, base, { state: "candidate", pinned: base, candidate: head }) });
  const said = await ran([KEY], work);
  assert.ok(said.includes(short(tip)), said);
  assert.ok(said.includes("--force-with-lease"), said);
  assert.doesNotMatch(said, /--pushed --ready/u, "which readyCheckpoint refuses past `ready`");
});

test("a branch that let the judged head go is refused on that reading, not on the merge", async () => {
  const { at, work, head, base } = world();
  git(work, "checkout", "-qB", "rewritten", BASE);
  writeFileSync(join(work, OWNED), "the change, rebased and written again\n");
  git(work, "add", OWNED);
  git(work, "commit", "-qm", "the change on iss-673, rebased");
  git(work, "push", "-q", "--force", "origin", `rewritten:${BRANCH}`);
  git(work, "checkout", "-q", BASE);
  const tip = sha(work, "rewritten");
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.match(said, /does not reach it/u, said);
  assert.doesNotMatch(said, /cannot read/u, "the checkout holds the orphan, so that is not the reason");
  assert.ok(said.includes(`--force-with-lease=${BRANCH}:${tip} origin ${head}:refs/heads/${BRANCH}`), said);
  assert.equal(remote(at), base, `nothing was landed:\n${said}`);
});

test("a judged head no checkout can read is refused naming the tip and the tree to push from", async () => {
  const { work, base } = world();
  const gone = "0123456789abcdef0123456789abcdef01234567";
  seeded({ landing: ready(gone, base) });
  const said = await ran([KEY], work);
  assert.match(said, /cannot read even after fetching/u, said);
  assert.ok(said.includes(short(sha(work, BRANCH))), `the tip it does stand at:\n${said}`);
  assert.match(said, /from whichever tree still holds it/u, said);
});

test("a moved tip takes its own branch out of the landing and the one beside it is released", async () => {
  const { at, work, head, next, base } = world({ second: true });
  commitOn(work, BRANCH, "the first builder's afterthought");
  seeded({
    landing: ready(head, base),
    next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }),
  });
  const said = await ran([KEY, NEXT_KEY], work);
  assert.match(said, /ISS-673 is out of this landing/u, said);
  const landed = remote(at);
  assert.notEqual(landed, base, `${BASE} moved:\n${said}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", next, landed).status, 0,
    `and carries the branch beside the refused one:\n${said}`);
  assert.equal(git(work, "merge-base", "--is-ancestor", head, landed).status, 1,
    `and nothing of the refused one:\n${said}`);
});

test("a branch standing at the judged head is refused nothing and says what it says today", async () => {
  const { at, work, head, base } = world();
  seeded({ landing: ready(head, base) });
  const said = await ran([KEY], work);
  assert.match(said, /iss-673 was judged at/u, said);
  assert.doesNotMatch(said, /stands at/u, `no word of a tip on the clean path:\n${said}`);
  assert.notEqual(remote(at), base, `and it landed:\n${said}`);
});

test("a remote that will not name the branch is the question unanswered, not a branch standing still", async () => {
  const { at, work, head, base } = world();
  git(join(at, "origin.git"), "update-ref", "-d", `refs/heads/${BRANCH}`);
  const said = tipSaid(work, KEY, ready(head, base), SELF);
  assert.match(said, /named nothing for iss-673/u, said);
  assert.match(said, /Nothing is merged on a reading this uncertain/u, said);
  assert.ok(said.includes(`${SELF} land-ready ${KEY}`), said);
});

test("a tip pushed after the fetch is the question unanswered, not a branch that was rewritten", async () => {
  const { at, work, head, base } = world();
  const clone = join(at, "clone-ahead");
  spawnSync("git", ["clone", "-q", "-b", BRANCH, join(at, "origin.git"), clone], { cwd: dirname(clone), encoding: "utf8" });
  writeFileSync(join(clone, OWNED), "a line the landing's checkout never fetched\n", { flag: "a" });
  git(clone, "add", OWNED);
  git(clone, "commit", "-qm", "a commit pushed after the landing fetched");
  git(clone, "push", "-q", "origin", BRANCH);
  const said = tipSaid(work, KEY, ready(head, base), SELF);
  assert.match(said, /does not hold/u, said);
  assert.doesNotMatch(said, /rewritten/u, "the ancestry went unanswered, so nothing is claimed of it");
  assert.doesNotMatch(said, /force-with-lease/u, "and no push is advised off a reading it could not make");
});
