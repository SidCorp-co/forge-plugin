/* Three states over the one key this machine keeps: `on` listed and served, `hidden` unlisted and
   still served, `off` unlisted and refused on every route into the verb. What is watched here is
   that `off` reaches the typed word and the forms as well as the raw route, that `hidden` is left
   exactly as it was, and that a list of names an older release wrote is read as the second of those.
   docs/cli/withholding-a-verb.md. ISS-1258. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { fakeTracker, projectRoom, ranAsync, tempRoom } from "../../../fixtures.mjs";
import { VERB_NAMES } from "../../../../src/resolve/visibility.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

const BA = ["issue", "new", "comment", "next"];
const SLUG = "off-fixture";

/* Every harness tool saved and a gateway profile beside them, because a tool this machine holds no
   configuration for is unlisted too and these cases are about the other reason: a room that saved
   none of them would make `nothing withheld` a room with four verbs missing. tool-config.test.mjs
   owns that state; docs/cli/an-unconfigured-tool.md holds the division. */
const TOOLS = {
  cloudflare: { accounts: [{ name: "one", accountId: "acct", apiToken: "cf" }] },
  coolify: { url: "https://coolify.example", apiToken: "co" },
  chatgpt: { url: "https://chatgpt.example/mcp", key: "gpt" },
  google: { accounts: { robot: { kind: "service", clientEmail: "robot@example.iam.gserviceaccount.com", keyId: "k" } }, default: "robot" },
};

/* A port nothing listens on, refused at once: every case here is answered before the endpoint. */
const room = (held = {}, jobs = { ba: BA }) => {
  const home = tempRoom("doctor-off-");
  mkdirSync(join(home, "forge"));
  mkdirSync(join(home, ".claude"));
  writeFileSync(join(home, ".claude", "claude-proxy.env"),
    "ANTHROPIC_BASE_URL=https://gateway.example\nANTHROPIC_AUTH_TOKEN=tok\n");
  const at = join(home, "forge", "config.json");
  writeFileSync(at, JSON.stringify({
    url: "http://127.0.0.1:1/mcp", token: "saved-token", retrySeconds: 0, waitSeconds: 0.05,
    ...TOOLS, ...held,
  }));
  const cwd = projectRoom(tempRoom("doctor-off-cwd-"), home, { slug: "off-fixture", jobs });
  const run = (...argv) => spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8", cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, CLAUDE_PROXY_ENV: "" },
  });
  return { run, saved: () => JSON.parse(readFileSync(at, "utf8")) };
};

const atJob = () => {
  const held = room();
  held.run("doctor", "--job", "ba");
  return held;
};

test("a verb this machine turned off is refused when it is typed, and runs nothing", () => {
  const { run } = atJob();
  const typed = run("record");
  assert.equal(typed.status, 1, typed.stdout);
  assert.equal(typed.stdout, "", "nothing was printed, so nothing behind the verb ran");
  assert.match(typed.stderr, /is off on this machine/u, typed.stderr);
});

test("the refusal names the verb, the state and the one command that clears it", () => {
  const { run } = atJob();
  const said = run("record").stderr.trim();
  assert.equal(said.split("\n").length, 1, said);
  assert.match(said, /^`forge record` is off on this machine/u, said);
  assert.match(said, /`forge doctor --show record` offers it again/u, said);
  assert.doesNotMatch(said, /contract payload|kind/u, "and volunteers nothing about what it would do");
});

test("a form performed through an off verb is refused before the verb behind it runs", () => {
  const { run } = atJob();
  const said = run("close", "ISS-45");
  assert.equal(said.status, 1, said.stdout);
  assert.equal(said.stdout, "");
  assert.match(said.stderr, /^`forge advance` is off on this machine/u, said.stderr);
  assert.doesNotMatch(said.stderr, /^forge: read /mu, "the line a form prints when it runs one");
});

test("help on an off verb is refused rather than served", () => {
  const { run } = atJob();
  const helped = run("record", "-h");
  assert.equal(helped.status, 1, helped.stdout);
  assert.equal(helped.stdout, "", "an off verb's help is not a surface either");
});

test("a verb hidden one at a time still runs when it is typed", () => {
  const { run } = room();
  assert.match(run("doctor", "--hide", "stats").stdout, /stats is now hidden from the usage list/u);
  const typed = run("stats", "-h");
  assert.equal(typed.status, 0, typed.stderr);
  assert.match(typed.stdout, /^Usage: forge stats/u, typed.stdout);
});

