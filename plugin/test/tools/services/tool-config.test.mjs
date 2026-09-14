/* The fourth question `offeredVerbs` asks, over every surface that reads its answer. Spawned rather
   than imported for the surfaces, because what is being held is what a session on a bare machine
   sees; the two homes are set together, the gateway profile living under one and the rest under the
   other. docs/cli/an-unconfigured-tool.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;
const TOOLS = ["cloudflare", "coolify", "codex", "chatgpt"];

const BARE = tempRoom("tool-config-bare-");
const SAVED = tempRoom("tool-config-saved-");
const PROFILE = join(SAVED, "claude-proxy.env");

/* The two homes before the imports: every reader here resolves its path once as the module loads,
   so a case reading the planted references in this process would otherwise read the developer's own
   gateway and find codex configured. The spawned cases carry their own and are unaffected. */
process.env.XDG_CONFIG_HOME = BARE;
process.env.CLAUDE_PROXY_ENV = join(BARE, "absent.env");

const { VERB_NAMES } = await import("../../../src/resolve/visibility.mjs");
const { skillGuideAnswer } = await import("../../../src/guides/skill-guides.mjs");
const { DEFAULT } = await import("../../../src/guides/flow.mjs");

mkdirSync(join(SAVED, "forge"), { recursive: true });
writeFileSync(join(SAVED, "forge", "config.json"), JSON.stringify({
  url: "http://127.0.0.1:1/mcp",
  token: "t",
  cloudflare: { accounts: [{ name: "one", accountId: "acct", apiToken: "cf" }] },
  coolify: { url: "https://coolify.example", apiToken: "co" },
  chatgpt: { url: "https://chatgpt.example/mcp", key: "gpt" },
}));
writeFileSync(PROFILE, "ANTHROPIC_BASE_URL=https://gateway.example\nANTHROPIC_AUTH_TOKEN=tok\n");

const ask = (home, profile, ...argv) => spawnSync(FORGE, argv, {
  encoding: "utf8",
  env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: profile },
});

const bare = (...argv) => ask(BARE, join(BARE, "absent.env"), ...argv);
const saved = (...argv) => ask(SAVED, PROFILE, ...argv);

test("a tool this machine saved nothing for is in no usage line and no row", () => {
  const said = bare("-h").stdout;
  const usage = said.split("\n")[0];
  for (const verb of TOOLS) {
    assert.ok(!usage.includes(`|${verb}|`), `${verb} is still in the usage line: ${usage}`);
    assert.doesNotMatch(said, new RegExp(`^ {2}${verb}[ <]`, "mu"), `${verb} still has a row`);
  }
});

test("a machine that saved every one of them sees the verbs it saw before", () => {
  const said = saved("-h").stdout;
  const usage = said.split("\n")[0];
  for (const verb of VERB_NAMES) {
    assert.ok(usage.includes(`<${verb}|`) || usage.includes(`|${verb}|`) || usage.includes(`|${verb}>`),
      `${verb} left the usage line: ${usage}`);
  }
});

test("the verb typed still runs and refuses in its own words", () => {
  const run = bare("cloudflare", "zones");
  assert.notEqual(run.status, 0, "an unusable verb still fails");
  assert.match(`${run.stdout}${run.stderr}`, /No Cloudflare account is configured/u,
    "the verb's own refusal, not a refusal about being hidden");
  assert.match(`${run.stdout}${run.stderr}`, /forge cloudflare login/u, "and the way back");
});

test("doctor names each unconfigured tool with the one thing that configures it", () => {
  const said = bare("doctor").stdout;
  const configures = {
    cloudflare: "forge cloudflare login",
    coolify: "forge coolify login",
    codex: "ANTHROPIC_AUTH_TOKEN",
    chatgpt: "forge doctor --chatgpt-url",
  };
  for (const verb of TOOLS) {
    const row = said.split("\n").find((line) => line.includes(`] ${verb} `));
    assert.ok(row, `no row for ${verb}`);
    assert.ok(row.includes(configures[verb]), `${verb}'s row does not say what configures it: ${row}`);
  }
});

/* The collision this change had to avoid: the report computed `on` as *no entry under the
   withholding key*, so a verb hidden for any other reason printed there while being absent from the
   help. The claim is the equality, in both directions, on a machine where something is hidden. */
test("every verb the report calls on is a verb the help offers, and every other is under a state", () => {
  const said = bare("doctor").stdout;
  const rows = said.split("\n").filter((line) => /\] verbs \S+ /u.test(line));
  assert.ok(rows.length > 1, `the state rows did not print: ${rows.join("|")}`);
  const under = (state) => (rows.find((line) => line.includes(`] verbs ${state} `)) ?? "")
    .split("—")[0].split("  ").filter(Boolean).at(-1)
    .split(", ")
    .map((one) => one.trim())
    .filter(Boolean);
  const offered = bare("-h").stdout.split("\n")[0].replace(/^Usage: forge </u, "").split(">")[0].split("|");
  assert.deepEqual(under("on").sort(), [...offered].sort(), "verbs on is exactly what the help offers");
  assert.deepEqual(under("unconfigured").sort(), [...TOOLS].sort());
  assert.deepEqual([...under("on"), ...under("unconfigured")].sort(), [...VERB_NAMES].sort(),
    "and no verb of the table is in neither row");
});

