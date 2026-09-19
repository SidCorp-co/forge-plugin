/* The project's own configuration file written one key at a time. Every case runs under a home with no
   credential saved in it, so a call that reached the tracker would refuse for want of an endpoint: that
   these pass is the proof a declared key is routed to the file and nothing is sent. docs/cli/doctor.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { homeEnv, ranAsync, tempHome } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

/* Its own line breaks, its own key order and its arrays on one line, because what this write must not
   do is reformat them: a re-serialized one-key change is a diff nobody can review (ISS-1920). */
const HELD = `{
  "slug": "a-tree-that-adopted-this",
  "runs": 2,
  "jobs": {
    "ba": { "verbs": ["issue", "new"], "skills": ["forge"] }
  },
  "codex": { "check": "npm test" },
  "feedback": { "plugin": "bugs" }
}
`;

const room = tempHome("doctor-set-project");
test.after(() => room.remove());
const env = homeEnv("doctor-set-project");
const file = join(room.path, ".forge.json");

const fresh = (text = HELD) => writeFileSync(file, text);
const now = () => readFileSync(file, "utf8");
const ask = (...argv) => ranAsync(FORGE, ["doctor", ...argv], env, room.path);

/** How many lines a diff of the two would mark, which is the whole of what a one-key write may be
 *  judged on: a byte count would pass a document reflowed into the same length, and comparing line by
 *  line by position counts every line after an inserted one as moved. */
const moved = (before, after) => {
  const counts = new Map();
  for (const line of before.split("\n")) counts.set(line, (counts.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of after.split("\n")) {
    const held = counts.get(line) ?? 0;
    if (held) counts.set(line, held - 1);
    else added += 1;
  }
  return Math.max(added, [...counts.values()].reduce((sum, one) => sum + one, 0));
};

test("a declared key is written into the file this checkout resolves, and read back off it", async () => {
  fresh();
  const run = await ask("--set", "review.paths=plugin/src,docs");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^project\.review\.paths: \["plugin\/src","docs"\] {2}← /mu,
    "the value as the file holds it, not a count of it");
  assert.ok(run.stdout.includes(file), `the file's own path, and this said ${run.stdout}`);
  assert.deepEqual(JSON.parse(now()).review, { paths: ["plugin/src", "docs"] });
});

test("a one-key write changes one line and leaves every other byte as it was", async () => {
  fresh();
  await ask("--set", "review.lines=2000");
  const after = now();
  assert.equal(moved(HELD, after), 1, after);
  assert.ok(after.includes(`"ba": { "verbs": ["issue", "new"], "skills": ["forge"] }`),
    "the inline arrays this file was written with are still on their own line");
  assert.equal(JSON.parse(after).slug, "a-tree-that-adopted-this");
});

test("a key inside a table the file already holds is written without its siblings moving", async () => {
  fresh();
  const run = await ask("--set", "jobs.ba.skills=forge,vi-natural");
  assert.equal(run.status, 0, run.stderr);
  const after = now();
  assert.equal(moved(HELD, after), 1, after);
  assert.deepEqual(JSON.parse(after).jobs.ba.verbs, ["issue", "new"],
    "the job's other list is where it was, which one descent short of the key would have replaced");
});

test("a key whose table the file does not hold creates that table holding it alone", async () => {
  fresh();
  await ask("--set", "lease.workingRe=^node tools/run");
  const after = JSON.parse(now());
  assert.deepEqual(after.lease, { workingRe: "^node tools/run" });
  assert.equal(after.review, undefined, "and no key this call did not name gained a value");
  assert.equal(after.landing, undefined);
  assert.equal(after.drainedBy, undefined, "silence where the project has not decided stays silence");
});

/* The judgement is the reader's own, so the sentence a caller reads here is the sentence the same bad
   value earns at the point of use, and the file is not touched to earn it. */
