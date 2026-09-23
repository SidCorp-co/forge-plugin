/* A park is two writes — the status and the record — and for three runs it was only ever one:
   the record went up, the tracker refused the move for a reason the flag had already collected, and
   the issue read parked to whoever read the record and unparked to everything else (ISS-157). */
import assert from "node:assert/strict";
import test from "node:test";

import { ranAsync, tempHome } from "../../fixtures.mjs";
import { trackerFor } from "../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("park").path;
const { render } = await import("../../../src/flow/record/page.mjs");
const { PARKS } = await import("../../../src/flow/machine.mjs");
const { PARK_STATUS, answered, viewFrom } = await import("../../../src/flow/earned.mjs");

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

let clock = 0;
const at = () => `2026-09-02T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;
/* An id, because a comment with none can be credited as read by nothing and the write after it is
   refused for ever: the shown ledger is keyed on the id the tracker gives each row. */
const comment = (body, extra = {}) =>
  ({ documentId: `comment-${clock + 1}`, createdAt: at(), authorId: "agent", body, ...extra });
const recorded = (kind, fields, status = null) => comment(render(kind, fields, status));

/* Neither issue carries a comment: a page with one on it spends the first write on the hold that
   makes a session read what it has not been shown. */
const PARKING = {
  documentId: "parking-uuid",
  issueId: "ISS-97",
  status: "awaiting_release",
  title: "the change a person may have to look at",
  description: "no mark here",
  plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
  acceptanceCriteria: "1. The first outcome.",
  releaseNotes: { section: "Fixed", userFacing: "it works" },
};
const MOVING = {
  documentId: "moving-uuid",
  issueId: "ISS-98",
  status: "confirmed",
  title: "the fix that walks the flow",
  description: "`forge issue` should take the `data.relations` route.\n",
  /* A fix is waived the reading and the plan on the way into `approved` and never the criteria or the clause one of them cites, so the one step this file takes along the flow needs both on the record to be a step. */
  acceptanceCriteria: "1. BR-09~1: the one outcome.",
  complexity: "s",
};
/* The tracker as it really answers, because the pairing this file is about is a sequence and a
   fixture that acknowledges a move without making one cannot produce the sequence: an update is
   kept, a move is kept, and a move into a side status it announces posts the comment it announces
   it with. `state.refuse` puts the tracker's own refusal of a move back in the way. */
const ANNOUNCE = { waiting: "⏸ **Waiting on a human decision**", needs_info: "❓ **Needs info**" };
const state = {
  calls: [],
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [PARKING, MOVING],
  comments: {},
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (state.refuse?.[args.action]) return { refused: state.refuse[args.action] };
      if (args.action === "list") {
        const wanted = String(args.filters?.search ?? "").toLowerCase();
        const rows = state.issues.filter((one) => !wanted || JSON.stringify(one).toLowerCase().includes(wanted));
        return { issues: rows, returned: rows.length, hasMore: false };
      }
      const found = state.issues.find((one) => one.documentId === args.documentId);
      if (args.action === "get") return found ?? {};
      if (args.action === "update" && found) return Object.assign(found, args.data);
      if (args.action === "transition" && found) {
        /* The tracker this defect was met on answers a `waiting` ask with `needs_info` and says so
           nowhere a caller can read first, which is the whole of ISS-1633. */
        const landed = state.remap?.[args.data.status] ?? args.data.status;
        const said = ANNOUNCE[landed];
        if (said) {
          (state.comments[found.documentId] ??= []).push(
            comment(`${said} — moved from \`${found.status}\`\n\n${args.data.reason ?? ""}`));
        }
        found.status = landed;
        return { ...found };
      }
      return { documentId: args.documentId, ...(args.data ?? {}) };
    },
    forge_comments: (args) => {
      if (args.action !== "list") {
        const one = comment(args.data.body.replace(/^⟦[^⟧]*⟧\n|\n⟦[^⟧]*⟧$/gu, ""));
        (state.comments[args.data.issue] ??= []).push(one);
        const on = state.issues.find((issue) => issue.documentId === args.data.issue);
        /* The tracker reads a comment on a `needs_info` issue as the answer, and says nothing. */
        if (on?.status === "needs_info") on.status = "open";
        return { documentId: one.documentId };
      }
      const held = state.comments[args.filters?.issue] ?? [];
      return { comments: held, returned: held.length, hasMore: false };
    },
  },
};
const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());
await ranAsync(FORGE, ["claim", "ISS-97", "--unheld"], ENV);
await ranAsync(FORGE, ["claim", "ISS-98", "--unheld"], ENV);

