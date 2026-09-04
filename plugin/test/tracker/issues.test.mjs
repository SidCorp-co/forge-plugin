/* A human reference is resolved through one list of every issue, and `forge dep <a> <b>` asks for
   two of them at once — so what a memo holds has to be the request and not its answer. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pageOf, tempRoom } from "../fixtures.mjs";

/* Imported after the endpoint is written, because `resolve/config.mjs` resolves its path on load. */
const HOME = tempRoom("issues-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(
  join(HOME, "forge", "config.json"),
  JSON.stringify({ url: "https://stub.example/mcp", token: "t" }),
);
process.env.XDG_CONFIG_HOME = HOME;

const ROWS = [
  { issueId: "ISS-1", documentId: "aaaa" },
  { issueId: "ISS-2", documentId: "bbbb" },
];

/* What the tracker answers, which a paging case replaces. The default is the whole set in one whole
   page, so a case about anything else asks for nothing it has to describe. */
let scene = () => ({ issues: ROWS });
const asked = [];
globalThis.fetch = async (url, init) => {
  const sent = JSON.parse(init.body);
  asked.push(sent.params?.name ?? sent.method);
  const result =
    sent.method === "tools/list"
      ? { tools: [{ name: "forge_issues", inputSchema: { properties: {} } }] }
      : { structuredContent: scene(sent.params?.arguments ?? {}) };
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
  };
};

const { documentIdOf, queued } = await import("../../src/tracker/issues.mjs");

test("two references resolved at once share one list", async () => {
  const both = await Promise.all([documentIdOf("ISS-1"), documentIdOf("ISS-2")]);
  assert.deepEqual(both, ["aaaa", "bbbb"]);
  assert.deepEqual(
    asked.filter((name) => name === "forge_issues"),
    ["forge_issues"],
    "`dep <a> <b>` resolves both from the same request",
  );
  assert.equal(await documentIdOf("ISS-2"), "bbbb");
  assert.equal(asked.filter((name) => name === "forge_issues").length, 1, "and a later one refetches nothing");
});

test("a uuid is its own answer and asks for no list", async () => {
  const uuid = "56d4641e-fd47-4a80-b468-2c602265ce85";
  assert.equal(await documentIdOf(uuid), uuid);
});

/* The order the page is worked in, which the tracker has no argument for: its `list` answers in the
   order things were last touched, so a queue is the CLI's to impose on what arrived. */
const ORDER = ["critical", "high", "medium", "low", "none"];
const at = (priority, createdAt, issueId = priority) => ({ issueId, priority, createdAt });
const keys = (rows, order = ORDER) => queued(rows, order).map((one) => one.issueId);

test("the rank comes first, in the order the tracker's own set declares", () => {
  const rows = [at("low", "2026-01-01"), at("critical", "2026-01-01"), at("medium", "2026-01-01")];
  assert.deepEqual(keys(rows), ["critical", "medium", "low"]);
});

test("at one rank the oldest is first, because it has waited longest", () => {
  const rows = [
    at("high", "2026-03-01", "new"),
    at("high", "2026-01-01", "old"),
    at("high", "2026-02-01", "middle"),
  ];
  assert.deepEqual(keys(rows), ["old", "middle", "new"]);
});

test("a rank the set does not hold sorts behind every rank it does", () => {
  const rows = [at("archived", "2026-01-01", "odd"), at("none", "2026-02-01", "none")];
  assert.deepEqual(keys(rows), ["none", "odd"]);
});

/* A row with no date claims no place: the back of its own rank rather than the front, where an
   unreadable timestamp read as the epoch would have put it. */
test("a row with no timestamp takes the back of its rank and keeps the page it arrived in", () => {
  const rows = [{ issueId: "undated", priority: "high" }, at("high", "2026-05-01", "dated")];
  assert.deepEqual(keys(rows), ["dated", "undated"]);
});

