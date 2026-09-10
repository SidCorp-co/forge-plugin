/* The two rungs at the end of a run, each entered on one actor's half: every refusal `judgedOwed`
   makes is asked at `testing` and none of them at `awaiting_release`, and the other way round for
   `deployedOwed`. Composed back into one row, every case below goes red (ISS-1065). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { fakeTracker, ranAsync, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("the-two-rungs").path;
const { CHECKS, ORDER, JUDGED_AT, viewFrom } = await import("../../../src/flow/earned.mjs");
const { CLOSES_FROM } = await import("../../../src/flow/machine.mjs");
const { render } = await import("../../../src/flow/record/page.mjs");
const { statusKind } = await import("../../../src/tracker/rest.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../../../", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
/* Each carries an id, or the delivery credits nothing and the write after it is held again: what a
   session has been shown is keyed by the comment's own id. */
const comment = (body, extra = {}) => ({ documentId: `said-${clock}`, createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const MERGED = "43b811e";
const mark = () => comment(`mark_merged target=master — merged to master at ${MERGED}; `
  + `reviewed head ${MERGED}; judged head ${MERGED}; landing moved nothing; landing wrote nothing`);
const CRITERIA = "1. The first outcome.";
const NO_SCREEN = "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.";
const verdict = (fields = {}) => recorded("verdict",
  { criterion: "1 — The first outcome.", verdict: "pass", commit: MERGED, evidence: [MERGED], ...fields });
const verification = () => recorded("verification",
  { where: "the installed plugin", commit: MERGED, evidence: ["https://ci.example.test/9"] });

const NOTED = { section: "Fixed", userFacing: "it works" };
/* The payloads are made inside, in the order they are read: an argument is evaluated first, so a
   record handed in would carry a stamp older than the ones it is meant to supersede. */
const whole = (issue = {}, made = () => []) => viewFrom(
  "the-uuid",
  { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m", releaseNotes: NOTED, ...issue },
  [mark(), verdict(), verification(), ...made()],
);
const owed = (status, view) => CHECKS[status](view, "ISS-3").map((one) => one.what);

/* The record set both rungs are earned by, so a case removing one payload isolates one refusal. */
test("a record holding both halves earns both rungs, and each rung reads only its own", () => {
  const view = whole();
  assert.deepEqual(owed(JUDGED_AT, view), [], "the verdict is the whole of what the judging rung asks");
  assert.deepEqual(owed(CLOSES_FROM, view), [], "the verification and the note the whole of the other");
  assert.equal(JUDGED_AT, "testing");
  assert.equal(ORDER[ORDER.indexOf(JUDGED_AT) + 1], CLOSES_FROM, "and the deploying rung follows it");
  /* Over a record earning neither, so both lists are long: an item on both is a rung answering for
     an actor it is not waiting for, which is the whole of what the composed row did. */
  const bare = viewFrom("the-uuid", { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m" }, [mark()]);
  const judging = new Set(owed(JUDGED_AT, bare));
  assert.ok(judging.size, "the judging rung asks something of a record earning neither half");
  assert.deepEqual(owed(CLOSES_FROM, bare).filter((one) => judging.has(one)), [],
    "and no item it asks for is asked at the deploying rung too");
});

test("the judging rung keeps every refusal about the verdicts, and asks nothing about the deploy", () => {
  const bare = viewFrom("the-uuid", { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m" }, [mark()]);
  assert.deepEqual(owed(JUDGED_AT, bare), ["criterion 1 has no verdict"]);
  const other = viewFrom("the-uuid", { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m" }, [mark(), verdict()]);
  assert.deepEqual(owed(JUDGED_AT, other), [],
    "an issue with no verification and no note earns the judging rung, neither being the judge's");
  const seen = whole({ plan: "Screen change: yes.\nSchema coupling: no.", attachments: [{ name: "run.txt" }] });
  assert.match(owed(JUDGED_AT, seen).join(" "), /cites no attachment/u,
    "a declared screen change is refused a verdict citing no attachment at this rung");
  const stale = whole({}, () => [verdict({ commit: "eee109e" })]);
  assert.match(owed(JUDGED_AT, stale).join(" "), /judged eee109e, and the merged commit is/u);
});

test("the deploying rung keeps every refusal about the deploy, and asks nothing about the verdicts", () => {
  const unjudged = viewFrom(
    "the-uuid",
    { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m", releaseNotes: NOTED },
    [mark(), verification()],
  );
  assert.deepEqual(owed(CLOSES_FROM, unjudged), [],
    "an issue with no verdict at all earns the deploying rung, the verdicts being the other's");
  const nothing = viewFrom("the-uuid", { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "m" }, [mark(), verdict()]);
  assert.deepEqual(owed(CLOSES_FROM, nothing), [
    "no verification: where the change now runs, at which commit, and the evidence",
    "no release note and no withholding either",
  ], "and both of its own payloads are named, not the first");
  const elsewhere = whole({}, () => [recorded("verification",
    { where: "the installed plugin", commit: "eee109e", evidence: ["https://ci.example.test/9"] })]);
  const deploys = viewFrom("the-uuid", elsewhere.issue, elsewhere.comments, null, { autoProd: true });
  assert.match(owed(CLOSES_FROM, deploys).join(" "), /nothing says the two are the same code/u,
    "a project deploying its own production is refused a verification of another commit here");
  assert.deepEqual(owed(JUDGED_AT, deploys), [],
    "and the judging rung says nothing about which commit the deployment reported");
});

/* The rung report is what says a lighter rung dropped a payload, so both rows have to stay where
   they were: the note's waiver is the deploying rung's and the verdict is waived by nobody. */
test("a fix is waived the note at the deploying rung and is still asked for a verdict at the judging one", () => {
  const fix = whole({ complexity: "s", releaseNotes: undefined });
  assert.deepEqual(owed(CLOSES_FROM, fix), [], "no release note is owed at a fix");
  const unjudged = viewFrom(
    "the-uuid",
    { acceptanceCriteria: CRITERIA, plan: NO_SCREEN, complexity: "s" },
    [mark(), verification()],
  );
  assert.deepEqual(owed(JUDGED_AT, unjudged), ["criterion 1 has no verdict"], "no rung buys a judgement");
});

test("the judging rung is a declared step, so it is neither retired nor written by nobody", () => {
  assert.equal(statusKind(JUDGED_AT).step, true);
  assert.equal(statusKind(JUDGED_AT).replacedBy, undefined, "no rung took it over");
  assert.equal(statusKind(JUDGED_AT).writtenByNobody, undefined, "and a run is what writes it");
});

/* Every surface a run reads before the refusal: one still naming the deploying rung as the rung a
   verdict earns sends a run to write its verdicts against a rung that does not ask for them. */
const tracked = (glob) => execFileSync("git", ["-C", ROOT, "ls-files", glob], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
/* One sentence naming the deploying rung with a verdict and not the judging rung attributes the
   verdict to the rung that does not ask for it; naming both rungs is the boundary itself, which the
   flow part states in one breath on purpose, so the judging rung's presence tells them apart. */
const bothInOneSentence = (text) => String(text).split(/(?<=[.:|])\s|\n\n/u)
  .filter((one) => one.includes("awaiting_release") && /\bverdicts?\b/u.test(one)
    && !one.includes(JUDGED_AT));
const sweep = (glob) => tracked(glob)
  .filter((rel) => bothInOneSentence(readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8")).length);

test("no served guide and no topic names the deploying rung with a verdict and no judging rung", () => {
  assert.deepEqual(sweep("plugin/guides/**/*.md"), []);
  assert.deepEqual(sweep("docs/**/*.md"), []);
  /* Watched failing: the sentence the split retired, read by the same reader. */
  assert.deepEqual(
    bothInOneSentence("A change claiming no behaviour change earns `awaiting_release` by the verdicts."),
    ["A change claiming no behaviour change earns `awaiting_release` by the verdicts."],
    "the reader matches nothing, so the sweep above proves nothing",
  );
});

const SHIPPED = {
  documentId: "two-rungs-uuid",
  issueId: "ISS-96",
  status: "developed",
  title: "the change whose halves are judged apart",
  description: "no mark here",
  acceptanceCriteria: CRITERIA,
  plan: NO_SCREEN,
  complexity: "m",
  mergedAt: "2026-09-03T09:00:00.000Z",
  releaseNotes: NOTED,
};
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  issues: [SHIPPED],
  comments: {
    "two-rungs-uuid": [mark(),
      recorded("review", { reviewer: "codex", commit: MERGED, outcome: "approved", finding: ["F1 accepted"] }),
      verdict(), verification()],
  },
  answer: {},
};
state.answer.forge_config = () => ({ config: state.config });
/* The writes are kept, or the lease this run takes does not read back and no advance is reached. */
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
  if (args.action === "get") return SHIPPED;
  if (args.action === "update" || args.action === "transition") return Object.assign(SHIPPED, args.data);
  return { documentId: args.documentId, ...(args.data ?? {}) };
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
const statusNow = () => SHIPPED.status;
/* One id across the spawns, or each is a session the page has never been shown to and every write
   is held to deliver it again. */
const walking = (...argv) => ranAsync(FORGE, argv, { ...tracker.env, FORGE_SESSION_ID: "the-walk" });

test("the verb walks developed to the judging rung and on to the deploying one, and refuses the jump", async () => {
  const jump = await walking("advance", "ISS-96", "--to", CLOSES_FROM);
  assert.equal(jump.status, 1, jump.stdout);
  assert.match(jump.stdout + jump.stderr,
    new RegExp(`is developed and ${JUDGED_AT} is next, not ${CLOSES_FROM}`, "u"));
  assert.equal(statusNow(), "developed", "and the refused jump moved nothing");
  /* The page this session has not been shown holds the first write to deliver it; the second takes. */
  const shown = await walking("claim", "ISS-96");
  assert.match(shown.stderr, /has not been shown/u, shown.stderr);
  const took = await walking("claim", "ISS-96");
  assert.equal(took.status, 0, took.stderr);
  const first = await walking("advance", "ISS-96");
  assert.equal(first.status, 0, `${first.stdout}${first.stderr}`);
  assert.equal(statusNow(), JUDGED_AT, first.stdout);
  const second = await walking("advance", "ISS-96");
  assert.equal(second.status, 0, `${second.stdout}${second.stderr}`);
  assert.equal(statusNow(), CLOSES_FROM, second.stdout);
  const close = await walking("advance", "ISS-96");
  assert.equal(close.status, 0, `${close.stdout}${close.stderr}`);
  assert.equal(statusNow(), "closed", "the close still follows the deploying half");
});
