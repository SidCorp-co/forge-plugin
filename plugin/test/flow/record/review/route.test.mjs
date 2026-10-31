/* A criterion core routes to the review is recorded through core's review (`POST /api/issues/:id/
   review`), and no verb made that call: the owed line named the raw route. `forge record review`
   given `--head` makes it, with the body the route's schema names (`recordReviewRequestSchema`),
   every bound of it refused here before anything is sent. Without `--head` the kind stays the
   thread's code-review record. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { spawnSync } from "node:child_process";

import { projectRoom, ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { OWN, trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("review-route").path;

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const ISSUE = { documentId: "review-uuid", issueId: "ISS-40", projectId: OWN.id, status: "in_progress", title: "t", description: "d" };
const state = { issues: [ISSUE], comments: { "review-uuid": [] }, answer: {} };
state.answer.forge_issues = (args) => (args.action === "list" ? { issues: [ISSUE], returned: 1, hasMore: false } : ISSUE);
state.answer["forge_issues.review"] = (args) => (state.refuse ? { refused: state.refuse }
  : { id: args.documentId, review: { id: "rev-1", base: args.data.base, head: args.data.head, result: "pass", failed: [] } });
const ROOM = tempRoom("review-route-");
spawnSync("git", ["init", "-q", "-b", "master", ROOM], { cwd: ROOM });
const { tracker, env: ENV } = await trackerFor(state, [ROOM]);
projectRoom(ROOM, ENV.XDG_CONFIG_HOME, OWN);
after(() => tracker.close());

const review = (...argv) => {
  state.calls = [];
  return ranAsync(FORGE, ["record", "review", "ISS-40", ...argv], { ...ENV, FORGE_SESSION_ID: "a-reviewer" }, ROOM);
};
const sent = () => (state.calls ?? []).filter((one) => one.path === "/api/issues/review-uuid/review" && one.method === "POST");

test("record review --head posts core's review with the body its schema names, in the order typed", async () => {
  const run = await review("--base", BASE, "--head", HEAD,
    "--criterion", "2", "--result", "pass", "--reason", "the handler validates its input", "--evidence", "src/a.ts", "--evidence", "src/b.ts",
    "--line", "rest-endpoint:3", "--result", "not_applicable", "--note", "no endpoint changed",
    "--run", "run-7");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent().length, 1, "one call to core's review route");
  assert.deepEqual(sent()[0].sent, {
    base: BASE, head: HEAD,
    checklist: [{ pattern: "rest-endpoint", line: 3, result: "not_applicable", note: "no endpoint changed" }],
    criteria: [{ criterion: 2, result: "pass", reason: "the handler validates its input", evidence: ["src/a.ts", "src/b.ts"] }],
    run: "run-7",
  });
  assert.match(run.stdout, /ISS-40 {2}review rev-1 of a{12}\.\.b{12}: pass/u, run.stdout);
});

test("what the route's schema refuses is refused before any call, naming the flag", async () => {
  const one = ["--criterion", "2", "--result", "pass", "--reason", "r", "--evidence", "src/a.ts"];
  for (const [argv, why] of [
    [["--base", "abc", "--head", HEAD, ...one], /--base takes the whole 40-hex commit/u],
    [["--base", BASE, "--head", HEAD], /at least one --criterion or --line/u],
    [["--base", BASE, "--head", HEAD, "--criterion", "2", "--result", "not_applicable", "--reason", "r", "--evidence", "e"], /criterion 2 takes --result pass\|fail/u],
    [["--base", BASE, "--head", HEAD, "--criterion", "2", "--result", "pass", "--reason", "r"], /criterion 2 cites what it was judged from/u],
    [["--base", BASE, "--head", HEAD, "--line", "Not A Slug:1", "--result", "pass", "--note", "n"], /--line takes <pattern>:<n>/u],
    [["--base", BASE, "--head", HEAD, "--result", "pass", ...one], /--result belongs to the --criterion or --line before it/u],
    [["--base", BASE, "--head", HEAD, ...one.slice(0, 5), "x".repeat(401), ...one.slice(6)], /401 code points and core takes 400/u],
  ]) {
    const run = await review(...argv);
    assert.equal(run.status, 1, `${argv.join(" ")}: ${run.stdout}`);
    assert.match(run.stderr, /^record review on ISS-40: nothing written\./u, run.stderr);
    assert.match(run.stderr, why, run.stderr);
    assert.deepEqual(sent(), [], `${argv.join(" ")}: nothing was sent`);
  }
});

test("core's refusal is printed whole, and without --head the kind is still the thread's record", async () => {
  state.refuse = "REVIEW_BY_BUILDER: the run that built ISS-40 may not review it";
  const run = await review("--base", BASE, "--head", HEAD, "--criterion", "2", "--result", "pass", "--reason", "r", "--evidence", "e");
  state.refuse = null;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^record review on ISS-40: nothing written\.\nCore refused the review of ISS-40:\n.*REVIEW_BY_BUILDER/u, run.stderr);
  const help = await ranAsync(FORGE, ["record", "review", "-h"], ENV, ROOM);
  assert.match(help.stdout, /--reviewer R/u, "the thread's form is still the kind's first row");
  assert.match(help.stdout, /Given --head, it is core's review of the issue instead/u, help.stdout);
});
