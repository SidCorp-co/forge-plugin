/* A record whose comment the tracker would refuse for its length sends nothing, because the upload
   ahead of the comment is the step that cannot be taken back (ISS-489). Every case spawns the verb
   against a fake tracker and counts what reached it. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("comment-cap").path;
const { bodyCap } = await import("../../../src/tracker/comment-cap.mjs");
const { lengthOf } = await import("../../../src/tracker/field-write.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const COMMIT = "43b811e";
const CAP = bodyCap();
const COUNT = 26;
/* Long enough that the verdicts over every criterion need two or more comments, short enough that one
   verdict's block fits a comment alone. */
const TEXT = (number) => `Outcome ${number}: ${"the thing this criterion names holds as written ".repeat(8).trim()}.`;

const judging = {
  documentId: "cap-uuid",
  issueId: "ISS-9",
  status: "testing",
  title: "a verdict over many criteria",
  description: "no mark here",
  acceptanceCriteria: Array.from({ length: COUNT }, (_, at) => `${at + 1}. ${TEXT(at + 1)}`).join("\n"),
  attachments: [],
};
const state = { calls: [], issues: [judging], comments: { "cap-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "update") return Object.assign(judging, args.data);
  return judging;
};
state.answer.forge_comments = (args) => {
  if (args.action === "list") {
    const rows = state.comments[args.filters?.issue] ?? [];
    return { comments: rows, returned: rows.length, hasMore: false };
  }
  const rows = (state.comments[args.data?.issue] ??= []);
  const id = `comment-${rows.length}`;
  rows.push({ documentId: id, createdAt: `2026-09-05T11:${String(rows.length).padStart(2, "0")}:00.000Z`,
    body: args.data?.body });
  return { documentId: id };
};
const { tracker, env: ENV } = await trackerFor(state);
after(() => tracker.close());

const sink = createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "up", name: "n", url: "/api/attachments/up/download" }));
  });
});
await new Promise((ready) => sink.listen(0, "127.0.0.1", ready));
after(() => sink.close());
state.answer.forge_uploads = (args) => {
  const name = args?.data?.name ?? "unnamed";
  judging.attachments.push({ name });
  return { uploadUrl: `http://127.0.0.1:${sink.address().port}/put/${name}` };
};

const room = tempRoom("comment-cap-files-");
const env = { ...ENV, FORGE_SESSION_ID: "comment-cap-session" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const count = (name, action) => state.calls
  .filter((one) => one.name === name && (!action || one.args?.action === action)).length;
const snapshot = () => ({
  uploads: count("forge_uploads"),
  updates: count("forge_issues", "update"),
  posted: state.comments["cap-uuid"].length,
});
const file = (name) => {
  const path = join(room, name);
  writeFileSync(path, `evidence for ${name}\n`);
  return path;
};
const criteria = (numbers) => numbers.flatMap((number) => ["--criterion", String(number)]);
const ALL = Array.from({ length: COUNT }, (_, at) => at + 1);

/* The refusal's own lines, read the way a caller retyping it would read them. */
const groupsIn = (stderr) => [...stderr.matchAll(/^ {2}the --criterion blocks ([\d, ]+) {2}\((\d+) code points\)$/gmu)]
  .map((one) => ({ numbers: one[1].split(", ").map(Number), length: Number(one[2]) }));

before(async () => {
  await ask("claim", "ISS-9", "--unheld");
  const claimed = await ask("claim", "ISS-9", "--unheld");
  assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);
});

test("the comment cap is declared, so the measurement has a number to measure against", () => {
  assert.equal(CAP, 10000);
});

test("a verdict over the comment cap sends no upload, no field write and no comment, and names each write it splits into", async () => {
  const [one, two] = [file("first-run.txt"), file("second-run.txt")];
  const shared = ["--commit", COMMIT, "--verdict", "pass", "--evidence", one, "--evidence", two];
  const was = snapshot();
  const run = await ask("record", "verdict", "ISS-9", ...shared, ...criteria(ALL));
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(snapshot(), was, `nothing reached the tracker:\n${run.stderr}`);

  const said = /would post a comment of (\d+) code points, and the tracker caps a comment at (\d+)\./u
    .exec(run.stderr);
  assert.ok(said, run.stderr);
  const [length, cap] = [Number(said[1]), Number(said[2])];
  assert.equal(cap, CAP, "the cap it names is the declared one");
  assert.ok(length > cap, "and the length it names is over it");
  assert.match(run.stderr, new RegExp(`Nothing was sent\\. ${length - cap} has to come off\\.`, "u"),
    "the amount that has to come off is the difference");

  const groups = groupsIn(run.stderr);
  assert.ok(groups.length >= 2, `a split, named by criterion: ${run.stderr}`);
  assert.deepEqual(groups.flatMap((group) => group.numbers), ALL, "every criterion in one write, in order");
  for (const group of groups) assert.ok(group.length <= CAP, `each write fits: ${group.length}`);
  assert.match(run.stderr, /^ {2}--evidence first-run\.txt --evidence second-run\.txt$/mu,
    "and the names every later write cites the files by");

  /* Typed as named: the first write sends the paths, each later one cites what went up. */
  for (const [at, group] of groups.entries()) {
    const evidence = at === 0 ? [one, two] : ["first-run.txt", "second-run.txt"];
    const before = snapshot();
    const wrote = await ask("record", "verdict", "ISS-9", "--commit", COMMIT, "--verdict", "pass",
      ...evidence.flatMap((ref) => ["--evidence", ref]), ...criteria(group.numbers));
    assert.equal(wrote.status, 0, `write ${at + 1} as named goes through: ${wrote.stderr}`);
    assert.equal(snapshot().posted - before.posted, 1, "as one comment");
    assert.equal(snapshot().uploads - before.uploads, at === 0 ? 2 : 0, "the files going up once");
    assert.equal(lengthOf(state.comments["cap-uuid"].at(-1).body), group.length,
      "the length the refusal printed is the length of the comment the write posted");
  }
});

test("a criterion whose own block is over the cap is named with the amount to cut from it", async () => {
  const why = "w".repeat(CAP);
  const was = snapshot();
  const run = await ask("record", "verdict", "ISS-9", "--commit", COMMIT, "--verdict", "pass",
    "--evidence", COMMIT, "--criterion", "1", "--criterion", "2", "--verdict", "fail", "--why", why,
    "--criterion", "3");
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(snapshot(), was, "nothing reached the tracker");
  const alone = /^--criterion 2 is over the cap by itself, so no split carries it: shorten its own values by (\d+) and write it alone\.$/mu
    .exec(run.stderr);
  assert.ok(alone, run.stderr);
  assert.ok(Number(alone[1]) > 0 && Number(alone[1]) < lengthOf(why), `a cut it can make: ${alone[1]}`);
  assert.deepEqual(groupsIn(run.stderr).flatMap((group) => group.numbers), [1, 3],
    "the criteria that do fit still go in a write");
});

test("the verdict help states the comment cap and that a write over it is refused before any file goes up", async () => {
  const run = await ask("record", "verdict", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`comment is over ${CAP} code points`, "u"));
  assert.match(run.stdout, /refused before any file goes up/u);
});
