/* A job is the bulk write over the key `--hide` writes one verb at a time, and the whole risk is
   that it becomes a second switch: a stored name, a precedence rule, a report nobody can read. So
   what is watched here is that the key is the only state — replaced rather than added to, matched
   rather than attributed, and answered for by the one verb allowed to say a thing is missing.
   Which state a job writes is off.test.mjs's. docs/cli/a-job.md. ISS-1320, ISS-1258. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

const BA = ["issue", "new", "comment", "next"];
const PM = ["issue", "next"];

/* A port nothing listens on, refused at once: every case here is answered before the endpoint. */
const room = (project, held = {}) => {
  const home = tempRoom("doctor-job-");
  mkdirSync(join(home, "forge"));
  const at = join(home, "forge", "config.json");
  writeFileSync(at, JSON.stringify({
    url: "http://127.0.0.1:1/mcp", token: "saved-token", retrySeconds: 0, waitSeconds: 0.05, ...held,
  }));
  const cwd = tempRoom("doctor-job-cwd-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: "job-fixture", ...project }));
  const run = (...argv) => spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { run, saved: () => JSON.parse(readFileSync(at, "utf8")) };
};

const declared = { jobs: { ba: BA, pm: PM } };

test("one call replaces what this machine withholds with every verb the job does not offer", () => {
  const { run, saved } = room(declared, { withheld: ["issue", "guide"] });
  const wrote = run("doctor", "--job", "ba");
  assert.match(wrote.stdout, /The usage list is at the ba job/u, wrote.stderr);
  const withheld = saved().withheld;
  for (const verb of BA) {
    assert.equal(withheld[verb], undefined, `${verb} is the job's and is offered, not withheld`);
  }
  for (const verb of ["codex", "stats", "guide"]) {
    assert.equal(withheld[verb], "off",
      "every verb outside the job is turned off, whatever the machine held before the call");
  }
  assert.equal(withheld.issue, undefined,
    "the write replaces rather than adds, so a verb the job offers stops being withheld");
});

test("a job that names the report verb nowhere leaves it advertised all the same", () => {
  const { run } = room(declared);
  assert.ok(!PM.includes("doctor"), "the fixture job names it nowhere, which is the case under test");
  run("doctor", "--job", "pm");
  const usage = run("-h").stdout;
  assert.match(usage, /^Usage: forge <[^>]*\bdoctor\b/u,
    "a machine whose report verb went missing would have no surface left allowed to say what else did");
});

test("a job reopens no verb the credential or the project has closed", () => {
  const { run } = room({ ...declared, feedback: { plugin: "off" },
    jobs: { wide: ["issue", "knowledge", "feedback"] } }, {
    capabilities: { "job-fixture": { checkedAt: "2026-09-08T00:00:00.000Z", forge_knowledge: "not for this token" } },
  });
  run("doctor", "--job", "wide");
  const usage = run("-h").stdout;
  assert.doesNotMatch(usage, /^\s*knowledge\s/mu, "the credential's refusal still hides it");
  assert.doesNotMatch(usage, /^\s*feedback\s/mu, "and the project's closed channel still hides its verb");
  assert.match(usage, /^\s*issue\s/mu, "while a verb the job offers that nothing else withholds is there");
});

test("turning off whatever job is on leaves nothing withheld, hand-hidden verbs included", () => {
  const { run, saved } = room(declared);
  run("doctor", "--job", "ba");
  run("doctor", "--hide", "issue");
  assert.equal(saved().withheld.issue, "hidden", "hidden by hand on top of the job");
  const cleared = run("doctor", "--job", "all");
  assert.match(cleared.stdout, /including any verb hidden one at a time/u, cleared.stdout);
  assert.deepEqual(saved().withheld, {}, "and every entry goes, not only what the job wrote");
});

test("the report names every declared job and the project's own file as where they were read", () => {
  const { run } = room(declared);
  assert.match(run("doctor").stdout, /\[ {2}ok {2}\] jobs\s+ba, pm {2}← \.forge\.json/u);
});

test("the report names every declared job the withheld list matches, and says none matches where that is so", () => {
  const one = room(declared);
  one.run("doctor", "--job", "ba");
  assert.match(one.run("doctor").stdout,
    /\[ {2}ok {2}\] job\s+ba is the declared job this machine's withholding matches/u);

  const two = room({ jobs: { ba: BA, second: [...BA] } });
  two.run("doctor", "--job", "ba");
  assert.match(two.run("doctor").stdout,
    /\[ {2}ok {2}\] job\s+ba, second are the declared jobs/u,
    "two jobs offering the same verbs both match, and matching is all a derived answer claims");

  const three = room(declared);
  three.run("doctor", "--job", "ba");
  three.run("doctor", "--show", "codex");
  assert.match(three.run("doctor").stdout,
    /\[ {2}ok {2}\] job\s+no declared job matches what this machine withholds/u);

  const four = room(declared);
  four.run("doctor", "--job", "ba");
  four.run("doctor", "--show", "issue");
  assert.match(four.run("doctor").stdout,
    /\[ {2}ok {2}\] job\s+ba is the declared job/u,
    "showing a verb the job already offers changes the array not at all, so the match stands");
});

test("a checkout declaring no job is told nothing about jobs", () => {
  const { run } = room({});
  const said = run("doctor").stdout;
  assert.doesNotMatch(said, /\[ {2}ok {2}\] jobs?\s/u, "silent where the project has not decided");
});

test("a checkout declaring no job refuses the flag and names where a job is declared", () => {
  const { run, saved } = room({});
  const refused = run("doctor", "--job", "ba");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /no job is declared here/u);
  assert.match(refused.stderr, /`jobs` in the \.forge\.json at the root of this checkout/u);
  assert.equal(saved().withheld, undefined);
});

test("a name no declared job carries is refused with the nearest one", () => {
  const { run, saved } = room({ jobs: { ba: BA, delivery: PM } });
  const refused = run("doctor", "--job", "bo");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /No job named bo\. Did you mean: ba\?/u, refused.stderr);
  assert.equal(saved().withheld, undefined);
});