test("the usage list carries no row for a verb in either state", () => {
  const { run } = atJob();
  run("doctor", "--show", "stats");
  run("doctor", "--hide", "stats");
  const usage = run("-h").stdout;
  assert.doesNotMatch(usage, /^ {2}stats\s/mu, "hidden, so no row");
  assert.doesNotMatch(usage, /^ {2}record\s/mu, "off, so no row either");
  assert.match(usage, /^ {2}issue\s/mu, "while a verb the job offers is there");
});

test("a bare list of names an earlier release wrote reads as hidden throughout", () => {
  const outside = VERB_NAMES.filter((verb) => !BA.includes(verb) && verb !== "doctor");
  const { run } = room({ withheld: outside });
  const typed = run("record", "-h");
  assert.equal(typed.status, 0, typed.stderr);
  assert.match(typed.stdout, /^Usage: forge record/u,
    "the list is exactly the ba job's complement and still nothing in it is refused");
  assert.doesNotMatch(run("-h").stdout, /^ {2}record\s/mu, "unlisted, which is what it always was");
});

test("the report names every verb under the state it is in", () => {
  const { run } = atJob();
  run("doctor", "--hide", "stats");
  const said = run("doctor").stdout;
  assert.match(said, /\[ {2}ok {2}\] verbs off\s+.*\brecord\b/u, said);
  assert.match(said, /\[ {2}ok {2}\] verbs hidden\s+stats —/u, said);
  assert.match(said, /\[ {2}ok {2}\] verbs on\s+issue, new, comment, next, doctor —/u, said);
  const clean = room().run("doctor").stdout;
  assert.doesNotMatch(clean, /\[ {2}ok {2}\] verbs /u, "and says none of it where nothing is withheld");
});

test("the one key carries both states, and each flag writes its own", () => {
  const { run, saved } = atJob();
  assert.equal(saved().withheld.record, "off", "a job turns every verb outside it off");
  assert.equal(saved().withheld.issue, undefined, "and a verb it offers has no entry at all");
  run("doctor", "--hide", "record");
  assert.equal(saved().withheld.record, "hidden", "hiding by hand writes over the job's state");
  run("doctor", "--show", "record");
  assert.equal(saved().withheld.record, undefined, "showing drops the entry whichever state it held");
  assert.equal(run("record", "-h").status, 0, "and the verb is served again");
  run("doctor", "--job", "all");
  assert.deepEqual(saved().withheld, {}, "and `all` drops every entry, off and hidden alike");
});

test("a bare list is written over with the states the first time a flag writes", () => {
  const { run, saved } = room({ withheld: ["stats", "codex"] });
  run("doctor", "--hide", "alike");
  assert.deepEqual(saved().withheld, { stats: "hidden", codex: "hidden", alike: "hidden" },
    "the list an older release left is read into the states and written back as them");
});

/* An empty stdout says a verb printed nothing, not that it did nothing, and the difference is the
   whole of what this issue closes: a tracker that counts what reaches it is what separates them. */
const wired = async () => {
  const state = {
    declared: ["forge_issues"],
    issues: [],
    answer: {
      forge_guide: () => ({ guides: [] }),
      "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-00000000027d" }] }),
    },
  };
  const tracker = await fakeTracker(state);
  const cwd = projectRoom(tempRoom("doctor-off-wired-"), tracker.env.XDG_CONFIG_HOME,
    { slug: SLUG, jobs: { ba: BA } });
  return {
    state,
    close: tracker.close,
    ran: (...argv) => ranAsync(process.execPath, [CLI, ...argv], tracker.env, cwd),
  };
};

test("an off verb and a form through one reach the tracker with nothing, while a hidden verb still does", async (t) => {
  const { state, ran, close } = await wired();
  t.after(close);
  {
    await ran("doctor", "--job", "ba");
    await ran("doctor", "--hide", "issue");
    state.calls = [];
    const off = await ran("record", "confirmation", "ISS-45", "--where", "w", "--is", "i", "--finding", "holds");
    assert.equal(off.status, 1, off.stdout);
    assert.deepEqual(state.calls, [], "the off verb refused before it asked the tracker anything");
    const form = await ran("close", "ISS-45");
    assert.equal(form.status, 1, form.stdout);
    assert.deepEqual(state.calls, [], "and so did the word performed through it");
    const hidden = await ran("issue", "--limit", "1");
    assert.equal(hidden.status, 0, hidden.stderr);
    assert.ok(state.calls.length, "while a hidden verb ran and reached the tracker as it always did");
  }
});
