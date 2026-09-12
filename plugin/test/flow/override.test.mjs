/* The two recorded overrides, end to end: a field set by hand and a status set by hand. Both exist
   so a run that has to go round the ladder does it in the open, so what is watched here is the reply
   saying no check read it and the correction that says a run set it — and that neither happens
   without a reason, because an override with no reason is indistinguishable from a claim. */
import assert from "node:assert/strict";
import test from "node:test";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, ranAsync, tempHome, tempRoom } from "../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("override").path;
const { UNREAD } = await import("../../src/flow/override.mjs");

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const WHY = "the tracker lost the record and the work is done";

let clock = 0;
const stamped = () => `2026-09-08T11:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const ISSUE = {
  documentId: "override-uuid",
  issueId: "ISS-96",
  status: "in_progress",
  title: "the issue a run had to set by hand",
  description: "`forge issue` should take the `data.relations` route.",
  complexity: "s",
  priority: "medium",
};

const ANNOUNCE = { waiting: "⏸ **Waiting on a human decision**", needs_info: "❓ **Needs info**" };
const state = {
  calls: [],
  config: { baseBranch: "master", productionBranch: "master", pipelineConfig: { autoProdDeploy: false } },
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: [ISSUE], returned: 1, hasMore: false };
      if (args.action === "get") {
        /* The one read the case is about, named by what it meets rather than by its place in the order: a read made
           when a record is already on the page. On the record-first path that is the lease read before the move and
           nothing else — the renewal's own read and its read-back both happen before the record goes up. A `fields`
           read cannot be told apart here: the projection is this CLI's and the request it sends is the whole issue's. */
        if (state.losesLeaseRead && (state.comments[ISSUE.documentId] ?? []).length) {
          return { refused: state.losesLeaseRead };
        }
        return ISSUE;
      }
      if (args.action === "update") {
        /* The tracker's own envelope for a name it has no column for, two reasons in one answer:
           the key, and then the precondition standing beside a payload with nothing left to write. */
        const unknown = Object.keys(args.data ?? {}).find((key) => (state.noColumnFor ?? []).includes(key));
        if (unknown) {
          return { refused: `BAD_REQUEST: Invalid input\nUnrecognized key: "${unknown}"\n`
            + "`expect` is a precondition on a write — send the field(s) to write alongside it" };
        }
        /* Acknowledged and not applied, which is the one answer the read-back below exists for. */
        if (state.ignores && args.data?.[state.ignores] !== undefined) return { ...ISSUE };
        /* And acknowledged, applied in part: one key of a payload the tracker took whole. Nothing documents whether its PATCH is atomic, so the read-back has to answer for a set that came back split. */
        if (state.drops) {
          const kept = Object.entries(args.data ?? {}).filter(([key]) => key !== state.drops);
          return Object.assign(ISSUE, Object.fromEntries(kept));
        }
        return Object.assign(ISSUE, args.data);
      }
      if (args.action === "transition") {
        if (state.refuses) return { refused: state.refuses };
        const said = ANNOUNCE[args.data.status];
        if (said) {
          (state.comments[ISSUE.documentId] ??= []).push({
            documentId: `a-${clock + 1}`,
            createdAt: stamped(),
            authorId: "agent",
            body: `${said} — moved from \`${ISSUE.status}\`\n\n${args.data.reason ?? ""}`,
          });
        }
        ISSUE.status = args.data.status;
        return { ...ISSUE };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        if (state.dropsRecord) return { refused: state.dropsRecord };
        const one = { documentId: `c-${clock + 1}`, createdAt: stamped(), authorId: "agent", body: args.data.body };
        (state.comments[args.data.issue] ??= []).push(one);
        /* Modelled here because two cases below turn on it, and the tracker says nothing when it happens (ISS-429). */
        if (ISSUE.status === "needs_info") ISSUE.status = "open";
        /* A run's own write is where it learns the issue changed hands, which is the window one case is about. */
        if (state.takesLease) {
          ISSUE.sessionContext = { lease: { holder: state.takesLease, agent: "another-agent", pid: "9", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] } };
        }
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const tracker = await fakeTracker(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-96", "--unheld"], tracker.env);
/* The claim above is this suite's lease, restored per case: one of them hands the issue to another run. */
const MINE = structuredClone(ISSUE.sessionContext);

const before = (status = "in_progress") => {
  ISSUE.status = status;
  ISSUE.priority = "medium";
  ISSUE.complexity = "s";
  ISSUE.sessionContext = structuredClone(MINE);
  state.calls = [];
  state.refuses = null;
  state.ignores = null;
  state.drops = null;
  state.dropsRecord = null;
  state.takesLease = null;
  state.losesLeaseRead = null;
  state.noColumnFor = null;
  state.comments[ISSUE.documentId] = [];
};
const setField = (...argv) => ranAsync(FORGE, ["issue", "ISS-96", ...argv], tracker.env);
const setStatus = (...argv) => ranAsync(FORGE, ["advance", "ISS-96", ...argv], tracker.env);
const posted = () => state.calls
  .filter((one) => one.name === "forge_comments" && one.args.action === "create")
  .map((one) => one.args.data.body);
/* By the key it carries, not by the last call of the action: the lease is written through the same
   action, before the field and again for the record after it. */
const sent = (action, key) => state.calls
  .filter((one) => one.args.action === action && (!key || one.args.data?.[key] !== undefined))
  .at(-1)?.args.data;

test("a field set by hand is written, said to be unread, and left with a correction naming the verb", async () => {
  before();
  const run = await setField("--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("update", "priority").priority, "high", "the value reaches the field it named");
  assert.match(run.stdout, /^ISS-96 {2}priority is high$/mu, "and the reply reads back what the tracker holds");
  assert.ok(run.stdout.includes(UNREAD), "with the line that says no entry check read it");
  const [correction] = posted();
  assert.match(correction, /forge-record: correction/u, "the record left behind is a correction");
  assert.match(correction, /priority set to `high` by `forge issue --set`/u, "naming the field, the value and the verb");
  assert.ok(correction.includes(WHY), "and carrying the reason the run typed");
});

/* The defect ISS-930 was filed from: three `--set` pairs, the parser kept the last, and the reply and the correction were both rendered from the survivor under a reason written for three. The correction is the durable trace of the call, so a record naming a subset is the cost that outlives the re-run. */
test("every field of one call is written, and one correction names all of them", async () => {
  before();
  const run = await setField("--set", "complexity=m", "--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const update = sent("update", "complexity");
  assert.equal(update.complexity, "m", "the field the old parse dropped reaches the tracker");
  assert.equal(update.priority, "high", "beside the one it kept");
  assert.match(run.stdout, /^ISS-96 {2}complexity is m$/mu, "a reply line per field");
  assert.match(run.stdout, /^ISS-96 {2}priority is high$/mu);
  assert.equal(posted().length, 1, "one record for the call, not one per field");
  const [correction] = posted();
  assert.match(correction, /moved: complexity set to `m`, priority set to `high` by `forge issue --set`/u,
    "naming every field that moved, each beside the value it moved to");
  assert.ok(correction.includes(WHY), "under the one reason the caller typed for all of them");
});

test("the fields of one call go up in one update, so none of them can land without the rest", async () => {
  before();
  const run = await setField("--set", "complexity=m", "--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 0, run.stderr);
  const updates = state.calls.filter((one) =>
    one.name === "forge_issues" && one.args.action === "update" && one.args.data?.sessionContext === undefined);
  assert.equal(updates.length, 1, `one request carries every field: ${JSON.stringify(updates.map((one) => one.args.data))}`);
});

/* One question asked twice, so the caller is shown both values rather than told which one won. */
test("a field named twice in one call is refused with both values, and nothing is sent", async () => {
  before();
  const run = await setField("--set", "priority=high", "--set", "priority=low", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--set names priority 2 times, as `high` and `low`/u, run.stderr);
  assert.match(run.stderr, /--set priority=<value>/u, "and the form that asks for the one they meant");
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.equal(state.calls.some((one) => one.args.action === "update"), false);
  assert.deepEqual(posted(), [], "and no correction for a call that moved nothing");
});

/* The tracker moves a status on its own route and answers one sent to `update` with a raw
   BAD_REQUEST naming no way on (ISS-931 for every other such name). Refused here rather than there
   because the fields of one call go up together: the status would cost every field beside it. */
test("a --set naming status is refused with the verb that moves one, before anything is sent", async () => {
  before();
  const run = await setField("--set", "status=open", "--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /status is not a field an update writes/u, run.stderr);
  assert.match(run.stderr, /forge advance ISS-96 --set open --why <w>/u,
    "the route out carries the value the caller gave, so the line can be typed as printed");
  assert.match(run.stderr, /nothing of this one\s+was sent/u);
  assert.equal(state.calls.length, 0, "no request at all, not merely no update");
  assert.equal(ISSUE.priority, "medium", "and the field beside it is untouched");
});

/* Where the read-back says one field moved and another did not, the one that moved is owed its reason before the refusal exits: the alternative is a value in the tracker with nothing on the page saying who set it. */
test("a field that landed beside one that did not still gets its correction, and the call still fails", async () => {
  before();
  state.drops = "priority";
  const run = await setField("--set", "complexity=m", "--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /priority did not read back as written/u, run.stderr);
  assert.match(run.stderr, /complexity did read back as written and stands/u,
    "the refusal says which half of the call is now true of the issue");
  assert.equal(posted().length, 1, "one correction, for the call rather than for the field");
  const [correction] = posted();
  assert.match(correction, /moved: complexity set to `m` by `forge issue --set`/u,
    "naming the field that moved and no other");
  assert.doesNotMatch(correction, /priority/u, "the field that did not move is claimed nowhere");
  assert.ok(correction.includes(WHY), "under the reason the caller gave for the call");
});

/* The reason is the whole difference between an override and a lie about what the record earned, so
   it is asked for before anything is sent rather than after the field has moved. */
test("an override with no reason is refused, and nothing at all is sent", async () => {
  before();
  const run = await setField("--set", "priority=high");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /issue --set needs --why/u);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.equal(state.calls.some((one) => one.args.action === "update"), false);
  assert.deepEqual(posted(), [], "and no correction for a write that did not happen");
});

/* The correction is what makes an override an override, and on this one status the tracker reads it
   as the reporter's answer: written, it would move the status with nothing on the record saying a run
   did. So the field write is refused rather than followed by a move nobody asked for. */
test("a field override is refused where the correction would be read as an answer", async () => {
  before("needs_info");
  const run = await setField("--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /waits for an answer/u);
  assert.match(run.stderr, /forge advance ISS-96 --set <status> --why <w>/u, "and the route is the move made in the open");
  assert.equal(state.calls.some((one) => one.args.data?.priority !== undefined), false, "the field never moved");
  assert.deepEqual(posted(), [], "and no correction, which is what would have answered the question");
  assert.equal(ISSUE.status, "needs_info", "so the issue still waits for the person it waits on");
});

test("a field a record writes is refused by name, the override being no route round a payload", async () => {
  before();
  const run = await setField("--set", "plan=Screen change: no", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /plan is written by a record and not by an override/u);
  assert.match(run.stderr, /forge record -h/u, "and the route on is the verb that owns the field");
  assert.equal(state.calls.some((one) => one.args.action === "update"), false);
});

/* The write a triage pass owes on the one verdict that ends nothing. Two runs on one instruction and one head split on whether to claim for it:
   the rule sat in a reference about dispositions, while this surface, which both of them did reach, said only that a lease was owed (ISS-840). */
test("a holding verdict's complexity write with no lease is refused with the short lease and what the record owes", async () => {
  before();
  ISSUE.sessionContext = null;
  const run = await setField(
    "--set", "complexity=s",
    "--why", "holds — read the two guides and the refusal it would change; nothing was worked",
  );
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries no lease/u, "the write is still the holder's, which this change does not move");
  assert.match(run.stderr, /--minutes 10/u, "and the lease the reading is owed is named as a short one");
  assert.match(run.stderr, /nothing was worked under this lease/u, "with the line the record owes beside it");
  assert.equal(state.calls.some((one) => one.args.data?.complexity !== undefined), false, "and the field never moved");
});

/* The override writes fields the writer keeps no row for, and the read-back's own sentence is built
   off that row: the one it does not have reached the mismatch as a crash rather than as the refusal
   a run can act on. */
test("a field with no row of its own still gets the read-back refusal, not a crash", async () => {
  before();
  state.ignores = "priority";
  const run = await setField("--set", "priority=high", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /The update answered success but priority did not read back as written/u);
  assert.doesNotMatch(run.stderr, /TypeError|Cannot read properties/u, "and the run is told what happened rather than where it broke");
  assert.deepEqual(posted(), [], "no correction for a write the tracker did not keep");
});

test("a pair the verb cannot read is refused with the form it takes", async () => {
  before();
  for (const given of ["priority", "priority="]) {
    const run = await setField("--set", given, "--why", WHY);
    assert.equal(run.status, 1, `\`${given}\` was taken for a pair: ${run.stdout}`);
    assert.match(run.stderr, /--set/u);
  }
  assert.equal(state.calls.some((one) => one.args.action === "update"), false);
});

test("a status set by hand carries the reason the tracker demands, and says no check read it", async () => {
  before("awaiting_release");
  const run = await setStatus("--set", "on_hold", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ISS-96 {2}awaiting_release -> on_hold {2}\(set, unearned\)$/mu,
    "the move says it was set rather than earned, on the line a reader skims");
  assert.ok(run.stdout.includes(UNREAD));
  assert.equal(sent("transition").reason, WHY, "the reason travels with the move, which a side status refuses without");
  const [correction] = posted();
  assert.match(correction, /the status set to `on_hold` by `forge advance --set`, from `awaiting_release`/u,
    "and the correction says where it came from, which the status field no longer holds");
});

test("a status that waits on a person carries the kind the tracker demands of one", async () => {
  before("awaiting_release");
  const run = await setStatus("--set", "waiting", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("transition").waitingKind, "needs_decision",
    "set by hand or parked, a waiting status is the same payload to the tracker");
});

/* The order this one is written in is not a preference: the tracker reads any comment on a
   `needs_info` issue as the reporter's answer and puts the issue back, so a correction written
   after the move would be read as that answer and undo it. */
test("into needs_info the correction goes first, so the move cannot be undone by it", async () => {
  before("confirmed");
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  const moved = state.calls.findIndex((one) => one.args.action === "transition");
  assert.ok(wrote >= 0 && moved >= 0, `wrote ${wrote}, moved ${moved}`);
  assert.ok(wrote < moved, "the record is written against the status it left, and the move follows it");
  const renewals = state.calls.filter((one) => one.args.action === "update" && one.args.data?.sessionContext !== undefined);
  assert.equal(renewals.length, 1, "one renewal for the pair, spent by the record that went first");
});

/* The issue can change hands between the record and the move, and the move must not be the write
   that learns it: the lease is read, not renewed a second time, because a renewal's own refusal
   exits the process and would leave the correction claiming a status nothing was asked to set,
   with only a lease sentence to read it by. */
test("a lease taken under the correction stops the move, and the message names what the record claims", async () => {
  before("confirmed");
  state.takesLease = "another-run";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the record for needs_info went up and the move was not attempted/u,
    "the record above is the subject, not the lease");
  assert.match(run.stderr, /changed hands between the two writes/u, "and why nothing here may set the status");
  assert.match(run.stderr, /forge record correction ISS-96 --moved/u, "with the way to say the record above is wrong");
  assert.match(run.stderr, /forge claim ISS-96 --take/u, "and the way to take the issue back and finish it");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false,
    "no move was sent under another run's lease");
  assert.equal(posted().length, 1, "and the correction that did go up is the one the message is about");
});

/* The same read can fail rather than answer, and it is asked softly for that: a read that exited
   here would report a transport and never the record standing above it. Not knowing is not a
   handoff, so it is said as not knowing, and the move to make is the one the run already typed. */
test("a lease the transport would not read stops the move, and is reported as not knowing", async () => {
  before("confirmed");
  state.losesLeaseRead = "Forge answered 503";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the record for needs_info went up and the move was not attempted/u);
  assert.match(run.stderr, /could not be read, so nothing was sent to the status/u,
    "not knowing is said as not knowing, and never as a handoff");
  assert.match(run.stderr, /forge advance ISS-96 --set needs_info --why/u, "with the move to make once it answers");
  assert.match(run.stderr, /forge record correction ISS-96 --moved/u, "and the way to say the record above is wrong");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false, "and nothing was sent to the status");
});

/* The cost of writing the record first, on the one route that has to: the record stands and the
   status did not move, and only this message says so. The park spends the same route into the same
   status, so a park refused after its record reports it too. */
test("a move refused after the record went up is reported as the pair it left", async () => {
  before("confirmed");
  state.refuses = "a status change needs a reason";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is still confirmed: the record for needs_info went up and the move was refused/u);
  assert.match(run.stderr, /a status change needs a reason/u, "carrying what the tracker said, which is what to act on");
  assert.match(run.stderr, /forge record correction ISS-96 --moved/u, "and the way to say the record above is wrong");
  assert.equal(posted().length, 1, "the correction that did go up is the thing the message is about");
});

