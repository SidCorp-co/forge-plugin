/* Which level each harness row answers, state by state. None of the three credentials gates another verb — every one of them can be absent and every other verb still works — so each absence is a note and none of these rows is ever a miss. The row shape is the report's own, shared with the project's half, which is what lets a harness row say `miss` at all; that it says none today is the policy, and this is where a change to the shape would lose it by accident (ISS-1046, ISS-102). */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

/* A config of this suite's own, and the imports after it: the config path is resolved once when `resolve/config.mjs` loads, so on the developer's machine this would otherwise read four live tokens and a live gateway profile. */
const HOME = tempRoom("harness-rows-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t" }));
process.env.XDG_CONFIG_HOME = HOME;

const { harnessLines } = await import("../../../src/tools/services/doctor-harness.mjs");
const { userConfig } = await import("../../../src/resolve/config.mjs");

/* The same write `saveConfig` makes, without the file: it assigns into the memoised object, so a reader called after this sees what a `forge doctor --chatgpt-key` in the same process would have left. */
const configured = (values) => {
  for (const key of ["cloudflare", "chatgpt", "codex"]) delete userConfig()[key];
  Object.assign(userConfig(), values);
};

const WHOLE_PROFILE = [
  "ANTHROPIC_BASE_URL=https://gateway.example",
  "ANTHROPIC_AUTH_TOKEN=proxy-token",
  "ANTHROPIC_DEFAULT_FABLE_MODEL=cx/some-model",
].join("\n");

/* The profile is a file the external shim owns, named by an environment variable, so each of its readings is reachable from here without a home of its own. */
const profiled = (text) => {
  const path = join(HOME, `proxy-${text === null ? "absent" : text.length}.env`);
  if (text !== null) writeFileSync(path, text);
  process.env.CLAUDE_PROXY_ENV = path;
};

const levelOf = (label, values = {}) => {
  configured(values);
  return harnessLines(false).find((row) => row.label === label).level;
};

test("every harness row is a row of the report's own vocabulary, with no second one beside it", () => {
  profiled(WHOLE_PROFILE);
  configured({});
  const rows = harnessLines(false);
  assert.deepEqual(rows.map((row) => row.label), ["cloudflare", "codex", "chatgpt"]);
  for (const row of rows) {
    assert.ok(["ok", "note", "miss"].includes(row.level), `${row.label} answered the level ${row.level}`);
    assert.equal(row.ok, undefined, `${row.label} still carries a boolean beside its level`);
    assert.equal(typeof row.detail, "string");
  }
});

test("the cloudflare row is a note with no account and an ok with one", () => {
  profiled(WHOLE_PROFILE);
  assert.equal(levelOf("cloudflare"), "note");
  assert.equal(levelOf("cloudflare", {
    cloudflare: { accounts: [{ name: "one", accountId: "a", apiToken: "t" }] },
  }), "ok");
});

test("the codex row is a note at each of its three bad readings, and never a miss", () => {
  profiled(null);
  assert.equal(levelOf("codex"), "note", "no gateway profile at all");
  profiled("ANTHROPIC_BASE_URL=https://gateway.example");
  assert.equal(levelOf("codex"), "note", "a profile that is there and omits a key it declares");
  profiled(WHOLE_PROFILE.split("\n").slice(0, 2).join("\n"));
  assert.equal(levelOf("codex"), "note", "a profile that maps the model slot to nothing");
  profiled(WHOLE_PROFILE);
  assert.equal(levelOf("codex"), "ok");
});

test("the chatgpt row is a note while either half is absent and an ok once both are saved", () => {
  profiled(WHOLE_PROFILE);
  assert.equal(levelOf("chatgpt"), "note", "neither half");
  assert.equal(levelOf("chatgpt", { chatgpt: { url: "https://gpt.example/mcp" } }), "note", "an endpoint with no key");
  assert.equal(levelOf("chatgpt", { chatgpt: { key: "k" } }), "note", "a key with no endpoint");
  assert.equal(levelOf("chatgpt", { chatgpt: { url: "https://gpt.example/mcp", key: "k" } }), "ok");
});

test("the chatgpt row names the flag that writes each half it is missing, and never types one", () => {
  profiled(WHOLE_PROFILE);
  configured({});
  const { detail } = harnessLines(false).find((row) => row.label === "chatgpt");
  assert.equal(detail, "no endpoint — `forge doctor --chatgpt-url <endpoint>`  no key — `forge doctor --chatgpt-key <key>`");
});

/* The pair is read once, where the other machine-level settings are read, and answers the file that
   answered for it — which is what every other setting in that report already does (AC-01-3-1). */
test("the chatgpt endpoint and key come off one reader that names the file they came from", async () => {
  const { chatgptSettings, CHATGPT_KEYS } = await import("../../../src/resolve/settings.mjs");
  configured({});
  const absent = chatgptSettings();
  assert.deepEqual({ url: absent.url, key: absent.key, from: absent.from }, { url: null, key: null, from: null },
    "nothing saved is answered as nothing, with no file claimed for it");
  assert.deepEqual(absent.missing, CHATGPT_KEYS, "and both rows are the ones a refusal names its flags off");
  configured({ chatgpt: { url: "https://gpt.example/mcp", key: "k" } });
  const held = chatgptSettings();
  assert.equal(held.url, "https://gpt.example/mcp");
  assert.equal(held.key, "k");
  assert.equal(held.from, join(HOME, "forge", "config.json"), "the file that answered, not merely that one did");
  assert.deepEqual(held.missing, []);
});