test("a value the key's own reader refuses is refused at the write, and the file is untouched", async () => {
  for (const [given, says] of [
    ["review.paths=/etc", /paths inside the repository, each relative to its root/u],
    ["review.lines=nope", /a whole number of changed lines above zero/u],
    ["landing=sideways", /one of after-merge, before-merge/u],
    ["lease.workingRe=foo(", /a regular expression this CLI can compile/u],
    ["runs=0", /a whole number above 0/u],
  ]) {
    fresh();
    const run = await ask("--set", given);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stderr, says, run.stderr);
    assert.equal(now(), HELD, `${given} left the file changed`);
  }
});

/* The reader that reads this key answers null before it looks at the budget when no command is
   declared, so a `checkMs` written on its own would be judged by nobody until one was (consult b97115). */
test("a budget written where no command is declared is still judged", async () => {
  fresh(`{\n  "slug": "a-tree",\n  "codex": {}\n}\n`);
  const held = now();
  const bad = await ask("--set", "codex.checkMs=0");
  assert.equal(bad.status, 1, bad.stdout);
  assert.match(bad.stderr, /`codex\.checkMs` in \.forge\.json is a whole number of milliseconds above 0/u);
  assert.equal(now(), held);
  const good = await ask("--set", "codex.checkMs=600000");
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(JSON.parse(now()).codex, { checkMs: 600000 },
    "and a good one lands without inventing the command beside it");
});

test("a key this plugin reads nowhere is refused with what the file can hold", async () => {
  fresh();
  const run = await ask("--set", "review.pathz=plugin/src");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`review\.pathz` is no key this plugin reads out of \.forge\.json/u);
  assert.match(run.stderr, /review\.lines, review\.paths/u, "and the list says what it can");
  assert.equal(now(), HELD);
});

/* The flow is two keys and a restore, not one value: a `--set` of it would write the flow and none of
   what that flow asks the project for. */
test("the flow key is refused with the verb that writes it", async () => {
  fresh();
  const run = await ask("--set", "flow=default");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`flow` is written by forge doctor --flow <slug>/u);
  assert.equal(now(), HELD);
});

/* The read back is off the disk rather than off the text this call composed, which is the only way
   this case can be told from a write that worked. */
test("a key the file declares twice is refused after the write, and the file goes back", async () => {
  const twice = `{\n  "review": 1,\n  "review": { "lines": 2 }\n}\n`;
  fresh(twice);
  const run = await ask("--set", "review.paths=plugin/src");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /could not find where `review\.paths` sits in its text/u, run.stderr);
  assert.equal(now(), twice, "and nothing of it was rewritten");
});

/* A document declaring one key twice parses to the last of them, so the span this wrote is not the
   span the resolver reads: the read back off the disk is the only thing that can say so. */
test("a value the file does not hold after the write is refused, and the bytes go back", async () => {
  const twice = `{\n  "runs": 2,\n  "runs": 5\n}\n`;
  fresh(twice);
  const run = await ask("--set", "runs=3");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /runs was written as 3 and .* reads back 5/u, run.stderr);
  assert.match(run.stderr, /declares the key somewhere this write did not reach/u);
  assert.equal(now(), twice, "and the file is back at what it held");
});

test("a file that is not a JSON object is refused with its path", async () => {
  fresh(`["a list where the project's keys belong"]\n`);
  const run = await ask("--set", "runs=3");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /holds a list where a JSON object with this project's keys in it belongs/u);
  assert.ok(run.stderr.includes(file), run.stderr);
});

test("a key on the way to the one named that holds something other than a table is refused", async () => {
  fresh(`{\n  "slug": "a-tree",\n  "review": 4\n}\n`);
  const held = now();
  const run = await ask("--set", "review.lines=2000");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /`review\.lines` goes inside `review`, which this file holds as 4 rather than as a table/u);
  assert.equal(now(), held);
});

/* The one key that has to be settable before the tracker can be asked anything at all. */
test("the slug is written into a checkout that names no project yet", async () => {
  fresh(`{}\n`);
  const run = await ask("--set", "slug=a-new-tree");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(now()).slug, "a-new-tree");
});
