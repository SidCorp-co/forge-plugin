/* What the wrapped verbs expose. The cost assertions are the point: "narrow, then fetch again" is
   a measurement or it is a slogan, and a projection that does not shrink the payload is not one. */
import assert from "node:assert/strict";
import test from "node:test";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { terse } from "../../src/commands.mjs";
import { MAX_LIMIT } from "../../src/tracker/issues.mjs";
import { uploaded, urlBearing } from "../../src/tracker/evidence.mjs";
import { fakeTracker, pageOf, ranAsync, tempRoom } from "../fixtures.mjs";

/* The shape forge_uploads returns, as observed on ISS-22's one attachment. */
const ATTACHMENT = {
  id: "56d4641e-fd47-4a80-b468-2c602265ce85",
  name: "image.png",
  mime: "image/png",
  size: 157346,
  createdAt: "2026-08-29T08:50:04.206Z",
  url: "/api/attachments/56d4641e-fd47-4a80-b468-2c602265ce85/download",
};

const bytes = (value) => JSON.stringify(value).length;

test("an attachment collapses to the url that fetches it", () => {
  assert.deepEqual(terse({ attachments: [ATTACHMENT] }), { attachments: [ATTACHMENT.url] });
});

test("collapsing an attachment costs less than carrying it", () => {
  const before = bytes({ attachments: [ATTACHMENT] });
  const after = bytes(terse({ attachments: [ATTACHMENT] }));
  assert.ok(after < before, `${after} should be under ${before}`);
  assert.ok(after / before < 0.5, `kept ${((after / before) * 100).toFixed(0)}% — expected under half`);
});

test("the saving scales with the attachment count", () => {
  const many = { attachments: Array.from({ length: 10 }, () => ATTACHMENT) };
  assert.ok(bytes(terse(many)) / bytes(many) < 0.5);
  assert.equal(terse(many).attachments.length, 10);
});

test("nothing else in the record is touched", () => {
  const record = { issueId: "ISS-22", plan: "# a plan", relations: { blocks: [], blockedBy: [] } };
  assert.deepEqual(terse(record), record);
});

test("an array of plain values survives", () => {
  assert.deepEqual(terse({ fields: ["plan", "status"] }), { fields: ["plan", "status"] });
});

test("an element without a url keeps its fields", () => {
  const relation = { issueId: "ISS-23", kind: "blocks" };
  assert.deepEqual(terse({ relations: [relation] }), { relations: [relation] });
});

test("a url that is not a string is not mistaken for one", () => {
  assert.equal(urlBearing({ url: 12 }), false);
  assert.equal(urlBearing(null), false);
  assert.equal(urlBearing("string"), false);
});

test("an upload reply prints its url, and an unexpected body prints whole", () => {
  assert.equal(uploaded(JSON.stringify(ATTACHMENT)), ATTACHMENT.url);
  assert.equal(uploaded("502 Bad Gateway"), "502 Bad Gateway");
  assert.equal(uploaded('{"error":"denied"}'), '{"error":"denied"}');
});

/* The browse verb is a queue or it is a reading order, and only the verb spawned against a tracker
   says which: the rank order is read off the schema the tracker declares, which no in-process call
   to the row printer would exercise. */
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ROOT = new URL("../../..", import.meta.url).pathname;

const ROWS = [
  { issueId: "ISS-10", documentId: "u-10", status: "open", priority: "low", createdAt: "2026-01-01T00:00:00.000Z", title: "the oldest, and nobody has ranked it" },
  { issueId: "ISS-11", documentId: "u-11", status: "open", priority: "critical", createdAt: "2026-04-01T00:00:00.000Z", title: "filed last and wanted first" },
  { issueId: "ISS-12", documentId: "u-12", status: "open", priority: "high", createdAt: "2026-03-01T00:00:00.000Z", title: "the younger of the two high ones" },
  { issueId: "ISS-13", documentId: "u-13", status: "open", priority: "high", createdAt: "2026-02-01T00:00:00.000Z", title: "the older of the two high ones" },
];

const state = { issues: ROWS, comments: {}, calls: [] };
const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const ran = (argv) => ranAsync(FORGE, argv, tracker.env, ROOT);

