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

const { documentIdOf } = await import("../../src/tracker/issues.mjs");

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