test("a schema declaring no set leaves the page exactly as it arrived", () => {
  const rows = [at("low", "2026-01-01"), at("critical", "2026-01-01")];
  assert.deepEqual(keys(rows, []), ["low", "critical"]);
  assert.deepEqual(queued(rows, []), rows, "and the rows themselves are the ones handed in");
});

/* The crack is in the difference between what a list is asked for and what it answers, so the case
   needs the tracker's own paging: `fixtures.pageOf`. A `touched` out of step with `createdAt` is
   what a created-order frontier walks straight past. */
const day = (one) => `2026-01-0${one}T00:00:00.000Z`;
const CUT = [
  { issueId: "ISS-1", documentId: "one", createdAt: day(1), touched: 1 },
  { issueId: "ISS-2", documentId: "two", createdAt: day(2), touched: 2 },
  { issueId: "ISS-3", documentId: "three", createdAt: day(3), touched: 3 },
  { issueId: "ISS-4", documentId: "four", createdAt: day(4), touched: 6 },
  { issueId: "ISS-5", documentId: "five", createdAt: day(5), touched: 4 },
  { issueId: "ISS-6", documentId: "six", createdAt: day(6), touched: 5 },
];

/* The index is one per process by design, so a case that walks it starts from an empty one. */
let cases = 0;
const walking = async (rows = CUT, fits = 2) => {
  scene = pageOf(rows, fits);
  asked.length = 0;
  cases += 1;
  return (await import(`../../src/tracker/issues.mjs?case=${cases}`)).documentIdOf;
};
const lists = () => asked.filter((name) => name === "forge_issues").length;

test("a key the first page could not carry resolves anyway", async () => {
  const resolve = await walking();
  assert.equal(await resolve("ISS-1"), "one", "the oldest issue, four pages under the waterline");
});

test("a key created after one on the page, and absent from it, resolves too", async () => {
  const resolve = await walking();
  assert.equal(await resolve("ISS-5"), "five",
    "ISS-5 is younger than ISS-4, which the page carries, so the gap is not a range");
});

test("a key on the first page costs one request, cut page or not", async () => {
  const resolve = await walking();
  assert.equal(await resolve("ISS-4"), "four");
  assert.equal(lists(), 1, "nothing is walked for a key already in hand");
});

test("the walk stops at the key instead of reading the backlog first", async () => {
  const near = await walking();
  await near("ISS-5");
  const stopped = lists();
  const far = await walking();
  await far("ISS-1");
  assert.ok(stopped < lists(), `${stopped} request(s) for ISS-5 should be under ${lists()} for ISS-1`);
});

test("two references under the waterline share one walk", async () => {
  const resolve = await walking();
  assert.deepEqual(await Promise.all([resolve("ISS-1"), resolve("ISS-2")]), ["one", "two"]);
  const together = lists();
  const alone = await walking();
  await alone("ISS-1");
  assert.equal(together, lists(), "the second reference waited for the first walk rather than running one");
});

test("a page the tracker answers with no envelope at all is read as whole", async () => {
  scene = () => ({ issues: ROWS });
  asked.length = 0;
  cases += 1;
  const { documentIdOf: resolve } = await import(`../../src/tracker/issues.mjs?case=${cases}`);
  assert.equal(await resolve("ISS-1"), "aaaa");
  assert.equal(lists(), 1, "a short page from a server that says nothing is not a reason to walk");
});

/* Touched in reverse, so the two rows the page carries are the two created EARLIEST. The newest
   stamp on a cut page is then nowhere near the newest creation under the frontier, and a walk that
   treats it as the last subdivision available gives up with the key still reachable. */
const TOUCHED_BACKWARDS = CUT.map((one, place) => ({ ...one, touched: CUT.length - place }));

test("a cut page whose newest stamp is nowhere near the newest creation still resolves", async () => {
  const resolve = await walking(TOUCHED_BACKWARDS);
  assert.equal(await resolve("ISS-6"), "six", "narrowing to a stamp the page returned would stop short");
});