/* A dropped write is not a rejected one, and the transport says which it was. Told the issue is
   still where it was, a run would correct a move that may have landed. */
test("a move that neither landed nor failed sends the run to read the status first", async () => {
  before("confirmed");
  state.refuses = "Forge did not answer POST /api/issues/x/transition: socket hang up\n"
    + "This call may have been processed and is not sent again: idempotence is documented for the "
    + "merged mark alone, so a repeat could write twice. Read the record first.";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /neither landed nor failed cleanly/u);
  assert.match(run.stderr, /forge issue ISS-96 --fields status/u, "the read that settles it comes first");
  assert.doesNotMatch(run.stderr, /is still confirmed/u, "and nothing asserts a status nobody read back");
});

/* The record goes first here, so its own failure means nothing happened at all — and the body this
   route offers to post by hand would claim a move that was never attempted. */
test("a record refused before the move says nothing was sent, and offers no body to post", async () => {
  before("confirmed");
  state.dropsRecord = "the comment route is not available";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /nothing was sent to ISS-96/u);
  assert.match(run.stderr, /Run the same override again\./u);
  assert.doesNotMatch(run.stderr, /FORGE_CORRECTION/u, "no body to post: there is no change for one to describe");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false, "and the move was never attempted");
});

/* The same reading on the record's own write: a comment whose response dropped may be on the page,
   and a run told it is not there posts the claim a second time. */
