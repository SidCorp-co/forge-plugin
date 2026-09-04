/* A human reference is resolved through one list of every issue, and `forge dep <a> <b>` asks for
   two of them at once — so what a memo holds has to be the request and not its answer. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

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

const asked = [];
globalThis.fetch = async (url, init) => {
  const sent = JSON.parse(init.body);
  asked.push(sent.params?.name ?? sent.method);
  const result =
    sent.method === "tools/list"
      ? { tools: [{ name: "forge_issues", inputSchema: { properties: {} } }] }
      : { structuredContent: { issues: ROWS } };
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
