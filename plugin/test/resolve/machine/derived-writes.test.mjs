/* A write that builds a key's value from what the key holds builds it from the file as it stands under
   the write's lock (ISS-3126). Each case is its own process: it reads the config, a second writer
   adds an entry under the same key by hand, so nothing of the code under test makes it, and only then
   does the caller under test write. Built off the first read, the caller put back a copy without it. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { neutralRoom, tempRoom } from "../../fixtures.mjs";

const SRC = (rel) => JSON.stringify(fileURLToPath(new URL(`../../../src/${rel}`, import.meta.url)));
const FORGE = fileURLToPath(new URL("../../../bin/forge", import.meta.url));

const homeHolding = (config) => {
  const home = tempRoom("derived-writes-");
  mkdirSync(join(home, "forge"));
  writeFileSync(join(home, "forge", "config.json"), JSON.stringify(config));
  return home;
};

const envFor = (home, extra = {}) => {
  const env = { ...process.env, XDG_CONFIG_HOME: home, ...extra };
  if (!extra.FORGE_BORROW_FROM) delete env.FORGE_BORROW_FROM;
  return env;
};

const heldIn = (home) => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8"));

/* `meanwhile` is the body of a function of the parsed file, run between the read and the write. */
const raced = (home, { imports, meanwhile, write }) => {
  const script = [
    "const fs = await import(\"node:fs\");",
    `const config = await import(${SRC("resolve/config.mjs")});`,
    imports,
    "config.userConfig();",
    "const now = JSON.parse(fs.readFileSync(config.configPath(), \"utf8\"));",
    `(${meanwhile})(now);`,
    "fs.writeFileSync(config.configPath(), JSON.stringify(now));",
    write,
  ].join("\n");
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { env: envFor(home), cwd: neutralRoom(), encoding: "utf8" });
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
  return heldIn(home);
};

const CF_ONE = { name: "one", accountId: "acct-one", apiToken: "cf-one" };
const CF_OTHER = { name: "other", accountId: "acct-other", apiToken: "cf-other" };
const CLOUDFLARE = `const { cloudflare } = await import(${SRC("tools/services/cloudflare.mjs")});`;
const ADDS_OTHER = "(now) => { now.cloudflare.accounts.push(" + JSON.stringify(CF_OTHER) + "); }";

test("a cloudflare login keeps an account another process saved after this one read the config", () => {
  const home = homeHolding({ cloudflare: { accounts: [CF_ONE] } });
  const after = raced(home, {
    imports: CLOUDFLARE,
    meanwhile: ADDS_OTHER,
    write: "await cloudflare([\"login\", \"--name\", \"new\", \"--account-id\", \"acct-new\", \"--token\", \"cf-new\"]);",
  });
  assert.deepEqual(after.cloudflare.accounts.map((one) => one.name).sort(), ["new", "one", "other"]);
});

test("a cloudflare --forget keeps an account another process saved after this one read the config", () => {
  const home = homeHolding({ cloudflare: { accounts: [CF_ONE] } });
  const after = raced(home, {
    imports: CLOUDFLARE,
    meanwhile: ADDS_OTHER,
    write: "await cloudflare([\"login\", \"--forget\", \"one\"]);",
  });
  assert.deepEqual(after.cloudflare.accounts, [CF_OTHER]);
});

const GOOGLE = `const accounts = await import(${SRC("tools/services/google/auth/accounts.mjs")});`;
const G_ONE = { kind: "service", email: "one@example.test" };
const G_OTHER = { kind: "login", email: "other@example.test" };
const ADDS_G_OTHER = "(now) => { now.google.accounts.other = " + JSON.stringify(G_OTHER) + "; }";

test("saving a google account keeps one another process saved after this one read the config", () => {
  const home = homeHolding({ google: { accounts: { one: G_ONE }, default: "one" } });
  const after = raced(home, {
    imports: GOOGLE,
    meanwhile: ADDS_G_OTHER,
    write: "accounts.saveAccount(\"new\", { kind: \"service\" }, { client_email: \"new@example.test\" });",
  });
  assert.deepEqual(Object.keys(after.google.accounts).sort(), ["new", "one", "other"]);
  assert.deepEqual(after.google.accounts.other, G_OTHER);
  assert.equal(after.google.default, "one", "the default the file held is kept");
});

test("updating a google account keeps one another process saved after this one read the config", () => {
  const home = homeHolding({ google: { accounts: { one: G_ONE }, default: "one" } });
  const after = raced(home, {
    imports: GOOGLE,
    meanwhile: ADDS_G_OTHER,
    write: "accounts.updateAccount(\"one\", { scopes: [\"drive\"] });",
  });
  assert.deepEqual(after.google.accounts.other, G_OTHER);
  assert.deepEqual(after.google.accounts.one, { ...G_ONE, scopes: ["drive"] });
});

test("removing a google account keeps one another process saved after this one read the config", () => {
  const home = homeHolding({ google: { accounts: { one: G_ONE }, default: "one" } });
  const after = raced(home, {
    imports: GOOGLE,
    meanwhile: ADDS_G_OTHER,
    write: "accounts.removeAccount(\"one\");",
  });
  assert.deepEqual(after.google.accounts, { other: G_OTHER });
  assert.equal(after.google.default, null);
});

test("switching a hook off keeps one another process switched off after this one read the config", () => {
  const home = homeHolding({ hooksOff: [] });
  const after = raced(home, {
    imports: `const { setHook } = await import(${SRC("hooks/hook-switch.mjs")});`,
    meanwhile: "(now) => { now.hooksOff.push(\"learning-gate\"); }",
    write: "setHook(\"bash-guard\", true);",
  });
  assert.deepEqual(after.hooksOff, ["bash-guard", "learning-gate"]);
});

test("hiding a verb keeps one another process hid after this one read the config", () => {
  const home = homeHolding({ withheld: {} });
  const after = raced(home, {
    imports: `const { MACHINE_WRITES } = await import(${SRC("tools/doctor-keys.mjs")});`,
    meanwhile: "(now) => { now.withheld.coolify = \"hidden\"; }",
    write: "MACHINE_WRITES.find((row) => row.flags.includes(\"hide\")).write({ hide: \"cloudflare\" });",
  });
  assert.deepEqual(after.withheld, { cloudflare: "hidden", coolify: "hidden" });
});

test("a borrowing home refuses a cloudflare login, writes nothing and leaves no lock", () => {
  const machine = homeHolding({ cloudflare: { accounts: [CF_ONE] } });
  const home = homeHolding({});
  const borrowed = join(machine, "forge", "config.json");
  const run = spawnSync(FORGE, ["cloudflare", "login", "--name", "new", "--account-id", "acct-new", "--token", "cf-new"],
    { env: envFor(home, { FORGE_BORROW_FROM: borrowed }), cwd: neutralRoom(), encoding: "utf8" });
  assert.equal(run.status, 1, `${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /`cloudflare\.accounts` is borrowed from/u, run.stderr);
  assert.ok(run.stderr.includes(borrowed), run.stderr);
  assert.deepEqual(heldIn(home), {}, "the run home's config gains no account");
  assert.equal(existsSync(join(home, "forge", "config.json.lock")), false, "and the write's lock is released");
});
