/* What a record's field has to say, as against whether it is there. Three fields carried a value the
   next reader could do nothing with — a where naming no place, a decision naming no way back, and a
   failing verdict naming nothing that failed — and each is refused at the write and again on the
   read-back, so a record typed past the verb is measured by the same rule. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("content").path;
const { DECISION_PARTS, commitProblem, decisionProblem, eachProblem, isFullCommit, memberProblem, whereProblem } =
  await import("../../../src/flow/record/content.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { parse, render } = await import("../../../src/flow/record/page.mjs");
const { shapeGaps } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const ISSUE = {
  documentId: "content-uuid",
  issueId: "ISS-95",
  status: "in_progress",
  workState: { step: "plan" },
  title: "the record a reader can act on",
  description: "`forge issue` should take the `data.relations` route.",
  complexity: "s",
};

let clock = 0;
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  unasked: ["forge_config"],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") return ISSUE;
      if (args.action === "update") return Object.assign(ISSUE, args.data);
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = {
          documentId: `c-${(clock += 1)}`,
          createdAt: `2026-09-08T12:${String(clock).padStart(2, "0")}:00.000Z`,
          authorId: "agent",
          body: args.data.body,
        };
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-95"], ENV);

const recorded = (...argv) => ranAsync(FORGE, ["record", ...argv], ENV);
const posted = () => state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create").length;

/* Each casing this tree writes an identifier in, and each way a place is named in a record already
   on the tracker: a rule that read only paths would refuse most of what is there. */
test("a where naming somewhere a reader can open is accepted, in every form the record uses one", () => {
  for (const said of [
    "plugin/src/flow/record/content.mjs",
    "content.mjs:31",
    "the `--set` route of `forge issue`",
    "AC-02-9-13",
    "ISS-701",
    "whereProblem",
    "mark_merged",
    "foldOnto()",
    "docs/cli/record.md and the shape beside it",
    "hop-expected-next-state rev 2",
  ]) {
    assert.equal(whereProblem(said), null, `\`${said}\` names something to open and was refused`);
  }
});

test("a where naming nothing to open is refused, and the refusal says what one takes", () => {
  for (const said of ["in the code", "everywhere", "the tracker", "", "all over the place",
    "a bare sentence that opens nothing"]) {
    const problem = whereProblem(said);
    assert.ok(problem, `\`${said}\` names nothing and was accepted`);
    assert.match(problem, /takes a path or an identifier/u);
    assert.match(problem, /so a reader can go and open it/u, "and why, which is what makes it actionable");
  }
});

test("a decision carrying all three parts is accepted, and the parts are named in order", () => {
  assert.deepEqual(DECISION_PARTS, ["reading", "assumption", "undo"]);
  assert.equal(decisionProblem("the field is the one source | the body's line is prose | revert the ladder's table"), null);
  assert.equal(decisionProblem("a | b | c | and a fourth part the undo runs into"), null,
    "everything past the second bar is the undo, so a way back with a bar in it is still one");
});

/* The part the record exists for: a decision with a reading and an assumption and no way back is a
   note about what somebody thought, and the next run cannot act on it. */
test("a decision with no way back is refused, and told which part is missing", () => {
  for (const said of ["the field is the one source", "the field is the one source | nothing else sets it", "a | b | "]) {
    const problem = decisionProblem(said);
    assert.ok(problem, `\`${said}\` carries no undo and was accepted`);
    assert.match(problem, /three parts on one line/u);
    assert.match(problem, /The undo is the part that says what reverses the decision/u);
  }
});

/* The one call both sides make, so the write and the read-back cannot judge the same value apart. */
test("a repeating field is judged value by value, and the first problem is the answer", () => {
  const field = SHAPES.confirmation.fields.find((one) => one.flag === "where");
  assert.equal(eachProblem(field, ["plugin/src/flow/record/content.mjs", "ISS-701"]), null);
  assert.match(eachProblem(field, ["plugin/src/flow/record/content.mjs", "in the code"]) ?? "", /names nothing to look at/u,
    "one bad value among good ones is the answer, or a record could bury it in a list");
  assert.equal(eachProblem(field, []), null, "and a field nobody repeated has no value to judge");
  assert.equal(eachProblem({ flag: "is" }, ["anything at all"]), null, "a field with no rule of its own judges nothing");
});