test("the browse page comes back in the order it is to be worked, not the order it was touched", async () => {
  state.issues = ROWS;
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  const keys = run.stdout.split("\n").filter((line) => line.startsWith("ISS-")).map((line) => line.split(" ")[0]);
  assert.deepEqual(keys, ["ISS-11", "ISS-13", "ISS-12", "ISS-10"],
    "critical, then the older high before the younger, then the one nobody ranked");
});

test("every row shows the rank it was sorted on", async () => {
  state.issues = ROWS;
  const run = await ran(["issues"]);
  assert.match(run.stdout, /^ISS-11 {3}critical {1}open {9}filed last and wanted first$/mu);
  assert.match(run.stdout, /^ISS-10 {3}low {6}open {9}the oldest/mu);
});

const NOTE = [
  "## What happened",
  "",
  "`forge issues` answered in the order the rows were last touched, which is nobody's queue.",
  "",
  "## Outcome",
  "",
  "A note this verb files carries the rank a note nobody read is owed.",
  "",
  "## Rules",
  "",
  "- The rank is written by the verb, never left for the tracker to fill.",
  "",
  "## Out of scope",
  "",
  "The rank of the notes already filed.",
].join("\n");

const noted = (title) => {
  const path = join(tempRoom("note-"), "note.md");
  writeFileSync(path, `${NOTE}\n`);
  return ran(["feedback", path, "--title", title]);
};

/* Nobody ranks a defect they merely met, so the note is filed unranked and says so. The flag the
   other filing route takes is not one of this verb's — its own help and refusal say why. */
test("a note filed against this plugin is ranked by nobody, so it lands at the bottom saying so", async () => {
  state.issues = [];
  state.calls = [];
  const run = await noted("the browse verb answers in an order a run can work from");
  assert.equal(run.status, 0, run.stderr);
  const create = state.calls.find((one) => one.name === "forge_issues" && one.args.action === "create");
  assert.equal(create.args.data.priority, "low");
  assert.match(run.stdout, /^filed-uuid is filed, priority low, by default\.$/mu);
});

test("a note taken as a comment on a title already open ranks nothing at all", async () => {
  const title = "the browse verb answers in an order a run can work from";
  state.issues = [{ issueId: "ISS-9", documentId: "u-9", status: "open", title }];
  state.calls = [];
  const run = await noted(title);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.calls.some((one) => one.args.action === "create" && one.name === "forge_issues"), false);
  const said = state.calls.find((one) => one.name === "forge_comments" && one.args.action === "create");
  assert.equal("priority" in said.args.data, false, "a comment is no filing and owes no rank");
  assert.doesNotMatch(run.stdout, /priority/u);
});

/* The cut that matters is by response BYTES, so no ask of any size gets past it: two rows of four
   come back against a limit of 500. What the verb owes is the other two, and the tracker answers a
   window, so the browse verb walks one. */
const cutByBytes = () => {
  state.issues = ROWS;
  state.answer = { forge_issues: pageOf(ROWS.map((one, at) => ({ ...one, touched: ROWS.length - at })), 2) };
};

const keysOf = (run) =>
  run.stdout.split("\n").filter((line) => line.startsWith("ISS-")).map((line) => line.split(" ")[0]);

test("a page the byte cap cut is walked until every matching row is in hand", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(keysOf(run).sort(), ["ISS-10", "ISS-11", "ISS-12", "ISS-13"],
    "two of the four fit one answer, and the verb printed all four");
});

test("the count line says the whole set and how many requests it took", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  const said = /4 issue\(s\) over (\d+) page\(s\), which is every row matching this ask/u.exec(run.stdout);
  assert.ok(said, `no count line in:\n${run.stdout}`);
  assert.ok(Number(said[1]) > 1, "one answer held two of the four, so the reading took more than one");
});

test("a walked reading claims no cut", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  assert.doesNotMatch(run.stdout, /incomplete/u, "nothing was withheld, so nothing is owed to say so");
});

/* Every row on one timestamp: an interval one millisecond wide is the only indivisible one, so this
   is the only shape a walk cannot get past, and the honest sentence is what is left. */
const ALWAYS_CUT = ROWS.map((one) => ({ ...one, createdAt: "2026-01-01T00:00:00.000Z" }));
const stuckAt = (fits) => {
  state.issues = ALWAYS_CUT;
  state.answer = { forge_issues: pageOf(ALWAYS_CUT.map((one, at) => ({ ...one, touched: at })), fits) };
};