test("a record whose write neither landed nor failed sends the run to the page", async () => {
  before("confirmed");
  state.dropsRecord = "Forge did not answer POST /api/issues/x/comments: socket hang up\n"
    + "This call may have been processed and is not sent again: idempotence is documented for the "
    + "merged mark alone, so a repeat could write twice. Read the record first.";
  const run = await setStatus("--set", "needs_info", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /may or may not have gone up/u);
  assert.match(run.stderr, /forge resume ISS-96 --report/u, "the page is the read that settles it");
  assert.doesNotMatch(run.stderr, /Run the same override again/u, "and a second override is what would duplicate it");
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false);
});

test("a status the route table does not declare is refused with the set, and nothing is sent", async () => {
  before();
  const run = await setStatus("--set", "finished", "--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /No status named finished/u);
  assert.match(run.stderr, /That set is what the route table declares this tracker takes\. Nothing was sent\./u);
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false);
});

test("--set is refused beside the flags that say where a move goes, and without a reason", async () => {
  before();
  const both = await setStatus("--set", "on_hold", "--park", "screen-review", "--why", WHY);
  assert.equal(both.status, 1, both.stdout);
  assert.match(both.stderr, /--set names the status outright; a park goes where its kind says\./u);
  const bare = await setStatus("--set", "on_hold");
  assert.equal(bare.status, 1, bare.stdout);
  assert.match(bare.stderr, /--set needs --why/u);
  const asked = await setStatus("--set", "on_hold", "--why", WHY, "--owed");
  assert.equal(asked.status, 1, asked.stdout);
  assert.match(asked.stderr, /--owed moves nothing/u);
  assert.equal(state.calls.some((one) => one.args.action === "transition"), false);
});

