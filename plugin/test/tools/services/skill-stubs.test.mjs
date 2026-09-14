/* The surface the help's filter cannot reach: what the session host reads off disk. The two homes are
   set before the imports for the same reason `tool-config.test.mjs` sets them, and every write case
   builds a whole fake install — record, copy and skills — because what is being held is which
   directory a write may land in. docs/cli/an-unconfigured-tool.md. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempRoom } from "../../fixtures.mjs";

const BARE = tempRoom("skill-stubs-bare-");
process.env.XDG_CONFIG_HOME = BARE;
process.env.CLAUDE_PROXY_ENV = join(BARE, "absent.env");

const { SHIPPED, STUB, shippedProblems, stubFor, stubRows, writeStubs } =
  await import("../../../src/tools/services/skill-stubs.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const FORGE_STUB = readFileSync(join(PLUGIN, "skills", "forge", STUB), "utf8");
const FLOW_STUB = readFileSync(join(PLUGIN, "skills", "issue-flow", STUB), "utf8");

/* The description as it stood before it was laid out one tool to a line, which is the whole of what a
   machine that configured everything may not lose. */
const BEFORE_TOOLS = ["cloudflare", "coolify", "codex"];
const BEFORE_PHRASES = ["Forge", "tracker", "backlog", "ISS-nn", `"file an issue"`, `"what's open"`,
  "Cloudflare", "DNS record", "zone", "purge cache", "Coolify", "deploy", "redeploy",
  `"restart the app"`, `"is it running"`, `"second opinion"`, `"review this plan"`, "codex"];

const OWNED = {
  cloudflare: ["zones, DNS records and cache purges", "DNS record", "zone", "purge cache"],
  coolify: ["a pinned project's deployments", "deploy", "redeploy", `"restart the app"`,
    `"is it running"`],
  codex: ["a review of this turn's documents", `"second opinion"`, `"review this plan"`],
};

const descriptionLines = (text) => {
  const lines = text.split("\n");
  const at = lines.findIndex((one) => one.startsWith("description:"));
  const out = [];
  for (let i = at + 1; i < lines.length && !/^[A-Za-z]/u.test(lines[i]) && lines[i] !== "---"; i += 1) {
    out.push(lines[i]);
  }
  return out;
};

const description = (text) => descriptionLines(text).join(" ");

test("a machine that saved nothing for a tool is given a description naming it nowhere", () => {
  for (const verb of BEFORE_TOOLS) {
    const { text, dropped } = stubFor(FORGE_STUB, [verb]);
    assert.deepEqual(dropped, [verb]);
    assert.ok(!new RegExp(`\\b${verb}\\b`, "iu").test(description(text)), `${verb} is still named`);
  }
});

test("a tool that is configured keeps every word of its own while another's go", () => {
  for (const verb of BEFORE_TOOLS) {
    const said = description(stubFor(FORGE_STUB, [verb]).text);
    for (const phrase of OWNED[verb]) assert.ok(!said.includes(phrase), `${phrase} survived ${verb}`);
    for (const other of BEFORE_TOOLS.filter((one) => one !== verb)) {
      for (const phrase of OWNED[other]) assert.ok(said.includes(phrase), `${other} lost ${phrase}`);
    }
  }
});

test("a machine that configured everything is given the file this copy ships", () => {
  assert.equal(stubFor(FORGE_STUB, []).text, FORGE_STUB);
  assert.deepEqual(stubFor(FORGE_STUB, []).dropped, []);
});

test("the shipped description still names every tool and carries every trigger it carried", () => {
  const said = description(FORGE_STUB);
  for (const verb of BEFORE_TOOLS) assert.ok(new RegExp(`\\b${verb}\\b`, "iu").test(said), verb);
  for (const phrase of BEFORE_PHRASES) assert.ok(said.includes(phrase), `lost ${phrase}`);
});

test("a droppable line carries only the material of the tool it names", () => {
  const all = descriptionLines(FORGE_STUB);
  for (const verb of BEFORE_TOOLS) {
    const kept = descriptionLines(stubFor(FORGE_STUB, [verb]).text);
    const gone = all.filter((one) => !kept.includes(one));
    assert.ok(gone.length, `${verb} owns no line`);
    for (const line of gone) {
      for (const other of BEFORE_TOOLS.filter((one) => one !== verb)) {
        for (const phrase of OWNED[other]) {
          assert.ok(!line.includes(phrase), `${verb}'s line would take ${other}'s ${phrase}`);
        }
      }
    }
  }
});

