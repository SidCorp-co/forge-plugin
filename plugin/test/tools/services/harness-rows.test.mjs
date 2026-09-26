/* Which level each harness row answers, state by state. None of the three credentials gates another verb — every one of them can be absent and every other verb still works — so each absence is a note and none of these rows is ever a miss. The row shape is the report's own, shared with the project's half, which is what lets a harness row say `miss` at all; that it says none today is the policy, and this is where a change to the shape would lose it by accident (ISS-1046, ISS-102). */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

/* A config of this suite's own, and the imports after it: the config path is resolved once when `resolve/config.mjs` loads, so on the developer's machine this would otherwise read four live tokens and a live gateway profile. */
const HOME = tempRoom("harness-rows-home-");
mkdirSync(join(HOME, "forge"));
writeFileSync(join(HOME, "forge", "config.json"), JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "t", retrySeconds: 0 }));
process.env.XDG_CONFIG_HOME = HOME;

const { harnessLines } = await import("../../../src/tools/services/doctor/harness.mjs");
const { userConfig } = await import("../../../src/resolve/config.mjs");

/* The same write `saveConfig` makes, without the file: it assigns into the memoised object, so a reader called after this sees what a `forge doctor --chatgpt-key` in the same process would have left. */
const configured = (values) => {
  for (const key of ["cloudflare", "coolify", "coolifyRoute", "chatgpt", "codex", "vi"]) delete userConfig()[key];
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

const levelOf = async (label, values = {}) => {
  configured(values);
  return (await harnessLines(false)).find((row) => row.label === label).level;
};

test("every harness row is a row of the report's own vocabulary, with no second one beside it", async () => {
  profiled(WHOLE_PROFILE);
  configured({});
  const rows = await harnessLines(false);
  assert.deepEqual(rows.map((row) => row.label), ["cloudflare", "coolify", "google", "codex", "chatgpt",
    "codex url", "codex key", "vi-natural url", "vi-natural key", "vi-natural model",
    "chatgpt url", "chatgpt key", "chatgpt framing", "anthropic key", "anthropic endpoint"]);
  for (const row of rows) {
    assert.ok(["ok", "note", "miss"].includes(row.level), `${row.label} answered the level ${row.level}`);
    assert.equal(row.ok, undefined, `${row.label} still carries a boolean beside its level`);
    assert.equal(typeof row.detail, "string");
  }
});

const detailOf = async (label, values = {}) => {
  configured(values);
  return (await harnessLines(false)).find((row) => row.label === label).detail;
};

/* The instance route is the one a saved credential is about, so every case below that is about the
   credential chooses it: on the other route the absence of one is not an absence of anything. */
const INSTANCE = { coolifyRoute: "instance",
  coolify: { url: "https://coolify.example", apiToken: "tok-abcdefghij" } };

test("the coolify row is a note with no instance and an ok with one, and never shows the token", async () => {
  profiled(WHOLE_PROFILE);
  assert.equal(await levelOf("coolify", { coolifyRoute: "instance" }), "note");
  assert.match(await detailOf("coolify", { coolifyRoute: "instance" }), /forge coolify login/u);
  assert.equal(await levelOf("coolify", INSTANCE), "ok");
  const said = await detailOf("coolify", INSTANCE);
  assert.match(said, /https:\/\/coolify\.example/u);
  assert.ok(!said.includes("tok-abcdefghij"), "the row printed the token");
  assert.match(said, /set \(14 chars\)/u);
});

/* That half of the row is read off files and never off the instance: a request there would report a
   network fault as a missing credential, and this directory is not a pinned checkout. */
test("the coolify row says which project this directory is pinned to, or that none is", async () => {
  profiled(WHOLE_PROFILE);
  assert.match(await detailOf("coolify", INSTANCE), /no project pinned/u);
  assert.match(await detailOf("coolify", INSTANCE), /in \S*projects[/\\]\S+[/\\]config\.json — forge coolify pin/u,
    "the row names the record a pin would be read from and the command that writes one");
});

test("the coolify row names the way that answers and where it was read", async () => {
  profiled(WHOLE_PROFILE);
  const chosen = await detailOf("coolify", INSTANCE);
  assert.match(chosen, /^the saved instance {2}← .*forge[/\\]config\.json/u,
    "the way, and the file that said so rather than the command that writes it");
  const fallen = await detailOf("coolify", {});
  assert.match(fallen, /^the tracker's own bindings {2}← the plugin's default/u,
    "and with nothing chosen the default is named as a default rather than as a file");
  assert.match(fallen, /the tracker did not answer for them/u,
    "a tracker that could not be reached is said to be, never read back as a project bound to nothing");
});

test("the cloudflare row is a note with no account and an ok with one", async () => {
  profiled(WHOLE_PROFILE);
  assert.equal(await levelOf("cloudflare"), "note");
  assert.equal(await levelOf("cloudflare", {
    cloudflare: { accounts: [{ name: "one", accountId: "a", apiToken: "t" }] },
  }), "ok");
});

test("the codex row is a note at each of its three bad readings, and never a miss", async () => {
  profiled(null);
  assert.equal(await levelOf("codex"), "note", "no gateway profile at all");
  profiled("ANTHROPIC_BASE_URL=https://gateway.example");
  assert.equal(await levelOf("codex"), "note", "a profile that is there and omits a key it declares");
  profiled(WHOLE_PROFILE.split("\n").slice(0, 2).join("\n"));
  assert.equal(await levelOf("codex"), "note", "a profile that maps the model slot to nothing");
  profiled(WHOLE_PROFILE);
  assert.equal(await levelOf("codex"), "ok");
});

/* The verb-level row exists only to say the verb went, so once both halves are saved it is gone and
   the two key rows below carry the values: two rows saying `held` would be the second answer. */
test("the chatgpt row is a note while either half is absent and is gone once both are saved", async () => {
  profiled(WHOLE_PROFILE);
  assert.equal(await levelOf("chatgpt"), "note", "neither half");
  assert.equal(await levelOf("chatgpt", { chatgpt: { url: "https://gpt.example/mcp" } }), "note", "an endpoint with no key");
  assert.equal(await levelOf("chatgpt", { chatgpt: { key: "k" } }), "note", "a key with no endpoint");
  configured({ chatgpt: { url: "https://gpt.example/mcp", key: "k" } });
  assert.equal((await harnessLines(false)).find((row) => row.label === "chatgpt"), undefined);
});

test("each half a store is missing is a row of its own naming the flag that writes it", async () => {
  profiled(WHOLE_PROFILE);
  configured({});
  assert.equal(await detailOf("chatgpt url"), "no endpoint — `forge doctor --chatgpt-url <endpoint>`");
  assert.equal(await detailOf("chatgpt key"), "no key — `forge doctor --chatgpt-key <key>`");
  assert.equal(await detailOf("chatgpt"),
    "no endpoint and no key — `forge doctor --chatgpt-url <endpoint> --chatgpt-key <key>`"
    + ", so `forge chatgpt` is in no help");
});

/* The framing is the value a caller set and not a credential, so it is reported whole where the key beside it is masked; the row is its own because a framing runs to whatever length somebody wrote. */
test("the framing row is a note naming the flag while none is saved, and reports the value once one is", async () => {
  profiled(WHOLE_PROFILE);
  configured({});
  const absent = (await harnessLines(false)).find((row) => row.label === "chatgpt framing");
  assert.equal(absent.level, "note");
  assert.match(absent.detail, /forge doctor --chatgpt-prefix <framing>/u);
  configured({ chatgpt: { prefix: "Flat vector, no text." } });
  const held = (await harnessLines(false)).find((row) => row.label === "chatgpt framing");
  assert.equal(held.level, "ok");
  assert.equal(held.detail, `Flat vector, no text.  ← ${join(HOME, "forge", "config.json")}`);
});

/* The pair is read once, where the other machine-level settings are read, and answers the file that
   answered for it — which is what every other setting in that report already does (AC-01-3-1). */
test("the chatgpt endpoint and key come off one reader that names the file they came from", async () => {
  const { chatgptSettings, CHATGPT_KEYS } = await import("../../../src/resolve/machine/stores.mjs");
  configured({});
  const absent = chatgptSettings();
  assert.deepEqual({ url: absent.url, key: absent.key, from: absent.from }, { url: null, key: null, from: null },
    "nothing saved is answered as nothing, with no file claimed for it");
  assert.deepEqual(absent.missing, CHATGPT_KEYS, "and both rows are the ones a refusal names its flags off");
  assert.equal(absent.prefix, null, "and the framing beside them answers as nothing too");
  configured({ chatgpt: { url: "https://gpt.example/mcp", key: "k", prefix: "Flat vector." } });
  const held = chatgptSettings();
  assert.equal(held.url, "https://gpt.example/mcp");
  assert.equal(held.key, "k");
  assert.equal(held.prefix, "Flat vector.");
  assert.equal(held.from, join(HOME, "forge", "config.json"), "the file that answered, not merely that one did");
  assert.deepEqual(held.missing, []);
});

/* The one level a harness row reaches that the report's exit code counts, and the only store that
   ever reaches it: a project declaring Vietnamese prose cannot post without that gateway. */
test("a store named as required answers miss where it is unset, and note where it is not named", async () => {
  profiled(WHOLE_PROFILE);
  configured({});
  const required = await harnessLines(false, ["vi"]);
  for (const label of ["vi-natural url", "vi-natural key", "vi-natural model"]) {
    assert.equal(required.find((row) => row.label === label).level, "miss", label);
  }
  assert.equal(required.find((row) => row.label === "chatgpt url").level, "note",
    "a store the caller did not name is a note in the same reading");
  assert.equal((await harnessLines(false)).find((row) => row.label === "vi-natural url").level, "note");
});