test("a reason handed to a read is refused, there being nothing for it to be the reason for", async () => {
  before();
  const run = await setField("--why", WHY);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--why belongs to --set; a read takes no reason\./u);
});

/* ISS-1158. The run that reached for `@file` stored the path and lost a 10,233-character body, the
   tracker keeping no revision of a field — which is why the refusal comes before the write. */
const BODY_FILE = join(tempRoom("set-body-"), "body.md");
writeFileSync(BODY_FILE, "# a replacement body\n\nthe text a run meant to store\n");
const updates = () => state.calls.filter((one) => one.args.action === "update" && one.args.data?.description !== undefined);

test("a description set to a file route is refused, and the route out sends the file's own text", async () => {
  before();
  const run = await setField("--set", `description=@${BODY_FILE}`, "--why", WHY);
  assert.equal(run.status, 1);
  assert.match(run.stderr, new RegExp(`reads as the file \`${BODY_FILE}\``, "u"), "the route it read, named");
  assert.ok(run.stderr.includes(`--set description="$(cat -- ${BODY_FILE})"`),
    "and the call that sends the file's own text as the description");
  assert.deepEqual(updates(), [], "nothing was sent, so the body on the page is the body that was there");
});

/* The existing file is the same mistake with better evidence, not the mistake itself: a mistyped
   path is the route the flag has not got either, and it lands as text just as surely. */
