/* An issue whose own change landed outside the flow, with only its record missing, had one finding to
   say so, `already-fixed`, and that finding drops the issue: the one status that erases that the work
   shipped (ISS-1693). The write is exercised at the verb a run types and the route off the page it
   posted; the pages a hand types are built here, so a read path that stopped running the shape's
   check, or stopped reading the issue's landing shape, would let one of them earn the rung. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempRoom } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("own-landing-");
const { CHECKS, dispositionOf, nextOf, viewFrom } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const issue = {
  documentId: "landing-uuid",
  issueId: "ISS-7",
  status: "confirmed",
  title: "the export drops the header row",
  description: "x",
};
const project = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [issue],
  comments: { "landing-uuid": [] },
  answer: {
    forge_issues: (args) => {
      if (args.action === "list") return { issues: project.issues, returned: 1, hasMore: false };
      if (args.action === "update") return Object.assign(issue, args.data);
      return issue;
    },
  },
};
const { tracker, env } = await trackerFor(project);
test.after(() => tracker.close());
for (const again of [1, 2]) assert.ok(again && await ranAsync(FORGE, ["claim", "ISS-7", "--unheld"], env));

const SHA = "fdf853cbd";
const PLACE = "https://cms.example.test/pages/export";
const posts = () => project.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create");
const bodyOf = (post) => post.args.data?.body ?? post.args.body;
const write = async (...extra) => {
  const before = posts().length;
  const run = await ranAsync(FORGE, ["record", "confirmation", "ISS-7", "--is", "the header row is written",
    "--where", "src/export.mjs", ...extra], env);
  return { ...run, posted: posts().slice(before) };
};
/* The issue's landing shape, for the one case that reads it, and back for every other. */
const landingOutsideGit = async (body) => {
  issue.landingShape = "outside_git";
  try {
    return await body();
  } finally {
    delete issue.landingShape;
  }
};

const BUILT = { sessionContext: { worklog: { branch: "iss-7-the-work" } } };
const pageOf = (bodies, shape = {}) =>
  viewFrom("landing-uuid", { ...BUILT, ...issue, ...shape },
    bodies.map((body, at) => ({ createdAt: `2026-09-28T10:0${at}:00.000Z`, authorId: "agent", body })));
const confirmedOwes = (view) => CHECKS.confirmed(view, "ISS-7");
/* A confirmation as another client would post it: the fenced block keyed by flag, and the tag. */
const byHand = (fields) => [
  "## Confirmation", "", "```forge-record",
  ...Object.entries(fields).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`),
  "```", "", "`forge-record: confirmation · contract 1`",
].join("\n");
const handPage = (fields, shape) =>
  pageOf([byHand({ is: "the header row is written", where: "src/export.mjs", ...fields })], shape);

test("an own-landing confirmation naming its landing is written, and --owed names approved next rather than dropped", async () => {
  const run = await write("--finding", "own-landing", "--landed", SHA);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.posted.length, 1, "one comment went up");
  const body = bodyOf(run.posted[0]);
  assert.match(body, new RegExp(`^landed: ${SHA}$`, "mu"), body);
  const view = pageOf([body]);
  assert.deepEqual(confirmedOwes(view), [], "the posted page earns confirmed");
  assert.equal(dispositionOf(view), null, "a landing of the issue's own change is no disposition");
  assert.equal(nextOf("confirmed", view), "approved");
  project.comments["landing-uuid"] = [{ documentId: "c-1", createdAt: "2026-09-28T10:00:00.000Z", authorId: "agent", body }];
  try {
    const owed = await ranAsync(FORGE, ["advance", "ISS-7", "--owed"], env);
    assert.equal(owed.status, 0, owed.stderr);
    assert.match(owed.stdout, /ISS-7 is confirmed; approved is next/u, owed.stdout);
    assert.doesNotMatch(owed.stdout, /dropped is next/u, owed.stdout);
  } finally {
    project.comments["landing-uuid"] = [];
  }
});

test("an own-landing confirmation with no --landed is refused at the write, naming the flag", async () => {
  const run = await write("--finding", "own-landing");
  assert.equal(run.status, 1, run.stdout);
  assert.equal(run.posted.length, 0, "nothing went up");
  assert.match(run.stderr, /record confirmation needs --landed </u, run.stderr);
});

test("--landed beside any other finding is refused rather than dropped", async () => {
  for (const finding of ["holds", "already-fixed", "cause-fixed"]) {
    const halves = finding === "cause-fixed" ? ["--fixed", "x", "--survives", "y"] : [];
    const run = await write("--finding", finding, ...halves, "--landed", SHA);
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.posted.length, 0, `nothing went up beside ${finding}`);
    assert.match(run.stderr, new RegExp(`no --landed beside --finding ${finding}`, "u"), run.stderr);
  }
});

test("a --landed in a shape the issue does not land in is refused at the write", async () => {
  const prose = await write("--finding", "own-landing", "--landed", "it shipped last week");
  assert.equal(prose.status, 1, prose.stdout);
  assert.equal(prose.posted.length, 0, "no prose goes up for an issue landing in git");
  assert.match(prose.stderr, /--landed takes the commit this issue's own change landed as/u, prose.stderr);
  await landingOutsideGit(async () => {
    const sha = await write("--finding", "own-landing", "--landed", SHA);
    assert.equal(sha.status, 1, sha.stdout);
    assert.equal(sha.posted.length, 0, "no sha goes up for an issue landing outside git");
    assert.match(sha.stderr, /--landed takes where the change now is, and `fdf853cbd` reads as a commit sha/u, sha.stderr);
    const place = await write("--finding", "own-landing", "--landed", PLACE);
    assert.equal(place.status, 0, place.stderr);
    assert.equal(place.posted.length, 1, "a place goes up for an issue landing outside git");
  });
});

test("a hand-written own-landing page earns confirmed only with a landing in the issue's own shape", () => {
  const bare = handPage({ finding: "own-landing" });
  assert.equal(confirmedOwes(bare).length, 1, "a page lacking the landed line earns no confirmed");
  assert.equal(dispositionOf(bare), null, "and drops nothing either");
  assert.equal(confirmedOwes(handPage({ finding: "own-landing", landed: "it shipped" })).length, 1,
    "prose is no landing on an issue landing in git");
  const outside = { landingShape: "outside_git" };
  assert.equal(confirmedOwes(handPage({ finding: "own-landing", landed: SHA }, outside)).length, 1,
    "a sha is no landing on an issue landing outside git");
  assert.deepEqual(confirmedOwes(handPage({ finding: "own-landing", landed: PLACE }, outside)), []);
  assert.deepEqual(confirmedOwes(handPage({ finding: "own-landing", landed: SHA })), []);
});

test("an already-fixed page written before own-landing existed still earns confirmed and still drops", () => {
  const old = handPage({ finding: "already-fixed" });
  assert.deepEqual(confirmedOwes(old), [], "the old single reading still resolves");
  assert.equal(nextOf("confirmed", old), "dropped");
  assert.equal(dispositionOf(old), "already-fixed", "and the finding is still the drop's reason");
});

test("the help says which of the two histories each finding is", async () => {
  const help = await ranAsync(FORGE, ["record", "confirmation", "-h"], env);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /already-fixed is another change's fix and drops the issue/u, help.stdout);
  assert.match(help.stdout, /own-landing is this issue's own change landed outside the flow with only its record owed, and keeps the lane/u,
    help.stdout);
});
