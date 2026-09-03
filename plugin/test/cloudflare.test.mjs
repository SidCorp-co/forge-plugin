import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* A config of its own, and imported after it: on the developer's machine this suite otherwise
   loads four live tokens and what it proves becomes a property of that file. The import has to
   follow, because the config path is resolved once when `resolve/config.mjs` loads. */
const HOME = mkdtempSync(join(tmpdir(), "cloudflare-home-"));
const CONFIG = join(HOME, "forge", "config.json");
mkdirSync(join(HOME, "forge"));
writeFileSync(CONFIG, JSON.stringify({
  cloudflare: { accounts: [{ name: "saved", accountId: "acct-config", apiToken: "cf-config" }] },
}));
process.env.XDG_CONFIG_HOME = HOME;

const { accountForZone, cloudflareAccounts, everyZone, recordLine, searchDns } = await import(
  "../src/tools/cloudflare.mjs"
);
const { pullRepeated } = await import("../src/resolve/flags.mjs");

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

/* The config is the only source, so a pair in the environment adds nothing to what it holds. */
test("an environment pair is not an account", (t) => {
  withEnv(t, { CLOUDFLARE_API_TOKEN: "cf-env", CLOUDFLARE_ACCOUNT_ID: "acct-env" });
  const { accounts, from } = cloudflareAccounts();
  assert.deepEqual(accounts.map((one) => one.name), ["saved"], "the saved account, and only it");
  assert.equal(from, CONFIG, "reported as coming from the file it was read from");
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
  const { values, rest } = pullRepeated(["--file", "a", "--file", "b", "--other", "x"], "--file", "cloudflare purge");
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
