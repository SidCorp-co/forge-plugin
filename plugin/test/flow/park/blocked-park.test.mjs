/* A `blocked` park with no edge to read held nothing: the resume owed only the edges still holding,
   an empty list read as earned, and the write after the park told whoever read it next that the
   record earned the way back (ISS-2675). Where an edge speaks for the blocker it still does; where
   none does, a person's answer is what clears it, and the landing's own conflict park is answered
   by the head the landing asked for. */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("blocked-park").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { targetOf } = await import("../../../src/flow/route.mjs");
const { CONFLICT_MARK } = await import("../../../src/flow/landing/conflict-park.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-09-27T04:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
const comment = (body, extra = {}) =>
  ({ documentId: `comment-${clock + 1}`, createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));
const parkedOn = (why = "waits on forge-dev ISS-1251, which no edge can name", evidence = []) =>
  recorded("park", { kind: "blocked", why, evidence }, "confirmed");

const HEAD = "9e24c2af0000000000000000000000000000abcd";
const PIN = "c4890050000000000000000000000000000dcba";
const OTHER = "1234567000000000000000000000000000000fed";
const conflictWhy = `iss-420 does not merge onto master at ${PIN.slice(0, 7)}: plugin/src/one.mjs conflict. ${CONFLICT_MARK}`;

const held = (issue, comments, extra = {}) => ({
  ...targetOf({ ...viewFrom("the-uuid", { status: "on_hold", ...issue }, comments), ...extra }, "ISS-420"),
});
const gating = (otherStatus) => ({ otherDisplayId: "ISS-9", otherStatus, kind: "blocks", gatesDispatch: true });
const mention = { otherDisplayId: "ISS-18", otherStatus: "open", kind: "relates", gatesDispatch: false };

/* The three ways an edge can be missing all reach the resume as the same state, an issue whose
   `blockedBy` carries nothing that gates dispatch; each is named so a fixture stands for each. */
const NO_EDGE = {
  "a blocker in another project, which the tracker cannot edge": { relations: { blockedBy: [] } },
  "a same-project blocker whose edge was never recorded": {},
  "an edge that held the issue and was then removed": { relations: { blockedBy: [], blocks: [] } },
};

test("an edgeless blocked park is not resumed, and owes the answer as the one command that clears it", () => {
  for (const [name, issue] of Object.entries(NO_EDGE)) {
    const { next, missing, resumed } = held(issue, [parkedOn()]);
    assert.equal(next, "confirmed", name);
    assert.equal(resumed, true, name);
    assert.equal(missing.length, 1, `${name}: nothing earned the resume`);
    assert.match(missing[0].command, /^forge record answer ISS-420 --from "<who answered>" --quoted "<their words>"$/u, name);
    assert.match(missing[0].what, /no edge that gates dispatch blocks this issue/u, name);
  }
});

test("a park whose only entry is a mention reads as one with no edge at all", () => {
  const { missing } = held({ relations: { blockedBy: [mention] } }, [parkedOn()]);
  assert.equal(missing.length, 1);
  assert.match(missing[0].command, /^forge record answer ISS-420 /u);
  assert.doesNotMatch(missing[0].what, /ISS-18/u, "the mention is no blocker it names");
});

test("an edgeless blocked park is resumed by another author's comment, as every other kind is", () => {
  const after = (make) => {
    const park = parkedOn();
    return held({}, [park, make()]).missing;
  };
  assert.deepEqual(after(() => comment("forge-dev ISS-1251 shipped this morning", { authorId: "the-owner" })), []);
  assert.equal(after(() => comment("still waiting", { authorId: "agent" })).length, 1,
    "the parker's own comment answers nothing");
  assert.deepEqual(after(() => recorded("answer", { from: "the owner", quoted: "1251 is out" })), [],
    "and an answer relayed on the record does");
  const early = comment("an older word", { authorId: "the-owner" });
  assert.equal(held({}, [early, parkedOn()]).missing.length, 1, "a comment older than the park answers another one");
});

test("a blocked park with gating edges resumes on the edges alone, and owes the one still holding", () => {
  const cleared = held({ relations: { blockedBy: [gating("closed"), gating("developed")] } }, [parkedOn()]);
  assert.deepEqual(cleared.missing, [], "every edge cleared, so nothing else is asked for");
  const holding = held({ relations: { blockedBy: [gating("open")] } }, [parkedOn()]);
  assert.equal(holding.missing.length, 1);
  assert.match(holding.missing[0].what, /^ISS-9 gates this by a blocks edge and is open/u);
  assert.equal(holding.missing[0].command, "forge advance ISS-9");
});

const landing = (head) => ({ sessionContext: { landing: { state: "head-owed", head, branch: "iss-420" } } });

/* That park hands the work back to the builder, whose own step out of it is the route the landing
   names (ISS-2449): no person is asked, and no answer would be read. */
test("the landing's own conflict park standing over its head is taken up by the builder's step", () => {
  const { next, missing } = held(landing(HEAD), [parkedOn(conflictWhy, [HEAD, PIN])]);
  assert.equal(next, "confirmed");
  assert.deepEqual(missing, []);
});

test("the lift the capture already proved its own resumes the conflict park, and nothing else does", () => {
  const park = parkedOn(conflictWhy, [HEAD, PIN]);
  const moved = landing(OTHER);
  assert.deepEqual(held(moved, [park], { lifts: park.documentId }).missing, [], "the capture's own lift");
  assert.equal(held(moved, [park], { lifts: "comment-elsewhere" }).missing.length, 1,
    "a lift naming another park lifts nothing");
  const copied = parkedOn(conflictWhy, [OTHER, PIN]);
  const said = held(landing(HEAD), [copied]).missing;
  assert.match(said[0].command, /^forge record answer ISS-420 /u,
    "the phrase over a head the checkpoint never named is a person's park, and owes their answer");
});

/* End to end, on the tracker's own answers: the write after the park, the answer that lifts it, and
   the answers nothing would read. */
const PARKED = {
  documentId: "parked-uuid",
  issueId: "ISS-420",
  status: "on_hold",
  title: "the work that waits on another project",
  description: "no mark here",
};
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [PARKED],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) {
        found.status = args.data.status;
        return { ...found };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = comment(args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, ""));
        (state.comments[args.data.issue] ??= []).push(one);
        return { documentId: one.documentId };
      }
      const page = state.comments[args.filters?.issue] ?? [];
      return { comments: page, returned: page.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-420", "--unheld"], ENV);

/* The lease the claim above wrote stays: only the landing a case names is laid beside it. */
const parkedWith = (park, { relations, sessionContext } = {}) => {
  const kept = { ...PARKED.sessionContext };
  delete kept.landing;
  Object.assign(PARKED, { status: "on_hold", relations, sessionContext: { ...kept, ...sessionContext } });
  state.comments["parked-uuid"] = [park];
};
const posted = () => state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create").length;
const answering = () => ranAsync(FORGE, ["record", "answer", "ISS-420", "--from", "the owner, in this session",
  "--quoted", "forge-dev ISS-1251 shipped"], ENV);

test("the write after an edgeless blocked park never says the record earns the resume", async () => {
  parkedWith(parkedOn());
  const run = await ranAsync(FORGE, ["record", "routed", "ISS-420", "--none", "met nothing beside the park"], ENV);
  const said = `${run.stdout}${run.stderr}`;
  assert.equal(run.status, 0, said);
  assert.doesNotMatch(said, /the record earns it/u, said);
  assert.match(said, /forge record answer ISS-420 /u, `and names what does clear it:\n${said}`);
  assert.equal(PARKED.status, "on_hold", "nothing moved it");
});

test("an answer on an edgeless blocked park is taken, and resumes the issue where the park left it", async () => {
  parkedWith(parkedOn());
  const run = await answering();
  const said = `${run.stdout}${run.stderr}`;
  assert.equal(run.status, 0, said);
  assert.match(run.stderr, /^ISS-420 {2}on_hold -> confirmed {2}\(resumed where its park left it\)$/mu, said);
  assert.equal(PARKED.status, "confirmed");
});

test("an answer is refused with nothing sent where the on_hold park is anything but an edgeless blocked one", async () => {
  const cases = {
    "a park a person lifts by a set": [recorded("park", { kind: "paused", why: "w", evidence: [] }, "confirmed"), {}],
    "a blocked park with a gating edge": [parkedOn(), { relations: { blockedBy: [gating("open")] } }],
    "the landing's own conflict park over the checkpoint's head":
      [parkedOn(conflictWhy, [HEAD, PIN]), landing(HEAD)],
  };
  for (const [name, [park, issue]] of Object.entries(cases)) {
    parkedWith(park, issue);
    const before = posted();
    const run = await answering();
    assert.notEqual(run.status, 0, `${name}: ${run.stdout}`);
    assert.match(run.stderr, /record answer: ISS-420 is on_hold, and an answer is read only where/u, `${name}: ${run.stderr}`);
    assert.equal(posted(), before, `${name}: nothing was sent`);
    assert.equal(PARKED.status, "on_hold", name);
  }
});
