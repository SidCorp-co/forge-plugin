/* A job declares the methods it uses beside the verbs, and this is the second list: what the bulk
   write puts in the key of its own, what the one surface allowed to say a thing is missing reports,
   and the two things a withheld skill does not do. The in-process block below is the third of those
   — the part a verb that acts prints goes on being printed, which no spawned call reaches without a
   tracker. docs/cli/a-job.md. ISS-1412. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { tempHome, tempRoom } from "../../fixtures.mjs";

const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

const HOME = tempHome("withheld-skill");
mkdirSync(join(HOME.path, "forge"), { recursive: true });
writeFileSync(join(HOME.path, "forge", "config.json"), JSON.stringify({
  url: "https://stub.example/mcp", token: "t", withheldSkills: ["issue-flow"],
}));
process.env.XDG_CONFIG_HOME = HOME.path;

const { localRows, localSlugs, visibleGuides } = await import("../../../src/guides/guides.mjs");
const { partForStatus } = await import("../../../src/guides/served.mjs");
const { skillRefusal } = await import("../../../src/resolve/visibility.mjs");

const VERBS = ["issue", "new", "comment", "next"];
const SKILLS = ["forge", "vi-natural"];

/* A port nothing listens on, refused at once: every spawned case here is answered before the endpoint. */
const room = (jobs, held = {}) => {
  const home = tempRoom("doctor-skills-");
  mkdirSync(join(home, "forge"));
  const at = join(home, "forge", "config.json");
  writeFileSync(at, JSON.stringify({
    url: "http://127.0.0.1:1/mcp", token: "saved-token", retrySeconds: 0, waitSeconds: 0.05, ...held,
  }));
  const cwd = tempRoom("doctor-skills-cwd-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: "skills-fixture", jobs }));
  const run = (...argv) => spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8", cwd, env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { run, saved: () => JSON.parse(readFileSync(at, "utf8")) };
};

const withSkills = { ba: { verbs: VERBS, skills: SKILLS } };

test("one call withholds every skill the job does not name, beside the verbs it does not name", () => {
  const { run, saved } = room(withSkills);
  const wrote = run("doctor", "--job", "ba");
  assert.match(wrote.stdout, /17 verb\(s\) and 8 skill\(s\) off/u, wrote.stderr);
  const held = saved().withheldSkills;
  for (const slug of SKILLS) assert.ok(!held.includes(slug), `${slug} is the job's and is offered`);
  for (const slug of ["issue-flow", "dispatch", "harness-eval"]) {
    assert.ok(held.includes(slug), `${slug} is outside the job and is withheld`);
  }
});

test("a job declaring no skills leaves every shipped skill offered", () => {
  const { run, saved } = room({ ba: VERBS });
  run("doctor", "--job", "ba");
  assert.deepEqual(saved().withheldSkills, [],
    "a bare array declares no skills, and a job declaring none offers all of them");
  assert.doesNotMatch(run("doctor").stdout, /skills off/u,
    "a machine withholding no skill is told nothing about skills");
});

test("an empty skills list is the empty set, where an absent one is every skill", () => {
  const { run, saved } = room({ ba: { verbs: VERBS, skills: [] } });
  run("doctor", "--job", "ba");
  assert.equal(saved().withheldSkills.length, 10,
    "absent means undecided and `[]` means decided against, which is how a role with no method is written");
  assert.doesNotMatch(run("doctor").stdout, /skills on/u, "and nothing is left under the offered row");
});

test("a withheld skill is refused before the flag that would read the tracker for it", () => {
  const { run } = room(withSkills, { withheldSkills: ["issue-flow"] });
  const refused = run("guide", "issue-flow", "--for", "ISS-123");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /the issue-flow skill is off on this machine/u,
    "the refusal comes before the fetch, or an unreachable tracker answers for the withholding");
  assert.doesNotMatch(refused.stderr, /fetch failed/u);
});

test("turning off whatever job is on leaves no skill withheld", () => {
  const { run, saved } = room(withSkills);
  run("doctor", "--job", "ba");
  const cleared = run("doctor", "--job", "all");
  assert.match(cleared.stdout, /Every verb and skill this machine withheld is offered again/u);
  assert.deepEqual(saved().withheldSkills, []);
});

test("a job naming a skill this copy does not ship is refused before anything is written", () => {
  const { run, saved } = room({ ba: { verbs: VERBS, skills: ["forge", "wishful"] } });
  const refused = run("doctor", "--job", "ba");
  assert.equal(refused.status, 1, refused.stdout);
  assert.match(refused.stderr, /names wishful, which this copy ships no skill for/u);
  assert.equal(saved().withheldSkills, undefined, "nothing was written, the verbs included");
  assert.equal(saved().withheld, undefined);
});

test("the report names every shipped skill under its state, and which withheld one it offers nowhere", () => {
  const { run } = room(withSkills);
  run("doctor", "--job", "ba");
  const said = run("doctor").stdout;
  assert.match(said, /skills off\s+audit-code-quality, dispatch, gate-review, harness-eval, issue-flow, qa, release-flow, setup-code-quality/u);
  assert.match(said, /skills on\s+forge, vi-natural/u);
  assert.match(said, /audit-code-quality, setup-code-quality are withheld from nothing else, this copy serving no guide for them/u,
    "the report claims no reach it has not: this CLI offers a skill through `forge guide` and nowhere else");
});

test("a job is named only where this machine stands at the whole of its complement", () => {
  const { run } = room({ ba: { verbs: VERBS, skills: SKILLS }, other: { verbs: VERBS, skills: ["forge"] } });
  run("doctor", "--job", "ba");
  const said = run("doctor").stdout;
  assert.match(said, /job\s+ba is the declared job this machine's withholding matches/u,
    "two jobs with one verb list are told apart by the skills they declare");
  assert.doesNotMatch(said, /\bother is the declared job\b/u);
});

test("a shipped skill every declared job leaves out is reported as offered to nobody", () => {
  const { run } = room({ ba: { verbs: VERBS, skills: ["forge"] } });
  assert.match(run("doctor").stdout, /no declared job names .*vi-natural.*, so no job offers them/u);
  const some = room({ ba: { verbs: VERBS, skills: ["forge"] }, pm: VERBS });
  assert.doesNotMatch(some.run("doctor").stdout, /so no job offers/u,
    "one job still declaring nothing offers every skill, so nothing is yet offered to nobody");
});

test("a withheld skill is unlisted, refused by name, and its phase part is served all the same", () => {
  assert.ok(!localSlugs().includes("issue-flow"), "`forge guide` offers no withheld skill");
  assert.ok(localSlugs().includes("contract"), "the contract is not a skill and is untouched");
  assert.ok(!localRows().some((row) => row.startsWith("issue-flow")), "and prints no row for one");
  assert.match(skillRefusal("issue-flow"),
    /^the issue-flow skill is off on this machine.*`forge doctor --job all` offers it again\.$/u);
  assert.deepEqual(visibleGuides(["issue-flow", "deploy-safety"]), ["deploy-safety"],
    "the tracker's own listing drops the name too, the verb refusing that word whatever would answer it");
  const said = [];
  partForStatus("approved", (part) => said.push(part));
  assert.equal(said.length, 1,
    "the part a verb that acts prints belongs to a verb the job granted, and a job withholds a method rather than half-breaking one");
});
