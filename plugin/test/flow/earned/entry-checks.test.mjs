/* Six checks the plugin runs in a project whose tooling it has never seen: what the run said of
   itself is on the payload, and nothing here opens a ledger or names a path of this plugin's tree.
   Three were folded into ISS-318 as a sentence and rebuilt here as refusals (ISS-359); the fourth
   asks what a project deploying on its own has on the record to say a deploy ran (ISS-393), and
   the last two ask what an issue of a project keeping a requirements tree owes it (ISS-422). */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("entry-checks").path;
const { parse, render } = await import("../../../src/flow/record.mjs");
const { CHECKS, shapeGaps, viewFrom } = await import("../../../src/flow/earned.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) => ({ createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const mark = (note) => comment(`mark_merged target=base — ${note}`);

const CRITERIA = "1. The first outcome.\n2. The second outcome.";
const ATTACHED = [{ name: "run.txt" }];
const view = (issue, comments = []) => viewFrom("the-uuid", issue, comments);
const missing = (status, one) => CHECKS[status](one, "ISS-3").map((item) => item.what);
const commands = (status, one) => CHECKS[status](one, "ISS-3").map((item) => item.command);

test("a baseline that measured part of the tree earns nothing, and one that names no scope is not refused for it", () => {
  const ran = (scope) => [recorded("baseline", { gate: "npm run check", result: "354 pass", commit: "43b811e", ...scope })];
  assert.deepEqual(missing("in_progress", view({}, ran({}))), [],
    "a record written before the field existed reads back whole");
  assert.deepEqual(missing("in_progress", view({}, ran({ scope: "whole" }))), []);
  const part = CHECKS.in_progress(view({}, ran({ scope: "part" })), "ISS-3");
  assert.equal(part.length, 1);
  assert.match(part[0].what, /measured part of the tree/u);
  assert.match(part[0].what, /npm run check/u, "the refusal names the run, there being no ledger to name");
  assert.match(part[0].command, /--scope whole$/u);
  /* A value that is neither is a gap like any other: `newer` excuses an absence, never a wrong word. */
  assert.deepEqual(shapeGaps("baseline", parse(render("baseline", { gate: "g", result: "r", commit: "43b811e", scope: "half" }))), ["--scope"]);
  /* The other route in: the command a run with no baseline copies carries the field, or is refused. */
  const none = CHECKS.in_progress(view({}, []), "ISS-3");
  assert.match(none[0].command, /--scope whole$/u);
});

test("a screen change owes an attachment on every verdict that is not skipped", () => {
  const plan = (screen) => ({ plan: `Screen change: ${screen}\nSchema coupling: no`, acceptanceCriteria: CRITERIA });
  const judged = (evidence, verdict = "pass") => [1, 2].map((criterion) =>
    recorded("verdict", { criterion: `${criterion}. The outcome.`, verdict, commit: "43b811e", evidence, why: "nothing to look at" }));
  const seen = (issue, comments) => viewFrom("the-uuid", { ...issue, attachments: ATTACHED }, comments);
  assert.deepEqual(missing("tested", seen(plan("no"), judged(["43b811e"]))), [],
    "a plan declaring no screen is judged as it always was");
  const said = CHECKS.tested(seen(plan("yes"), judged(["43b811e"])), "ISS-3");
  assert.equal(said.length, 1, "one item for the set, not one per criterion");
  assert.match(said[0].what, /cites no attachment/u);
  assert.match(said[0].command, /forge attach issue ISS-3/u);
  assert.deepEqual(missing("tested", seen(plan("yes"), judged(["run.txt"]))), [],
    "an attachment this issue carries is the thing a person looked at");
  assert.deepEqual(missing("tested", seen(plan("yes"), judged([], "skipped"))), [],
    "a skipped verdict owes no evidence at all, so it owes no attachment either");
  /* A wrong-test triage drops a criterion; the verdict stays, and cannot be written again. */
  const dropped = { ...plan("yes"), acceptanceCriteria: "2. The second outcome." };
  assert.deepEqual(missing("tested", seen(dropped, judged(["run.txt"]).slice(1)
    .concat(recorded("verdict", { criterion: "1. The dropped outcome.", verdict: "pass", commit: "43b811e", evidence: ["43b811e"] })))), [],
  "the verdict left on a criterion the issue dropped owes no attachment");
});

test("a file the landing wrote and the plan does not name owes a correction", () => {
  const NOTE = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; landing moved nothing";
  const planned = { plan: "It touches plugin/src/flow/earned.mjs and nothing else.", acceptanceCriteria: CRITERIA, mergedAt: at() };
  const wrote = (clause) => [mark(`${NOTE}${clause}`), recorded("review", { reviewer: "codex", commit: "43b811e", outcome: "approved", finding: [] })];
  const owed = (issue, comments) => CHECKS.developed(view(issue, comments), "ISS-3");
  /* The template is where a run learns the clause exists, there being no other place it is typed. */
  assert.match(owed({ acceptanceCriteria: CRITERIA }, [])[0].command, /landing wrote <the paths this change itself landed/u);
  assert.deepEqual(owed(planned, wrote("")).map((one) => one.what), [],
    "a note with no such clause says nothing about what was written");
  assert.deepEqual(owed(planned, wrote("; landing wrote nothing")).map((one) => one.what), []);
  assert.deepEqual(owed(planned, wrote("; landing wrote plugin/src/flow/earned.mjs")).map((one) => one.what), []);
  const grew = owed(planned, wrote("; landing wrote plugin/src/flow/earned.mjs, tools/run.mjs"));
  assert.equal(grew.length, 1);
  assert.match(grew[0].what, /tools\/run\.mjs/u);
  assert.doesNotMatch(grew[0].what, /earned\.mjs/u, "only the paths the plan does not name");
  assert.match(grew[0].command, /^forge record correction ISS-3 --moved/u);
  const corrected = [...wrote("; landing wrote plugin/src/flow/earned.mjs, tools/run.mjs"),
    recorded("correction", { moved: "the change also wrote tools/run.mjs", why: "the ship prints the clause" })];
  assert.deepEqual(owed(planned, corrected).map((one) => one.what), [], "a correction naming it clears it");
  /* A name a longer name contains is not that name, either way round. */
  const near = { ...planned, plan: "It touches src/config.json.template and vendor/src/config.json." };
  assert.match(owed(near, wrote("; landing wrote src/config.json"))[0].what, /src\/config\.json/u);
  assert.deepEqual(owed({ ...near, plan: "It touches src/config.json." },
    wrote("; landing wrote src/config.json")).map((one) => one.what), [], "a sentence ends and the name still stands");
  /* Below `feature` the ladder asks for no plan, and no list is not an empty one. */
  assert.deepEqual(owed({ acceptanceCriteria: CRITERIA, mergedAt: at() },
    wrote("; landing wrote plugin/src/flow/earned.mjs, tools/run.mjs")).map((one) => one.what), [],
  "an issue carrying no plan has no list to be outside of");
});

test("a project that deploys on its own earns released by proving the deploy, not by asserting it", () => {
  const NOTE = "merged to master at 43b811e; reviewed head 43b811e; judged head 43b811e; "
    + "landing moved nothing; landing wrote nothing";
  const policy = (autoProd) => ({ staging: "master", production: "master", autoProd, from: "the config" });
  const verified = (commit, evidence, contains) =>
    [mark(NOTE), recorded("verification", { where: "https://app.example", commit, contains, evidence })];
  const owed = (release, commit, evidence, contains) => CHECKS.released(
    viewFrom("the-uuid", { attachments: ATTACHED, releaseNotes: { section: "Fixed" } }, verified(commit, evidence, contains), null, release),
    "ISS-3",
  );
  const said = (release, commit, evidence, contains) => owed(release, commit, evidence, contains).map((one) => one.what);

  const stale = owed(policy(true), "eee109e", ["https://app.example/build/9"]);
  assert.equal(stale.length, 1);
  assert.match(stale[0].what, /eee109e/u, "the sha the verification carries");
  assert.match(stale[0].what, /43b811e/u, "the sha the mark names");
  assert.match(stale[0].what, /build log and never from the branch head/u);
  assert.match(stale[0].command, /^forge record verification ISS-3 .*--commit <the sha that build reports>/u);
  assert.match(stale[0].what, /where the host built a later head, say that 43b811e is in it/u);
  assert.match(stale[0].command, /--contains 43b811e$/u, "the escape is in the command, not only in the prose");

  /* A host that coalesces landings builds a head this change never was, and that build is running
     it: two facts on the record, so neither has to be typed as the other. */
  assert.deepEqual(said(policy(true), "eee109e", ["https://app.example/build/9"], "43b811e"), [],
    "a later head named as one the landed commit is in");
  assert.equal(owed(policy(true), "eee109e", ["https://app.example/build/9"], "08ca795").length, 1,
    "and a head containing some other commit is the same silence as none");

  assert.deepEqual(said(policy(true), "43b811e", ["https://app.example/build/9"]), [],
    "the landed sha, and a deployment to cite for it");
  assert.deepEqual(said(policy(true), "43b811e", ["run.txt"]), [],
    "an attachment names the deployment as well as a URL does");

  const bare = owed(policy(true), "43b811e", ["43b811e"]);
  assert.equal(bare.length, 1);
  assert.match(bare[0].what, /a sha names no deployment/u);

  assert.deepEqual(said(policy(false), "eee109e", ["43b811e"]), [],
    "a project that does not deploy on its own is unaffected, both clauses of it");
  assert.deepEqual(said(null, "eee109e", ["43b811e"]), [],
    "a project whose config did not answer has decided nothing, and this stays silent");

  /* The gaps come first and alone: a payload with no commit in it has none to compare. */
  const half = CHECKS.released(
    viewFrom("the-uuid", { releaseNotes: { section: "Fixed" } },
      [mark(NOTE), recorded("verification", { where: "https://app.example", evidence: ["43b811e"] })], null, policy(true)),
    "ISS-3",
  );
  assert.equal(half.length, 1);
  assert.match(half[0].what, /is not a whole payload/u);
});

const PLAN = "Screen change: no. Schema coupling: no.\n\nThe plan itself.";

/* AC-14-4-2: the sixth argument is the read, handed over unevaluated, so this check is proved from
   a fixture and `earned.mjs` still reads no checkout. `null` is a project with no tree and owes
   nothing; the empty array is a tree with nothing named, which is the whole of what it fires on. */
const cited = (issue, ids) => viewFrom("the-uuid", issue, [], null, null, () => ids);
const APPROVABLE = { plan: PLAN, acceptanceCriteria: CRITERIA };
const UNREAD = () => assert.fail("the tree was walked by a transition that had no citation to weigh");
const CITES_NOTHING = "no clause of this project's requirements tree is named by the description, the plan or the "
  + "criteria, and a citation is `<id>~<rev>` — FR-04 · UC-04-3 · AC-04-3-1 · NFR-02 · EI-01 · BR-09 · G-01 · M-01 · C-05 · A-02";

test("approved is refused where the project keeps a tree and the issue names no clause of it", () => {
  assert.deepEqual(missing("approved", cited(APPROVABLE, [])), [CITES_NOTHING]);
  assert.match(commands("approved", cited(APPROVABLE, []))[0], /^forge record criteria ISS-3 <criteria\.md>, with a criterion opening/u);
  assert.deepEqual(missing("approved", cited(APPROVABLE, ["UC-14-4"])), [], "one clause named is what it asks for");
  assert.deepEqual(missing("approved", cited(APPROVABLE, null)), [], "and a project with no tree is never asked");
  assert.deepEqual(missing("approved", cited({ description: "Size: fix.", acceptanceCriteria: CRITERIA }, [])),
    [CITES_NOTHING], "the light path drops the plan field and never the clause");
  assert.deepEqual(missing("approved", cited({}, [])).length, 3, "and it is owed beside what was already owed");
});

/* A resume restores the status the park left rather than earning it again, so the entry check does
   not run and the clause was owed at the first entry into `approved` (AC-14-4-2). Pinned here so a
   later reader sees the boundary rather than a route the citation condition was forgotten on. */
test("a park resumed to approved owes what the park owes, and no clause", () => {
  const resumed = targetOf(
    viewFrom("the-uuid", { status: "on_hold" },
      [recorded("park", { kind: "blocked", why: "ISS-33 first", evidence: [] }, "approved")], null, null, UNREAD),
    "ISS-3",
  );
  assert.equal(resumed.next, "approved");
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.missing, [], "an empty clause list refuses nothing on the way back");
});

/* Resolving an issue's clauses walks every document of the tree, and a verb builds the view before it knows which status is next, so only `approved` may spend that: a caller handing over the answer would make a close pay for it and fail where the checkout is unreadable. */
test("no entry check other than approved asks for the issue's clauses", () => {
  for (const status of Object.keys(CHECKS)) {
    if (status === "approved") continue;
    CHECKS[status](viewFrom("the-uuid", APPROVABLE, [], null, null, UNREAD), "ISS-3");
  }
});