const parked = (reference, kind = "screen-review") =>
  ranAsync(FORGE, ["advance", reference, "--park", kind, "--why",
    "the new column has to be looked at", "--evidence", "c8c3550"], ENV);
const sent = (action) => state.calls.filter((one) => one.args.action === action).at(-1)?.args.data;
const filed = () => state.calls.filter((one) => one.name === "forge_comments" && one.args.action === "create").length;

test("a park sends the reason it was typed and the kind the tracker takes, in one call", async () => {
  const run = await parked("ISS-97");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ISS-97 {2}awaiting_release -> waiting$/mu, "the status moves");
  const moved = sent("transition");
  assert.equal(moved.status, "waiting");
  assert.equal(moved.reason, "the new column has to be looked at", "the sentence is typed once");
  assert.equal(moved.waitingKind, "needs_decision", "and the kind is derived from the park kind");
});

test("a park whose move the tracker refuses leaves no park record behind, where the kind lands in on_hold", async () => {
  state.refuse = { transition: "TRANSITION_REASON_REQUIRED: a transition to `on_hold` must carry a reason" };
  const before = filed();
  const run = await parked("ISS-97", "blocked");
  delete state.refuse;
  assert.equal(run.status, 1, run.stdout);
  assert.equal(filed(), before, "the move goes first, so nothing was written to disagree with it");
});

/* The other landing cannot be written that way round, so its refused move is worded around the
   record standing above it instead — which is the whole of what it costs (ISS-1633). */
test("a park landing in waiting names the record it left above a move the tracker refused", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.refuse = { transition: "TRANSITION_REASON_REQUIRED: a transition to `waiting` must carry a reason" };
  const run = await parked("ISS-97");
  delete state.refuse;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /the record for waiting went up and the move was refused/u, run.stderr);
  assert.ok(state.comments["parking-uuid"].some((one) => /forge-record: park/u.test(one.body)),
    "and the record it names is on the page");
});

test("the move is the first of a park's two writes where the kind lands in on_hold", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.calls.length = 0;
  const run = await parked("ISS-97", "blocked");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const moved = state.calls.findIndex((one) => one.args.action === "transition");
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.ok(moved >= 0 && wrote >= 0, `moved ${moved}, wrote ${wrote}`);
  assert.ok(moved < wrote, "the record is written against a status that has already moved");
});

/* A call asked for `waiting` cannot know before it sends whether it will land on `needs_info`, so
   the record goes up first for the whole landing or it goes up where the tracker reads it as the
   answer that unparks the issue (ISS-1633). */
test("a park landing in waiting writes its record before its transition", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.calls.length = 0;
  const run = await parked("ISS-97");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const moved = state.calls.findIndex((one) => one.args.action === "transition");
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.ok(wrote >= 0 && moved > wrote, `wrote ${wrote}, moved ${moved}`);
});

test("every park kind that lands in waiting carries the kind the tracker demands", async () => {
  for (const kind of PARKS.filter((one) => PARK_STATUS[one] === "waiting")) {
    state.calls.length = 0;
    const run = await parked("ISS-97", kind);
    assert.equal(run.status, 0, `${kind}: ${run.stdout}${run.stderr}`);
    assert.equal(sent("transition").waitingKind, "needs_decision", kind);
  }
});