/* The sentences are the rules' own, asserted above; what the verb adds is that the refusal comes
   before the write, so nothing went up for a refusal after it to leave behind. */
test("the verb refuses each of the three rules before the write, and writes no record for it", async () => {
  const refused = [
    ["confirmation", "ISS-95", "--where", "in the code", "--is", "a rung", "--finding", "holds"],
    ["decision", "ISS-95", "--decision", "the field is the one source | nothing else sets it"],
    ["verdict", "ISS-95", "--criterion", "1", "--verdict", "fail", "--commit", "c8c3550", "--evidence", "c8c3550"],
  ];
  for (const argv of refused) {
    state.calls = [];
    const run = await recorded(...argv);
    assert.equal(run.status, 1, `${argv[0]}: ${run.stdout}`);
    assert.equal(posted(), 0, `${argv[0]}: nothing went up, since a refusal after the write would leave the record it refused`);
  }
});

/* The read-back side of the same three rules, through the call the entry checks make: a record typed
   at the keyboard or by a client no verb sits before is a payload the shape never refused, so what
   `advance` says is owed has to find the same three things the write did. */
test("the same three rules are owed off a record the verb never wrote", () => {
  const gapsIn = (kind, fields) => shapeGaps(kind, parse(render(kind, fields)));
  const held = { is: "a rung", finding: "holds" };
  assert.deepEqual(gapsIn("confirmation", { ...held, where: ["plugin/src/flow/record/content.mjs"] }), []);
  const where = gapsIn("confirmation", { ...held, where: ["in the code"] });
  assert.equal(where.length, 1, `one gap and no more: ${where.join(" / ")}`);
  assert.match(where[0], /^--where, which takes a path or an identifier/u, "owed by the flag, and told why");

  assert.deepEqual(gapsIn("decision", { decision: ["the field is the one source | the body line is prose | revert the table"] }), []);
  const decision = gapsIn("decision", { decision: ["the field is the one source | nothing else sets it"] });
  assert.equal(decision.length, 1, `one gap and no more: ${decision.join(" / ")}`);
  assert.match(decision[0], /^--decision, which takes/u, "and a decision with no way back is owed the same way");

  const verdict = { criterion: "1 the outcome", verdict: "fail", commit: "c8c3550", evidence: ["c8c3550"] };
  assert.deepEqual(gapsIn("verdict", verdict), ["--why, naming what the criterion did instead: a `fail` is what another run acts on"]);
  assert.deepEqual(gapsIn("verdict", { ...verdict, why: "the screen never rendered" }), []);
});

/* Core reads a wave's member by the issue uuid; the issue key is the same one a person types, so both
   read and nothing around either does (ISS-17). */
test("a --member is read by an issue uuid or its key, and the refusal names both forms", () => {
  assert.equal(memberProblem("4b9c1e2a-7d3f-4a1b-9c6d-0e1f2a3b4c5d"), null, "the uuid core takes");
  assert.equal(memberProblem("ISS-45"), null, "the key hand-typed for the same one");
  for (const junk of ["ISS-45 and the next", "not-a-member", "wave two", ""]) {
    const problem = memberProblem(junk);
    assert.ok(problem, `\`${junk}\` is no member and was accepted`);
    assert.match(problem, /an issue key.*or an issue uuid/u, "and the refusal names both forms it takes");
  }
});

/* A verdict's commit is what core judged, and core refuses an abbreviation of it (VERDICT_COMMIT_NOT_FULL),
   so the plugin takes only a whole sha of either width and tells a shorter one the rule (ISS-20). */
test("a verdict --commit takes a whole sha of either width, and a shorter one is refused naming the rule", () => {
  const forty = "0123456789abcdef0123456789abcdef01234567";
  const sixtyFour = `${forty}${forty}`.slice(0, 64);
  assert.ok(isFullCommit(forty), "a 40-hex git sha-1");
  assert.ok(isFullCommit(sixtyFour), "a 64-hex sha-256");
  for (let width = 7; width < 40; width += 1) {
    assert.equal(isFullCommit(forty.slice(0, width)), false, `a ${width}-hex sha is not whole`);
  }
  const field = SHAPES.verdict.fields.find((one) => one.flag === "commit");
  const refusal = commitProblem(field, forty.slice(0, 12));
  assert.match(refusal, /a full sha/u, "the refusal names the rule");
  assert.match(refusal, /git rev-parse HEAD/u, "and where a whole object id comes from");
});