test("no tool's material sits on a line that does not name it", () => {
  for (const [verb, phrases] of Object.entries(OWNED)) {
    for (const phrase of phrases) {
      for (const line of descriptionLines(FORGE_STUB).filter((one) => one.includes(phrase))) {
        assert.ok(new RegExp(`\\b${verb}\\b`, "iu").test(line),
          `${phrase} sits on a line naming no ${verb}: ${line}`);
      }
    }
  }
});

test("a stub whose description names no tool is left exactly as shipped", () => {
  assert.equal(stubFor(FLOW_STUB, BEFORE_TOOLS).text, FLOW_STUB);
  assert.deepEqual(stubFor(FLOW_STUB, BEFORE_TOOLS).dropped, []);
});

const install = (name, { marketplace = false, record = true } = {}) => {
  const room = tempRoom(`skill-stubs-${name}-`);
  const copy = join(room, "copy");
  mkdirSync(join(copy, ".claude-plugin"), { recursive: true });
  writeFileSync(join(copy, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "forge", version: "1" }));
  mkdirSync(join(copy, "skills", "forge"), { recursive: true });
  writeFileSync(join(copy, "skills", "forge", STUB), FORGE_STUB);
  if (marketplace) {
    mkdirSync(join(room, ".claude-plugin"), { recursive: true });
    writeFileSync(join(room, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ plugins: [{ name: "forge", source: "copy" }] }));
  }
  const held = join(room, "installed_plugins.json");
  writeFileSync(held, JSON.stringify({ plugins: { "forge@x": [{ version: "1", installPath: record ? copy : join(room, "elsewhere") }] } }));
  return { room, copy, record: held, stub: join(copy, "skills", "forge", STUB) };
};

const nothingSaved = ["cloudflare", "coolify", "codex", "chatgpt"];

test("the copy the install record names is written, and the pristine text kept beside it", () => {
  const at = install("write");
  const written = writeStubs(at.copy, at.record);
  assert.deepEqual(written, [{ slug: "forge", dropped: ["cloudflare", "coolify", "codex"] }]);
  const held = readFileSync(at.stub, "utf8");
  assert.equal(held, stubFor(FORGE_STUB, nothingSaved).text);
  assert.equal(readFileSync(join(at.copy, "skills", "forge", SHIPPED), "utf8"), FORGE_STUB);
});

/* Spawned: `userConfig` memoises on its first call, so what this machine has saved is one process's
   answer and a case about configuring a tool is a case about a second session. */
const writeIn = (copy, record, home) => spawnSync(process.execPath, ["--input-type=module", "-e",
  `const { writeStubs } = await import(${JSON.stringify(new URL("../../../src/tools/services/skill-stubs.mjs", import.meta.url).href)});`
  + ` console.log(JSON.stringify(writeStubs(${JSON.stringify(copy)}, ${JSON.stringify(record)})));`],
{ encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: join(home, "absent.env") } });

test("a tool configured after its words went has them back at the next start", () => {
  const at = install("restore");
  assert.match(writeIn(at.copy, at.record, BARE).stdout, /cloudflare/u);
  assert.notEqual(readFileSync(at.stub, "utf8"), FORGE_STUB);
  const saved = tempRoom("skill-stubs-saved-");
  mkdirSync(join(saved, "forge"), { recursive: true });
  writeFileSync(join(saved, "forge", "config.json"), JSON.stringify({
    cloudflare: { accounts: [{ name: "one", accountId: "a", apiToken: "t" }] },
  }));
  assert.deepEqual(JSON.parse(writeIn(at.copy, at.record, saved).stdout),
    [{ slug: "forge", dropped: ["coolify", "codex"] }]);
  assert.ok(description(readFileSync(at.stub, "utf8")).includes("purge cache"));
});