test("a job naming a word that is no verb is refused before anything is written", () => {
  const { run, saved } = room({ jobs: { odd: ["issue", "triage"] } }, { withheld: ["stats"] });
  const refused = run("doctor", "--job", "odd");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /the `odd` job in \.forge\.json names triage, which this CLI has no verb for/u);
  assert.deepEqual(saved().withheld, ["stats"], "and the refusal left the key exactly as it was");
});

test("a job flag beside a project flag is refused with neither store written", () => {
  const { run, saved } = room(declared);
  const ours = join(process.cwd(), ".forge.json");
  const held = JSON.parse(readFileSync(ours, "utf8")).runs;
  const refused = run("doctor", "--job", "ba", "--set", `runs=${held + 1}`);
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /`--set` writes the project's own record and `--job` writes this machine's/u);
  assert.equal(saved().withheld, undefined, "the machine's half was not written before the refusal");
  assert.equal(JSON.parse(readFileSync(ours, "utf8")).runs, held,
    "and the project's file is this checkout's own, untouched by a refused call in another");
});

test("the reserved name is reported rather than served, and still clears", () => {
  const { run, saved } = room({ jobs: { ba: BA, all: PM } });
  const said = run("doctor").stdout;
  assert.match(said, /\[ miss \] jobs\s+`all` is reserved/u, said);
  assert.doesNotMatch(said, /\[ {2}ok {2}\] jobs\s+ba, all/u, "and is offered nowhere");
  run("doctor", "--job", "ba");
  assert.ok(Object.keys(saved().withheld).length, "a job is on");
  run("doctor", "--job", "all");
  assert.deepEqual(saved().withheld, {}, "so `all` cleared rather than applying the declaration");
});
