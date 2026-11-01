/* The judge's form of the brief: the deployment and the criteria, and none of a builder's readings. */
import assert from "node:assert/strict";
import test from "node:test";

import { runIdAt } from "../../src/resolve/session/run-id.mjs";
import { brief, homeFor, repository } from "./fixture.mjs";

const repo = repository();

const judged = (args) => brief(["ISS-7", "--judge", ...args], repo.main, homeFor().env);

const refused = (run, pattern) => {
  assert.notEqual(run.status, 0, run.stdout);
  assert.equal(run.stdout, "", "a refused brief prints nothing to send");
  assert.match(run.stderr, pattern);
};

test("the judge's brief names the issue, its role, every deployed address, the identity and the criteria", () => {
  const run = judged(["--url", "https://staging.example.com,https://api.example.com", "--criteria", "1,3", "--identity", "794dc78"]);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.stdout.trim().split("\n"), [
    "Target: ISS-7, criteria 1, 3 — judge these and write nothing else.",
    "Role: judge",
    "Deployed at: https://staging.example.com, https://api.example.com",
    "Identity: 794dc78",
    "Criteria: 1, 3",
    "Tree: none",
  ]);
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
  assert.deepEqual(run.stdout.trim().split("\n"), [
    "Target: ISS-7, criteria 1, 2 — judge these and write nothing else.",
    "Role: judge",
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

test("FB-26: a --program that is no single token is refused naming it", () => {
  refused(judged(["--program", "forge runner", "--criteria", "1"]), /--program takes the path or name/u);
});
