/* What the wrapped verbs expose. The cost assertions are the point: "narrow, then fetch again" is
   a measurement or it is a slogan, and a projection that does not shrink the payload is not one. */
import assert from "node:assert/strict";
import test from "node:test";

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { terse } from "../../src/commands.mjs";
import { uploaded, urlBearing } from "../../src/tracker/evidence.mjs";
import { boundByLimit, fakeTracker, pageOf, ranAsync, tempRoom } from "../fixtures.mjs";

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

/* The cut that matters is by response BYTES, so the page comes back SHORTER than the ask and a test
   of `rows.length === limit` is false exactly where the reader most needs a warning: this page is
   two rows of four, against a limit of 500. Without the envelope reading, every case below prints
   nothing at all. */
const cutByBytes = () => {
  state.issues = ROWS;
  state.answer = { forge_issues: pageOf(ROWS.map((one, at) => ({ ...one, touched: ROWS.length - at })), 2) };
};

test("a page the byte cap cut is not reported as the whole backlog", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /was cut to the 2 row\(s\) read/u,
    "two rows of four came back, and the ask was 500 — the length test called that a whole page");
});

test("the line states the count returned and never the limit it asked for", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  const said = run.stdout.split("\n").find((line) => line.includes("was cut to")) ?? "";
  assert.match(said, /2 row\(s\)/u);
  assert.doesNotMatch(said, /\b(?:200|500)\b/u, "a limit in this sentence is the one thing that cannot help");
});

test("the line names the cap that bit", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  assert.match(run.stdout, /by response-size/u);
});

test("the tracker's own notice reaches the reader, which is where the route lives", async () => {
  cutByBytes();
  const run = await ran(["issues"]);
  assert.match(run.stdout, /A higher limit will NOT help/u,
    "the only sentence that knows which cap bit, and it is the tracker's");
});

/* The one thing the length test got right, and the case a bare MAX_LIMIT fallback would have lost:
   here the caller's OWN limit bound the page, so raising it is what helps and the notice says so. */
test("a page the reader's own limit bound still warns, and is told the opposite thing", async () => {
  state.issues = ROWS;
  state.answer = { forge_issues: boundByLimit(ROWS) };
  const run = await ran(["issues", "--limit", "2"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /was cut to the 2 row\(s\) read, by limit/u);
  assert.match(run.stdout, /Raise limit/u, "here a higher limit is exactly what helps");
});

test("a page the tracker reports whole prints no cut line at all", async () => {
  state.issues = ROWS;
  state.answer = undefined;
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /was cut to/u);
});

/* A server that answers with no envelope at all: silence is not a cut, and four rows under a limit
   of 500 is a whole backlog. */
test("a short page from a server that reports nothing is read as whole", async () => {
  state.issues = ROWS;
  state.answer = { forge_issues: () => ({ issues: ROWS }) };
  const run = await ran(["issues"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /was cut to/u);
  state.answer = undefined;
});