test("a reference wholly about an unconfigured tool is unlisted, and named directly names what configures it", () => {
  const listed = bare("guide", "forge").stdout;
  for (const verb of ["cloudflare", "coolify", "codex"]) {
    assert.doesNotMatch(listed, new RegExp(`^ {2}${verb} `, "mu"), `${verb} is still listed: ${listed}`);
  }
  assert.match(listed, /^ {2}dependencies /mu, "a reference about no tool is still listed");
  const asked = bare("guide", "forge", "codex");
  assert.notEqual(asked.status, 0);
  assert.match(asked.stderr, /ANTHROPIC_AUTH_TOKEN/u, "and the refusal says what configures it");
  assert.match(saved("guide", "forge", "codex").stdout, /answers as a different model/u,
    "while a machine that saved one is served the text");
});

test("the method text sends no run to a consult it cannot take", () => {
  const three = bare("guide", "issue-flow", "3").stdout;
  assert.doesNotMatch(three, /forge codex\s+consult/u, "phase 3 names no consult to take");
  assert.match(three, /forge doctor/u, "and points at the one surface that says what is missing");
  assert.match(three, /refuse a file no consult has read/u, "while the write's demand is not relaxed");
  assert.doesNotMatch(bare("guide", "issue-flow", "4").stdout, /forge codex consult --recheck/u);
  assert.match(saved("guide", "issue-flow", "3").stdout, /forge codex\s+consult -h/u,
    "and a machine that saved a gateway is told to take one");
});

/* Read before it dispatches, so a reader that throws takes down every verb and not only its own.
   A directory is the cheap way to make `existsSync` true and the read fail. */
test("a profile path that cannot be read hides codex and leaves every other verb standing", () => {
  const room = tempRoom("tool-config-unreadable-");
  const asDir = join(room, "a-directory");
  mkdirSync(asDir, { recursive: true });
  const help = ask(BARE, asDir, "-h");
  assert.equal(help.status, 0, `forge -h died on an unreadable profile: ${help.stderr}`);
  assert.ok(!help.stdout.split("\n")[0].includes("|codex|"), "and codex is unlisted");
  assert.match(help.stdout, /^ {2}issue /mu, "while a verb that is nobody's tool still has its row");
  const report = ask(BARE, asDir, "doctor");
  assert.match(report.stdout, /\] codex {2}/u, "and the one surface that may say so still reaches its row");
  assert.doesNotMatch(report.stderr, /EISDIR|Error:/u, `doctor threw instead: ${report.stderr}`);
});

const plant = (files) => {
  const root = tempRoom("tool-config-refs-");
  const dir = join(root, "guides", "skills", "alpha", DEFAULT, "references");
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return root;
};

/* Planted rather than shipped: every reference this copy ships is fenced whole, so a walk over them
   cannot tell "renders to nothing" from "names a tool" and would pass either way. */
test("only a reference that renders to nothing goes, and a fence written wrong still refuses", () => {
  const root = plant({
    "whole.md": "<!-- forge:when tool.codex configured -->\n# Whole\n<!-- forge:end -->\n",
    "part.md": "# Part\n\nStill here.\n\n<!-- forge:when tool.codex configured -->\nGone.\n<!-- forge:end -->\n",
    "other.md": "<!-- forge:when tool.codex unconfigured -->\n# The branch for this machine\n<!-- forge:end -->\n",
    "wrong.md": "<!-- forge:when tool.codex configured -->\n# No closer\n",
  });
  const answer = skillGuideAnswer("alpha", root, DEFAULT);
  const listed = answer().lines.join("\n");
  assert.doesNotMatch(listed, /^ {2}whole /mu, "the one that renders to nothing is unlisted");
  for (const name of ["part", "other", "wrong"]) {
    assert.match(listed, new RegExp(`^ {2}${name} `, "mu"), `${name} is still listed`);
  }
  assert.match(answer({ part: "part" }).lines.join("\n"), /Still here/u, "and its remaining text serves");
  assert.match(answer({ part: "other" }).lines.join("\n"), /branch for this machine/u,
    "an unconfigured branch is the text this machine gets, not a reason to drop the file");
  assert.match(answer({ part: "wrong" }).refusal, /marked wrong/u,
    "and a mistyped fence is its own refusal, never read as a credential nobody saved");
});