test("a description set to a file route that names nothing is refused too", async () => {
  before();
  const run = await setField("--set", "description=@/tmp/no-such-body-file.md", "--why", WHY);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /reads as the file/u);
  assert.deepEqual(updates(), []);
});

test("a description that carries a newline is written, so a body beginning with @ still has a route", async () => {
  before();
  const body = "@the-handle this body opens with\nand carries a second line";
  const run = await setField("--set", `description=${body}`, "--why", WHY);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("update", "description").description, body, "the text itself, as it was typed");
});

/* The newline is the escape, so it is read off the value as typed: trimming first took the only
   newline off `@handle\n` and refused the very body the escape exists for (review 8b3a01 F1). */
test("the newline that opens the escape is read where the caller put it", async () => {
  for (const body of ["@the-handle\n", "\n@the-handle"]) {
    before();
    const run = await setField("--set", `description=${body}`, "--why", WHY);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.equal(sent("update", "description").description, body, `written as typed: ${JSON.stringify(body)}`);
  }
});

/* The route out is a line a caller runs next, and an unquoted substitution over a name with a space
   in it is several arguments — `cat` would concatenate whatever they name and the body would be
   lost to the very fix that refused it (review 8b3a01 F2). */
test("the route out quotes the path it names", async () => {
  before();
  const spaced = join(tempRoom("set-spaced-"), "a body.md");
  writeFileSync(spaced, "the body a space in the path would have split\n");
  const run = await setField("--set", `description=@${spaced}`, "--why", WHY);
  assert.equal(run.status, 1);
  assert.ok(run.stderr.includes(`--set description="$(cat -- '${spaced}')"`),
    `the path quoted whole, and \`cat --\` so a leading hyphen stays a name: ${run.stderr}`);
});