/* Only a park adds to the payload: an advance along the flow says the status and nothing else. */
test("a plain advance sends the status alone, with no reason and no waiting kind", async () => {
  const run = await ranAsync(FORGE, ["advance", "ISS-98"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const moved = sent("transition");
  assert.equal(moved.status, "approved");
  assert.equal(moved.reason, undefined, "nothing collects a reason for a step of the flow");
  assert.equal(moved.waitingKind, undefined);
});

/* The tracker's announcement of the move is a comment with no device on it, and the order the park
   is written in is what keeps it from answering the very question the park asked (ISS-157). */
test("the tracker's announcement of the park is not the person's look that answers it", () => {
  const announcement = comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`\n\nlook at it");
  const asked = recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release");
  const view = (comments) => viewFrom("the-uuid", { status: "waiting" }, comments);
  assert.equal(answered(view([announcement, asked]), "screen-review"), false, "the park is the last word on the page");
  const looked = view([announcement, asked, comment("looked, and it is right", { authorId: "a-person" })]);
  assert.equal(answered(looked, "screen-review"), true, "and a comment after it is the answer");
});

/* The whole sequence through the verb rather than through a hand-built page: the move, the
   tracker's announcement of it, the record under that, a person's answer, and the resume that
   reads the park the announcement pairs with and sends the issue back where it left. */
test("a park written by the verb is resumed by the verb, back to the status it left", async () => {
  state.comments["parking-uuid"] = [];
  Object.assign(PARKING, { status: "awaiting_release" });
  const park = await parked("ISS-97");
  assert.equal(park.status, 0, `${park.stdout}${park.stderr}`);
  assert.equal(PARKING.status, "waiting", "the move landed");
  const page = state.comments["parking-uuid"];
  assert.match(page[0].body, /forge-record: park/u, "the record went up first");
  assert.match(page[1].body, /moved from `awaiting_release`/u, "and the tracker announced the move under it");
  state.comments["parking-uuid"].push(comment("looked, and it is right", { authorId: "a-person" }));
  /* The answer is a comment this session has not been shown, so the advance delivers it and makes
     the move in the one call — which is the gate working, not a step of the park (ISS-1715). */
  const back = await ranAsync(FORGE, ["advance", "ISS-97"], ENV);
  assert.match(back.stderr, /looked, and it is right/u, "the reply is delivered ahead of the move it answers");
  assert.equal(back.status, 0, `${back.stdout}${back.stderr}`);
  assert.match(back.stdout, /^ISS-97 {2}waiting -> awaiting_release {2}\(resumed where its park left it\)$/mu, back.stdout);
});

/* A `needs_info` park is the one that cannot be written the other way round: the record is a comment,
   and a comment there is the answer, so a record under the move would take the issue straight out of
   the status the move just set. The order is reversed for that kind alone (ISS-157, ISS-420). */
test("a needs_info park writes its record first, because a record under the move would undo it", async () => {
  Object.assign(MOVING, { status: "confirmed" });
  state.comments["moving-uuid"] = [];
  const asked = await ranAsync(FORGE, ["record", "question", "ISS-98", "--reading",
    "the park set the status -> resume by its left", "--reading", "an earlier move set it -> refuse"], ENV);
  assert.equal(asked.status, 0, `${asked.stdout}${asked.stderr}`);
  state.calls.length = 0;
  const run = await ranAsync(FORGE, ["advance", "ISS-98", "--park", "question", "--why",
    "which of the two readings is the one this issue is about"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  const moved = state.calls.findIndex((one) => one.args.action === "transition");
  assert.ok(wrote >= 0 && moved > wrote, `the record is the first write: wrote ${wrote}, moved ${moved}`);
  assert.equal(MOVING.status, "needs_info", "and the park is still on when the verb returns");
});

/* The tracker mints the question a person answers off `needs` alone, and neither writer of a
   `needs_info` move ever put that key in the payload: five parked issues carried their question in a
   comment with no answer box on the page and nothing delivered to the room (ISS-1396). The readings
   were on the record the whole time — the park is refused without them — so the field that travels is
   built from those, and never from the reason, which is the other half of the same distinction. */
const asked = (reference, extra = []) =>
  ranAsync(FORGE, ["advance", reference, "--park", "question", "--why",
    "which of the two readings is the one this issue is about", ...extra], ENV);

const readied = async (...readings) => {
  Object.assign(MOVING, { status: "confirmed" });
  state.comments["moving-uuid"] = [];
  const held = readings.length ? readings
    : ["the park set the status -> resume by its left", "an earlier move set it -> refuse"];
  const run = await ranAsync(FORGE, ["record", "question", "ISS-98",
    ...held.flatMap((one) => ["--reading", one])], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  state.calls.length = 0;
};

test("a question park sends the needs it was given beside the reason, and neither in the other's place", async () => {
  await readied();
  const run = await asked("ISS-98", ["--needs", "say which of the two readings the filing meant"]);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const moved = sent("transition");
  assert.equal(moved.status, "needs_info");
  assert.equal(moved.needs, "say which of the two readings the filing meant");
  assert.equal(moved.reason, "which of the two readings is the one this issue is about");
});

test("a question park carries what would settle it, built from the readings where the call names none", async () => {
  await readied();
  const run = await asked("ISS-98");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const { needs } = sent("transition");
  const first = needs.indexOf("the park set the status -> resume by its left");
  const second = needs.indexOf("an earlier move set it -> refuse");
  assert.ok(first >= 0, `the first reading with its outcome: ${needs}`);
  assert.ok(second >= 0, `the second reading with its outcome: ${needs}`);
  assert.ok(first < second, `in the order the record carries them: ${needs}`);
});

test("the needs a question park derives is the readings', whatever the reason beside it says", async () => {
  await readied();
  const one = await asked("ISS-98");
  assert.equal(one.status, 0, `${one.stdout}${one.stderr}`);
  const derived = sent("transition").needs;
  assert.ok(derived, "something was derived, or two absences would agree with each other");
  await readied();
  const two = await ranAsync(FORGE, ["advance", "ISS-98", "--park", "question", "--why",
    "a wholly different sentence about why this work stopped"], ENV);
  assert.equal(two.status, 0, `${two.stdout}${two.stderr}`);
  assert.equal(sent("transition").needs, derived, "the record held, the reason varied, the field did not");
});

test("a set to needs_info sends the needs it was given, as the park does", async () => {
  await readied();
  const run = await ranAsync(FORGE, ["advance", "ISS-98", "--set", "needs_info", "--why",
    "the reporter is the only one who can say", "--needs", "name the reading to take"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("transition").needs, "name the reading to take");
});

test("a set to needs_info given no needs sends no needs key, because a set reads no record", async () => {
  await readied();
  const run = await ranAsync(FORGE, ["advance", "ISS-98", "--set", "needs_info", "--why",
    "the reporter is the only one who can say"], ENV);
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("transition").needs, undefined, "nothing derives a question a set never read");
});

test("a park landing anywhere but needs_info sends no needs key", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.calls.length = 0;
  const run = await parked("ISS-97");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(sent("transition").needs, undefined, "no other status mints an answer box");
});

test("needs on a call that mints no answer box is refused before a single call is made", async () => {
  state.calls.length = 0;
  const run = await ranAsync(FORGE, ["advance", "ISS-97", "--park", "screen-review", "--why",
    "the new column has to be looked at", "--evidence", "c8c3550",
    "--needs", "what would settle it"], ENV);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(state.calls, [], "no endpoint was resolved and no credential was spent");
  assert.match(run.stderr, /--park question --why "<why>" --needs/u, "the park that reaches it");
  assert.match(run.stderr, /--set needs_info --why .* --needs/u, "and the set that reaches it");
});

test("a needs blank after trim is refused with nothing sent", async () => {
  state.calls.length = 0;
  const run = await asked("ISS-98", ["--needs", "   "]);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(state.calls, [], "a question with no text is an answer box asking nothing");
});

test("a needs over the cap the transition body takes is refused with nothing sent", async () => {
  state.calls.length = 0;
  const run = await asked("ISS-98", ["--needs", "x".repeat(2001)]);
  assert.equal(run.status, 1, run.stdout);
  assert.deepEqual(state.calls, [], "the body would reject it and take the status write down with it");
  assert.match(run.stderr, /2001 code points/u, "and the refusal says how far over it is");
});

test("a derived needs over that cap is refused, and the refusal costs no write", async () => {
  await readied(`${"alpha ".repeat(200)}-> ${"outcome ".repeat(200)}`, "the short reading -> the short outcome");
  const run = await asked("ISS-98");
  assert.equal(run.status, 1, run.stdout);
  const wrote = state.calls.filter((one) =>
    one.args.action === "transition" || one.args.action === "update"
    || (one.name === "forge_comments" && one.args.action === "create"));
  assert.deepEqual(wrote, [], "the readings are read and nothing at all is written");
  assert.match(run.stderr, /--needs/u, "and the flag that gets past it is named");
});

test("advance's own help puts needs on the row of each call that takes it", async () => {
  const run = await ranAsync(FORGE, ["advance", "-h"], ENV);
  assert.equal(run.status, 0, run.stderr);
  const rows = run.stdout.split("\n");
  assert.ok(rows.some((line) => /^\s+--park <kind>.*--needs/u.test(line)), run.stdout);
  assert.ok(rows.some((line) => /^\s+--set <status>.*--needs/u.test(line)), run.stdout);
});

/* Every case below fails on a CLI that reads the answer as a mismatch: the refusal fires with the
   move already landed, so the record it was about to write never goes up and nothing on the page
   says where the status came from. */
const REMAPPED = { waiting: "needs_info" };
const remapped = async (kind = "screen-review") => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.calls.length = 0;
  state.remap = REMAPPED;
  const run = await parked("ISS-97", kind);
  delete state.remap;
  return run;
};
const pageOf = () => state.comments["parking-uuid"];

test("a park lands its record where the tracker answers the other name of the landing asked for", async () => {
  const run = await remapped();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.equal(PARKING.status, "needs_info", "the move landed on the tracker's own name for it");
  const record = pageOf().find((one) => /forge-record: park/u.test(one.body));
  assert.ok(record, `no park record on the page: ${pageOf().map((one) => one.body).join("\n--\n")}`);
  assert.match(record.body, /left: awaiting_release/u, "stamped with the step it left, not the side status");
});

test("the reply names the status the tracker landed on and the one the kind asked for", async () => {
  const run = await remapped();
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /^ISS-97 {2}awaiting_release -> needs_info {2}\(asked for waiting, which this tracker spells needs_info\)$/mu,
    run.stdout);
});

test("the record a remapped park left pairs with the entry, and the way back is the step it named", async () => {
  const park = await remapped();
  assert.equal(park.status, 0, `${park.stdout}${park.stderr}`);
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  const said = `${owed.stdout}${owed.stderr}`;
  assert.doesNotMatch(said, /no park record on the page is paired with the entry into it/u, said);
  assert.match(said, /awaiting_release/u, said);
});

test("the report shows the park a remapped landing left, under the side status it landed on", async () => {
  const park = await remapped();
  assert.equal(park.status, 0, `${park.stdout}${park.stderr}`);
  const read = await ranAsync(FORGE, ["resume", "ISS-97"], ENV);
  assert.equal(read.status, 0, `${read.stdout}${read.stderr}`);
  assert.match(read.stdout, /screen-review/u, read.stdout);
});

/* The order the record was written in is not the order it is read back in: both shipped, so a page
   carrying either has to resume. */
test("a record written after its own announcement still pairs with that entry", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  const said = `${owed.stdout}${owed.stderr}`;
  assert.doesNotMatch(said, /no park record on the page is paired with the entry into it/u, said);
  assert.match(said, /awaiting_release/u, said);
});

test("an entry nothing announced says which park on the page it could not pair", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 1, `${owed.stdout}${owed.stderr}`);
  assert.match(owed.stderr, /park of kind `screen-review`/u, owed.stderr);
});

/* Under the old order the announcement sat above the record and could not be read as an answer to
   it. It sits below one now, so it is named rather than kept out by where it is. */
test("the announcement under a record-first park is not the person's look that answers it", () => {
  const asking = recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release");
  const announcement = comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`\n\nlook at it");
  const view = (comments) => viewFrom("the-uuid", { status: "needs_info" }, comments);
  assert.equal(answered(view([asking, announcement]), "screen-review"), false, "nobody has looked yet");
  const looked = view([asking, announcement, comment("looked, and it is right", { authorId: "a-person" })]);
  assert.equal(answered(looked, "screen-review"), true, "and a comment after it is the answer");
});

/* A preservation case and not a regression witness: strict name equality refused this too. It is
   here because the landing is what replaced that equality, and a pair that swallowed everything
   would look exactly like one that swallowed only its own two names. */
test("a status outside the landing asked for is still refused", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.remap = { waiting: "on_hold" };
  const run = await parked("ISS-97");
  delete state.remap;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /answered with status on_hold, not waiting/u, run.stderr);
});