test("a copy inside a checkout that ships this plugin is not written, record or no record", () => {
  const at = install("checkout", { marketplace: true });
  assert.deepEqual(writeStubs(at.copy, at.record), []);
  assert.equal(readFileSync(at.stub, "utf8"), FORGE_STUB);
  assert.throws(() => readFileSync(join(at.copy, "skills", "forge", SHIPPED), "utf8"));
});

test("a copy the install record does not name is not written", () => {
  const at = install("stranger", { record: false });
  assert.deepEqual(writeStubs(at.copy, at.record), []);
  assert.equal(readFileSync(at.stub, "utf8"), FORGE_STUB);
});

test("a stub that is a symlink out of the copy is not written through", () => {
  const at = install("symlink");
  const outside = join(at.room, "outside.md");
  writeFileSync(outside, FORGE_STUB);
  unlinkSync(at.stub);
  symlinkSync(outside, at.stub);
  assert.deepEqual(writeStubs(at.copy, at.record), []);
  assert.equal(readFileSync(outside, "utf8"), FORGE_STUB);
  assert.throws(() => readFileSync(join(at.copy, "skills", "forge", SHIPPED), "utf8"));
});

test("a pristine file that is a dangling symlink out of the copy creates nothing", () => {
  const at = install("dangling");
  const outside = join(at.room, "outside.md");
  symlinkSync(outside, join(at.copy, "skills", "forge", SHIPPED));
  assert.deepEqual(writeStubs(at.copy, at.record), []);
  assert.throws(() => readFileSync(outside, "utf8"));
  assert.equal(readFileSync(at.stub, "utf8"), FORGE_STUB);
});

test("a field after the description is not taken for description text", () => {
  const text = `---\nname: forge\ndescription: >-\n  Drive it.\n  Also on Cloudflare.\n"meta": cloudflare\n_note: cloudflare\n---\n`;
  const { text: out } = stubFor(text, ["cloudflare"]);
  assert.ok(out.includes(`"meta": cloudflare`));
  assert.ok(out.includes("_note: cloudflare"));
  assert.ok(!out.includes("Also on Cloudflare."));
});

test("the report names what is out of the description on disk, not what this machine would drop", () => {
  const at = install("stale");
  writeFileSync(at.stub, stubFor(FORGE_STUB, ["coolify", "codex"]).text);
  writeFileSync(join(at.copy, "skills", "forge", SHIPPED), FORGE_STUB);
  const [row] = stubRows({ dir: at.copy });
  assert.match(row.detail, /^forge — coolify, codex out of its description/u);
});

test("the report names a stub this machine took words out of, and says nothing where none went", () => {
  const at = install("rows");
  assert.deepEqual(stubRows({ dir: at.copy }), []);
  writeStubs(at.copy, at.record);
  const [row] = stubRows({ dir: at.copy });
  assert.match(row.detail, /^forge — cloudflare, coolify, codex out of its description/u);
  assert.equal(row.label, "skill stub");
});

test("the session whose start wrote a stub is told the text it holds predates the write", () => {
  const at = install("session");
  mkdirSync(join(at.room, ".claude", "plugins"), { recursive: true });
  writeFileSync(join(at.room, ".claude", "plugins", "installed_plugins.json"),
    readFileSync(at.record, "utf8"));
  const ran = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const { linkCli } = await import(${JSON.stringify(new URL("../../../src/hooks/link-cli.mjs", import.meta.url).href)});`
    + ` linkCli(${JSON.stringify(at.copy)});`],
  { encoding: "utf8", env: { ...process.env, HOME: at.room, XDG_CONFIG_HOME: BARE } });
  assert.match(ran.stdout, /forge's description no longer names cloudflare, coolify, codex/u);
  assert.match(ran.stdout, /this one holds the text from before that write/u);
  assert.notEqual(readFileSync(at.stub, "utf8"), FORGE_STUB);
});

test("a description no machine could vary is a finding, and this copy ships none", () => {
  assert.deepEqual(shippedProblems(PLUGIN), []);
  const at = install("flat");
  writeFileSync(at.stub, "---\nname: forge\ndescription: Drive a tracker, and cloudflare zones.\n---\n");
  assert.deepEqual(shippedProblems(at.copy),
    ["forge's description names cloudflare on its own key line, where no machine can drop it"
      + " — put each tool's words on continuation lines of their own"]);
});
