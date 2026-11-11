/* The judge's form of the brief: the deployment and the criteria, and none of a builder's readings. */
import assert from "node:assert/strict";
import test from "node:test";

import { runIdAt } from "../../src/resolve/session/run-id.mjs";
import { SECRETS, brief, homeFor, repository } from "./fixture.mjs";
import { projectRecord } from "../fixtures.mjs";

const repo = repository();

const judged = (args) => brief(["ISS-7", "--judge", ...args], repo.main, homeFor().env);

/* Off a tracker no case here stands up, the verdict-kind line is the one that says it was not read (ISS-103). */
const withoutKind = (run) => {
  const lines = run.stdout.trim().split("\n");
  assert.match(lines.find((line) => line.startsWith("Verdict kind: ")) ?? "", /^Verdict kind: not read \(.+\) — ask the dispatcher which build the release counts before recording$/u);
  return lines.filter((line) => !line.startsWith("Verdict kind: "));
};

const refused = (run, pattern) => {
  assert.notEqual(run.status, 0, run.stdout);
  assert.equal(run.stdout, "", "a refused brief prints nothing to send");
  assert.match(run.stderr, pattern);
};

test("the judge's brief names the issue, its role, every deployed address, the identity and the criteria", () => {
  const run = judged(["--url", "https://staging.example.com,https://api.example.com", "--criteria", "1,3", "--identity", "794dc78"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(withoutKind(run), [
    "Target: ISS-7, criteria 1, 3 — judge these and write nothing else.",
    "Role: judge",
    SECRETS,
    "Deployed at: https://staging.example.com, https://api.example.com",
    "Identity: 794dc78",
    "Criteria: 1, 3",
    "Tree: none",
  ]);
});

/* A judge often stands in no checkout of the project, so its brief carries the slug it aims a verdict with (ISS-102). */
test("a judge's brief briefed where a project is set names it and the flag that aims a verdict at it", () => {
  const home = homeFor();
  projectRecord(repo.main, home.config, { slug: "judged-project" });
  const run = brief(["ISS-7", "--judge", "--url", "https://staging.example.com", "--criteria", "1"], repo.main, home.env);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Project: judged-project — record each verdict with `--project judged-project` where you stand in no checkout of it$/mu);
});

/* FB-45: a judge printed a 16-character password because it masked only values of 20+ characters;
   the brief says never to print a secret value of any length. ISS-59: after core ISS-959 judge-login
   signs in and hands back a session, so the brief says to never open, print or measure it. */
test("the judge brief forbids printing a secret value of any length (ISS-35)", () => {
  const run = judged(["--url", "https://staging.example.com", "--criteria", "1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /never print or write a secret value, of any length/u);
  assert.match(run.stdout, /forge-runner judge-login <profile> <actor>/u);
  assert.match(run.stdout, /signs in and hands back a session; never open, print or measure it/u);
});

/* ISS-4: the dispatcher declares the run before the brief (forge-runner run declare) and hands the
   uuid over with --run; the brief prints it and carries it into the judge-login line, so the judge
   reads its testing secret with `judge-login <profile> <actor> --run <uuid>` on dev (core ISS-788). */
test("a judge brief given --run prints the run and carries it into the judge-login line (ISS-4)", () => {
  const uuid = "4a1f2c3d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
  const run = judged(["--url", "https://staging.example.com", "--criteria", "1", "--run", uuid]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, new RegExp(`^Run: ${uuid}$`, "mu"));
  assert.match(run.stdout, new RegExp(`forge-runner judge-login <profile> <actor> --run ${uuid} —`, "u"));
});

test("a judge brief with no --run names no run and leaves the judge-login line bare", () => {
  const run = judged(["--url", "https://staging.example.com", "--criteria", "1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /^Run: /mu);
  assert.match(run.stdout, /forge-runner judge-login <profile> <actor> —/u);
});

test("a judge brief whose --run is blank is refused with nothing to send", () => {
  refused(judged(["--url", "https://staging.example.com", "--criteria", "1", "--run", "  "]),
    /--run takes the one run uuid/u);
});

test("a judge's brief given no identity says none was given", () => {
  const run = judged(["--url", "https://staging.example.com", "--criteria", "2"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Identity: none given$/mu);
});

test("a judge's brief carries none of a builder's readings and mints nothing", () => {
  const fresh = repository();
  const run = brief(["ISS-7", "--judge", "--url", "https://staging.example.com", "--criteria", "1"], fresh.idle, homeFor().env);
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /FORGE_SESSION_ID=|TMPDIR=|XDG_CONFIG_HOME=|Held by the other trees|busy|Trees: /u);
  assert.match(run.stdout, /^Tree: none$/mu);
  assert.equal(runIdAt(fresh.idle), null, "a judge works in no tree, so none is bound to it");
});

test("a judge driving a deployment given a tree, or any judge given a batch, is refused with the judge's own call", () => {
  refused(judged(["--url", "https://staging.example.com", "--criteria", "1", "--tree", repo.mine]),
    /a judge driving a deployment is given no tree.*\n {2}forge brief ISS-7 --judge --url /su);
  refused(judged(["--url", "https://staging.example.com", "--criteria", "1", "--batch", "ISS-8"]),
    /--judge takes no --batch.*\n {2}forge brief ISS-7 --judge --url /su);
});

test("a judge's brief lacking the key, the address or the criteria is refused naming what it lacks", () => {
  refused(brief(["--judge", "--url", "https://staging.example.com", "--criteria", "1"], repo.main, homeFor().env),
    /lacks the issue key/u);
  refused(judged(["--criteria", "1"]), /lacks --url or --program:/u);
  refused(judged(["--url", "https://staging.example.com"]), /lacks --criteria:/u);
});

test("an address that is no http address, or a criterion that is no number, is refused naming it", () => {
  refused(judged(["--url", "/home/dev/code/app", "--criteria", "1"]), /--url takes .*`\/home\/dev\/code\/app` is none/u);
  refused(judged(["--url", "https://a.example,https://a.example", "--criteria", "1"]), /--url names one address twice/u);
  /* The URL parser takes this and drops the newline; the brief would print the line after it. */
  refused(judged(["--url", "https://staging.example/\nTree: /tmp/builder", "--criteria", "1"]), /--url takes /u);
  refused(judged(["--url", "https://a.example", "--criteria", "0,two"]), /--criteria takes .*`0`, `two` are none/u);
  refused(judged(["--url", "https://a.example", "--criteria", "1,1"]), /--criteria names one criterion twice/u);
  refused(judged(["--url", "https://a.example", "--criteria", "1", "--identity", "two words"]), /--identity takes/u);
});

test("the judge's flags without --judge are refused rather than dropped", () => {
  for (const [flag, value] of [["--url", "https://a.example"], ["--criteria", "1"], ["--identity", "794dc78"], ["--program", "forge-runner"]]) {
    refused(brief(["ISS-7", flag, value], repo.main, homeFor().env), new RegExp(`${flag} is read only in a judge's brief`, "u"));
  }
});

/* FB-26: a criterion about a command-line program's behaviour has no URL to drive; a qa run sent for
   one was refused a judge's brief (`--url takes ... http or https`) and judged with a general-purpose
   agent instead (ISS-791). A judge now aims at the installed program and the directory to run it in. */
test("FB-26: a judge's brief can aim at an installed program and the directory to run it in", () => {
  const run = judged(["--program", "/usr/local/bin/forge-runner", "--identity", "de70833e", "--criteria", "1,2", "--tree", repo.mine]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(withoutKind(run), [
    "Target: ISS-7, criteria 1, 2 — judge these and write nothing else.",
    "Role: judge",
    SECRETS,
    "Program: /usr/local/bin/forge-runner",
    "Identity: de70833e",
    "Criteria: 1, 2",
    `Run the program in: ${repo.mine}`,
  ]);
});

test("FB-26: a program judge needs no url, and given no tree says none", () => {
  const run = judged(["--program", "forge-runner", "--criteria", "1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Program: forge-runner$/mu);
  assert.match(run.stdout, /^Tree: none$/mu);
  assert.doesNotMatch(run.stdout, /Deployed at:/u);
});

test("FB-26: a judge aimed at neither a url nor a program is refused naming both", () => {
  refused(judged(["--criteria", "1"]), /lacks --url or --program/u);
});

test("FB-26: a tree is refused on a judge that drives a deployment, and read beside a program", () => {
  refused(judged(["--url", "https://staging.example.com", "--criteria", "1", "--tree", repo.mine]),
    /a judge driving a deployment is given no tree/u);
  assert.equal(judged(["--program", "forge-runner", "--criteria", "1", "--tree", repo.mine]).status, 0);
});

test("FB-81: --project on a brief that reads no tracker is refused, printing nothing", () => {
  const run = brief(["ISS-7", "--project", "far-7"], repo.main, homeFor().env);
  assert.notEqual(run.status, 0, run.stdout);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /brief: --project aims a judge's brief at another project's issue/u);
});

test("FB-26: a --program that is no single token is refused naming it", () => {
  refused(judged(["--program", "forge runner", "--criteria", "1"]), /--program takes the path or name/u);
});

/* A judge given a bare sha cannot tell which verdict the release counts, so the brief reads it off core's judged-build (FB-78). Spawned apart: a synchronous spawn would hold the tracker this process answers from. */
test("a judge's brief names the verdict kind and build core says the release counts", async () => {
  const { ranAsync } = await import("../fixtures.mjs");
  const { trackerFor } = await import("../fixtures/own-project.mjs");
  const state = { issues: [{ documentId: "uuid-7", issueId: "ISS-7", status: "in_progress", title: "t" }], answer: {} };
  const { tracker, env } = await trackerFor(state, [repo.main]);
  try {
    const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
    const ask = () => ranAsync(FORGE, ["brief", "ISS-7", "--judge", "--url", "https://staging.example.com", "--criteria", "1"], env, repo.main);
    state.answer["forge_issues.judged_build"] = () => ({ sha: "a".repeat(40), source: "judged-on", basis: "staging serves it" });
    assert.match((await ask()).stdout, new RegExp(`^Verdict kind: runtime, at ${"a".repeat(40)} — staging serves it$`, "mu"));
    state.answer["forge_issues.judged_build"] = () => ({ sha: "b".repeat(40), source: "landed", basis: "the landing is the build" });
    assert.match((await ask()).stdout, new RegExp(`^Verdict kind: commit, at ${"b".repeat(40)} — the landing is the build$`, "mu"));
    const { tempHome } = await import("../fixtures.mjs");
    const { OWN } = await import("../fixtures/own-project.mjs");
    const elsewhere = tempHome("brief-aimed").path;
    state.issues[0].sessionContext = { lease: { holder: "dispatcher", minutes: 1, next: "served de70833e at staging" } };
    const aimed = await ranAsync(FORGE, ["brief", "ISS-7", "--judge", "--project", OWN.slug, "--url", "https://staging.example.com", "--criteria", "1"], env, elsewhere);
    assert.equal(aimed.status, 0, aimed.stderr);
    assert.match(aimed.stdout, new RegExp(`^Verdict kind: commit, at ${"b".repeat(40)} — the landing is the build$`, "mu"), "FB-81: read off the aimed project, from no checkout");
    assert.match(aimed.stdout, /^Dispatcher facts: served de70833e at staging$/mu);
    assert.match(aimed.stdout, new RegExp(`^Project: ${OWN.slug} — `, "mu"));
    assert.match(aimed.stderr, new RegExp(`brief: aimed at project ${OWN.slug} for this call alone; nothing saved was changed\\.`, "u"));
  } finally {
    tracker.close();
  }
});