test("a reading that stays cut says so, in the count it measured", async () => {
  stuckAt(2);
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  const said = run.stdout.split("\n").find((line) => line.includes("incomplete")) ?? "";
  assert.match(said, /2 issue\(s\) over \d+ page\(s\)/u);
  assert.doesNotMatch(said, /\b(?:200|500)\b/u, "a limit in this sentence is the one thing that cannot help");
});

test("the tracker's own notice reaches the reader, which is where the route lives", async () => {
  stuckAt(2);
  const run = await ran(["issues"]);
  assert.match(run.stdout, /A higher limit will NOT help/u,
    "the only sentence that knows which cap bit, and it is the tracker's");
});

test("that reading routes to an ask narrow enough to come back whole", async () => {
  stuckAt(2);
  const run = await ran(["issues"]);
  assert.match(run.stdout, /forge issues --status open/u);
});

/* `--limit` stopped being the wire ask when the answer became a union of windows: it is how many of
   the whole set print, and the rows it drops are the tail of an order the reader can see. */
test("the limit prints that many of the whole set and says what it left out", async () => {
  cutByBytes();
  const run = await ran(["issues", "--limit", "2"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(keysOf(run), ["ISS-11", "ISS-13"], "the top two of the order, not the two that fit");
  assert.match(run.stdout, /2 of 4 issue\(s\)/u);
  assert.match(run.stdout, /tail of the order above/u);
  assert.match(run.stdout, /--limit/u, "the flag that prints more of it");
});

/* The one size this project has never been: `--limit` is refused above MAX_LIMIT and the print cut
   only bites at `shown === limit`, so at the ceiling the flag clause names the one thing that cannot
   move. Built off the constant, because a case pinned to 500 goes green by accident if it changes. */
const overTheCeiling = () => {
  state.issues = Array.from({ length: MAX_LIMIT + 1 }, (unused, at) => ({
    issueId: `ISS-${1000 + at}`,
    documentId: `u-${1000 + at}`,
    status: "open",
    priority: "low",
    createdAt: new Date(Date.UTC(2026, 0, 1) + at * 1000).toISOString(),
    title: `row ${at}`,
  }));
  state.answer = undefined;
};

test("at the ceiling the cut sentence drops the flag and keeps the route that works", async () => {
  overTheCeiling();
  const run = await ran(["issues", "--limit", String(MAX_LIMIT)]);
  assert.equal(run.status, 0, run.stderr);
  const said = run.stdout.split("\n").find((line) => line.includes("not printed")) ?? "";
  assert.match(said, new RegExp(`^${MAX_LIMIT} of ${MAX_LIMIT + 1} issue\\(s\\)`, "u"));
  assert.match(said, /tail of the order above/u, "which rows were dropped is still said");
  assert.match(said, /a filter narrows the ask/u, "the one action left is still named");
  assert.doesNotMatch(said, /--limit/u, "the flag is already at its ceiling, so naming it is advice that cannot be taken");
});

test("a page the tracker reports whole is read in one request", async () => {
  state.issues = ROWS;
  state.answer = undefined;
  state.calls = [];
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /incomplete/u);
  assert.equal(state.calls.filter((one) => one.name === "forge_issues").length, 1,
    "a whole answer is not a reason to walk");
});

/* A server that answers with no envelope at all: silence is not a cut, and four rows under a limit
   of 500 is a whole backlog. */
test("a short page from a server that reports nothing is read as whole", async () => {
  state.issues = ROWS;
  state.answer = { forge_issues: () => ({ issues: ROWS }) };
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /incomplete/u);
  state.answer = undefined;
});

/* A page that names the cap that cut it is a cut page, whichever of the envelope's other fields the
   answer happens to carry: a reading resting on one field alone is the defect again, one field over. */
test("a page naming only the cap that bit is still walked past", async () => {
  state.issues = ROWS;
  let asked = 0;
  state.answer = {
    forge_issues: () => {
      asked += 1;
      return asked === 1
        ? { issues: ROWS.slice(0, 2), returned: 2, truncatedBy: "response-size" }
        : { issues: ROWS.slice(2), returned: 2 };
    },
  };
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(asked > 1, "one field was enough to read the cut and walk on");
  state.answer = undefined;
});