test("a field that holds no body is untouched by the rule", async () => {
  for (const [field, value] of [["priority", "@high"], ["category", "@x"]]) {
    before();
    const run = await setField("--set", `${field}=${value}`, "--why", WHY);
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.equal(sent("update", field)[field], value,
      `a route is only a route where a body is what it would replace: ${field}`);
  }
});

/* ISS-931. The arm ISS-930 left: the tracker's whole envelope, two reasons and no route out, and
   what was wrong with all four of them was that the reply was nobody's. */
test("a field the tracker has no column for is refused in one sentence of this CLI's own", async () => {
  before();
  state.noColumnFor = ["notAColumn"];
  const run = await setField("--set", "notAColumn=x", "--why", WHY);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /notAColumn is not a field the tracker's update route takes/u,
    "the name that was refused, in a sentence naming it");
  assert.match(run.stderr, /nothing of it was written/u, "and what became of the call");
  assert.doesNotMatch(run.stderr, /Unrecognized key|BAD_REQUEST|precondition/u,
    "with none of the tracker's own wording, which answered three questions about a payload this CLI built");
  assert.doesNotMatch(run.stderr, /a name among them is one this flag writes/u,
    "and no promise that every field the issue carries is one this flag writes: status and plan are not (review 8b3a01 F3)");
});

/* The soft send is the override arm's alone: every other caller keeps the far end's own words. */
test("a caller that is not the override arm keeps the tracker's own refusal", async () => {
  before();
  state.noColumnFor = ["sessionContext"];
  const run = await ranAsync(FORGE, ["claim", "ISS-96", "--next", "on to the next step"], tracker.env);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Unrecognized key: "sessionContext"/u,
    "the tracker's own answer, unchanged for every caller but the one this rule is about");
});