test("a set to a status of that landing writes its correction before its transition", async () => {
  Object.assign(PARKING, { status: "awaiting_release" });
  state.comments["parking-uuid"] = [];
  state.calls.length = 0;
  state.remap = REMAPPED;
  const run = await ranAsync(FORGE, ["advance", "ISS-97", "--set", "waiting", "--why",
    "the person who knows where it belongs put it here"], ENV);
  delete state.remap;
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  const moved = state.calls.findIndex((one) => one.args.action === "transition");
  const wrote = state.calls.findIndex((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.ok(wrote >= 0 && moved > wrote, `wrote ${wrote}, moved ${moved}`);
});

/* A record reachable above the announcement that a later entry did not write: reading it again
   would send the issue back by a park somebody already answered. What tells the two apart is that
   the older order wrote its record straight after the announcement it belonged to, and the newer
   one writes it before any move was asked for (ISS-1633, codex F1). */
test("an entry that wrote no record of its own does not pair with an answered one before it", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
    comment("looked, and it is right", { authorId: "a-person" }),
    comment("⏸ **Waiting on a human decision** — moved from `testing`"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 1, `${owed.stdout}${owed.stderr}`);
  assert.match(owed.stderr, /no park record on the page/u, owed.stderr);
});

test("a record before its own announcement pairs with the entry that announcement names", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
    comment("looked, and it is right", { authorId: "a-person" }),
    recorded("park", { kind: "screen-review", why: "look again", evidence: ["c8c3550"] }, "testing"),
    comment("⏸ **Waiting on a human decision** — moved from `testing`"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  const said = `${owed.stdout}${owed.stderr}`;
  assert.match(said, /testing/u, said);
});

test("nor with one that left the same status it did, where an answer stands between them", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
    comment("looked, and it is right", { authorId: "a-person" }),
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 1, `${owed.stdout}${owed.stderr}`);
  assert.match(owed.stderr, /no park record on the page/u, owed.stderr);
});

/* The record and the move are two writes with a lease read between them, so a person's comment can
   land between the record and the announcement of the move it belongs to. What tells that record
   from one an earlier entry left is which announcement it sits beside: a move-first record is the
   comment straight after its own, and a record-first one never is (ISS-1633, codex F1). */
test("a comment landing between a park's record and its announcement does not unpair them", async () => {
  Object.assign(PARKING, { status: "needs_info" });
  state.comments["parking-uuid"] = [
    recorded("park", { kind: "screen-review", why: "look at it", evidence: ["c8c3550"] }, "awaiting_release"),
    comment("one more thing before you look", { authorId: "a-person" }),
    comment("⏸ **Waiting on a human decision** — moved from `awaiting_release`"),
  ];
  const owed = await ranAsync(FORGE, ["advance", "ISS-97", "--owed"], ENV);
  assert.equal(owed.status, 0, `${owed.stdout}${owed.stderr}`);
  const said = `${owed.stdout}${owed.stderr}`;
  assert.doesNotMatch(said, /no park record on the page is paired with the entry into it/u, said);
  assert.match(said, /awaiting_release/u, said);
});
