import assert from "node:assert/strict";
import test from "node:test";

import {
  accountForZone,
  cloudflareAccounts,
  everyZone,
  pullRepeated,
  recordLine,
  searchDns,
} from "../src/cloudflare.mjs";

const reply = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

const refusal = (message) => reply({ success: false, errors: [{ message }] });

const stub = (t, fetching) => {
  const held = globalThis.fetch;
  const errors = [];
  const spoke = console.error;
  globalThis.fetch = fetching;
  console.error = (text) => errors.push(text);
  t.after(() => {
    globalThis.fetch = held;
    console.error = spoke;
  });
  return errors;
};

const withEnv = (t, values) => {
  const held = { ...process.env };
  for (const [name, value] of Object.entries(values)) {
    if (value === null) delete process.env[name];
    else process.env[name] = value;
  }
  t.after(() => {
    process.env = held;
  });
};

const byToken = (answers) => async (url, init) =>
  answers[init.headers.Authorization] ?? refusal("no such account");

test("an environment pair resolves to one account without reading the config", (t) => {
  withEnv(t, { CLOUDFLARE_API_TOKEN: "cf-token", CLOUDFLARE_ACCOUNT_ID: "acct-1" });
  const { accounts, from, problem } = cloudflareAccounts();
  assert.equal(problem, undefined);
  assert.equal(from, "$CLOUDFLARE_API_TOKEN");
  assert.deepEqual(accounts, [{ name: "environment", accountId: "acct-1", apiToken: "cf-token" }]);
});

test("half an environment pair says which name is missing rather than falling back", (t) => {
  withEnv(t, { CLOUDFLARE_API_TOKEN: "cf-token", CLOUDFLARE_ACCOUNT_ID: null });
  const { accounts, problem } = cloudflareAccounts();
  assert.deepEqual(accounts, []);
  assert.match(problem, /\$CLOUDFLARE_ACCOUNT_ID is not set/u);
});

test("a failing account is named, and the others still aggregate", async (t) => {
  const errors = stub(
    t,
    byToken({
      "Bearer good": reply({ success: true, result: [{ id: "z1", name: "one.example", status: "active" }] }),
      "Bearer bad": refusal("Invalid API token"),
    }),
  );
  const { zones, failed } = await everyZone([
    { name: "keeps", accountId: "a1", apiToken: "good" },
    { name: "revoked", accountId: "a2", apiToken: "bad" },
  ]);
  assert.deepEqual(
    zones.map((zone) => zone.name),
    ["one.example"],
  );
  assert.deepEqual(failed, ["revoked"]);
  assert.match(errors.join("\n"), /account revoked answered Invalid API token/u);
});

test("the account holding a zone is found by probing, never typed", async (t) => {
  stub(
    t,
    byToken({
      "Bearer first": refusal("Zone not found"),
      "Bearer second": reply({ success: true, result: { id: "z9" } }),
    }),
  );
  const found = await accountForZone(
    [
      { name: "first", accountId: "a1", apiToken: "first" },
      { name: "second", accountId: "a2", apiToken: "second" },
    ],
    "z9",
  );
  assert.equal(found.name, "second");
});

test("a record matching both the name and the content filter is listed once", async (t) => {
  stub(t, async () =>
    reply({
      success: true,
      result: [{ id: "r1", type: "A", name: "www.example.com", content: "example.com", ttl: 1 }],
    }),
  );
  const zone = { id: "z1", name: "example.com", account: { name: "one", apiToken: "t1" } };
  const found = await searchDns([zone], "example.com");
  assert.equal(found.length, 1);
  assert.equal(found[0].zone_name, "example.com");
  assert.equal(found[0].zone_id, "z1");
});

test("a query naming a host reaches the zone that host sits in", async (t) => {
  const asked = [];
  stub(t, async (url) => {
    asked.push(url);
    return reply({ success: true, result: [] });
  });
  const zone = { id: "z1", name: "example.com", account: { name: "one", apiToken: "t1" } };
  await searchDns([zone], "www.example.com");
  assert.equal(asked.length, 2);
  assert.ok(asked.every((url) => url.includes("/zones/z1/dns_records")));
});

test("--file is collected, not overwritten by the last one given", () => {
  const { values, rest } = pullRepeated(["--file", "a", "--file", "b", "--other", "x"], "--file");
  assert.deepEqual(values, ["a", "b"]);
  assert.deepEqual(rest, ["--other", "x"]);
});

test("an auto ttl reads as auto rather than as the 1 the API stores", () => {
  const line = recordLine({
    id: "r1",
    type: "A",
    name: "www.example.com",
    content: "1.2.3.4",
    ttl: 1,
    proxied: true,
  });
  assert.match(line, /proxied {2}ttl=auto/u);
  assert.doesNotMatch(line, /priority/u);
});
