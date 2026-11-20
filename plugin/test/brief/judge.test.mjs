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
  assert.match(run.stdout, /^Project: judged-project — record each verdict or decision with `--project judged-project` where you stand in no checkout of it$/mu);
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
    // cm:why on a project naming `delivery.judgedOn` a release counts the runtime whatever source judged-build fell back to (ISS-121)
    state.answer.forge_config = (args) => (args.action === "document" ? { declared: true, document: { delivery: { judgedOn: "staging" } } } : undefined);
    for (const source of ["judged-on", "live", "shipped"]) {
      state.answer["forge_issues.judged_build"] = () => ({ sha: "a".repeat(40), source, basis: "core's basis" });
      const onTesting = (await ask()).stdout;
      const counted = source === "judged-on" ? "" : "; this project's releases are judged on `staging` \\(delivery\\.judgedOn\\), so they count a runtime verdict";
      assert.match(onTesting, new RegExp(`^Verdict kind: runtime, at ${"a".repeat(40)} — core's basis${counted}$`, "mu"), source);
      assert.match(onTesting, new RegExp(`^Record with --runtime ${"a".repeat(40)} only, never --commit and --runtime together$`, "mu"), source);
      assert.doesNotMatch(onTesting, /--commit [0-9a-f]{40}/u, source);
    }
    state.answer.forge_config = (args) => (args.action === "document" ? { refused: "config read failed" } : undefined);
    assert.match((await ask()).stdout, /^Verdict kind: not read \(.*config read failed\) — ask the dispatcher/mu);
    state.answer.forge_config = (args) => (args.action === "document" ? { declared: false, document: null } : undefined);
    state.answer["forge_issues.judged_build"] = () => ({ sha: "b".repeat(40), source: "landed", basis: "the landing is the build" });
    const landed = (await ask()).stdout;
    assert.match(landed, new RegExp(`^Verdict kind: commit, at ${"b".repeat(40)} — the landing is the build$`, "mu"));
    assert.match(landed, new RegExp(`^Record with --commit ${"b".repeat(40)} only, never --commit and --runtime together$`, "mu"));
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

/* ISS-1259: forge-dev deploys every push, so a judge is often sent at a release head the environment
   has deployed past. Core's judged-build says whether the served build carries the change unchanged,
   and the brief says, per case, to judge it at the head or to stop, and how to judge it still (ISS-122). */
const HEAD = "c".repeat(40);
const LIVE = "d".repeat(40);
/* Core's basis ends with its served reading, `served.why`, as `judged-build.ts` joins them. */
const servedAnswer = (head, served) => () => {
  const over = { environment: "dev", touched: [], why: "core's reading", ...served };
  return { sha: head, source: "shipped", version: "0.4.0-dev.702", basis: `release 0.4.0-dev.702 shipped it; ${over.why}`, served: over };
};

const servedReader = async (state, room) => {
  const { ranAsync } = await import("../fixtures.mjs");
  const { trackerFor } = await import("../fixtures/own-project.mjs");
  const { tracker, env } = await trackerFor(state, [room]);
  const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
  const ask = async (wanted = /^(?:Served: |Record with |Judge it anyway: )/u) => {
    const run = await ranAsync(FORGE, ["brief", "ISS-7", "--judge", "--url", "https://dev.example.com", "--criteria", "1"], env, room);
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.split("\n").filter((line) => wanted.test(line));
  };
  return { tracker, ask };
};

const anyway = (head) => `Judge it anyway: at a build that carries this change unchanged, ${head} itself deployed, with a brief taken `
  + `there; or move each criterion out on the record at the close: forge advance ISS-7 --unmet '[{"criterion":<n>,"to":{"issue":"ISS-<n>"}}]'`;

const stop = "stop: record no verdict, and report it to the dispatcher";

test("a judge sent past a later deploy is told to judge a served build carrying the change unchanged, and to stop on any other", async () => {
  const state = { issues: [{ documentId: "uuid-7", issueId: "ISS-7", status: "in_progress", title: "t" }], answer: {} };
  const { tracker, ask } = await servedReader(state, repo.main);
  const answer = (served) => servedAnswer(HEAD, { sha: LIVE, ...served });
  try {
    state.answer["forge_issues.judged_build"] = answer({ carries: "unchanged" });
    assert.deepEqual(await ask(), [`Served: dev serves ${LIVE}, which carries this issue's change unchanged — judge what it serves, `
      + `record with --commit ${HEAD} only, never --commit and --runtime together, and name ${LIVE} and that it descends from ${HEAD} in --why`]);
    state.answer["forge_issues.judged_build"] = answer({ carries: "touched", touched: ["src/a.ts"] });
    assert.deepEqual(await ask(), [`Served: dev serves ${LIVE}, whose added commits change src/a.ts, of this issue's files; their lines were not `
      + `compared here (${HEAD.slice(0, 12)} is not in this checkout; fetch it, or brief from a git checkout of the project that holds `
      + `${HEAD.slice(0, 12)}) — ${stop}`, anyway(HEAD)]);
    state.answer["forge_issues.judged_build"] = answer({ carries: "not-descendant" });
    assert.deepEqual(await ask(), [`Served: dev serves ${LIVE}, which does not descend from ${HEAD} — ${stop}`, anyway(HEAD)]);
    state.answer["forge_issues.judged_build"] = answer({ carries: "unread" });
    assert.deepEqual(await ask(), [`Served: dev serves ${LIVE}, which Forge cannot show carries this issue's change unchanged — ${stop}`, anyway(HEAD)]);
    /* forge ISS-1357 and ISS-1358 were closed before they were judged, so the close `--unmet` rides had passed (ISS-122). */
    state.issues[0].status = "closed";
    assert.deepEqual(await ask(), [`Served: dev serves ${LIVE}, which Forge cannot show carries this issue's change unchanged — ${stop}`,
      `Judge it anyway: at a build that carries this change unchanged, ${HEAD} itself deployed, with a brief taken there; or, as ISS-7 is `
        + "already closed, record that its live verdict is left unjudged and why: forge record decision ISS-7 --decision "
        + `"live verdict left unjudged | <why no build can be judged> | <what would judge it>"`]);
  } finally {
    tracker.close();
  }
});

/* forge judge run 8555bf38: ISS-1371, 1357 and 1358 stopped on later appends to shared generated files
   and on edits to other sections of a shared file. The brief weighs lines, not files (ISS-122). */
test("a later append to a generated file or an edit elsewhere in the issue's file never stops the judge, and an edit to the issue's own lines does, naming file and commit", async () => {
  const { git, tempRoom } = await import("../fixtures.mjs");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const room = tempRoom("brief-lines-");
  git(room, "init", "-q", "-b", "main");
  const commit = (subject, files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(room, path, ".."), { recursive: true });
      writeFileSync(join(room, path), text);
    }
    git(room, "add", "--", ...Object.keys(files));
    git(room, "commit", "-qm", subject);
    return git(room, "rev-parse", "HEAD").stdout.trim();
  };
  const entry = (name, by) => `  "${name}": {\n    "by": "${by}"\n  }`;
  const base = commit("base", { ".gitattributes": "contracts.json linguist-generated\n", "src/a.ts": "export const one = 1;\nexport const two = 2;\n",
    "contracts.json": "{\n  \"one\": 1\n}\n", "card-changes.json": `{\n${entry("x", "ISS-1")}\n}\n` });
  const head = commit("feat: seven (ISS-7)", { "src/a.ts": "export const one = 1;\nexport const two = 2;\nexport const seven = 7;\n",
    "contracts.json": "{\n  \"one\": 1,\n  \"seven\": 7\n}\n", "card-changes.json": `{\n${entry("x", "ISS-1")},\n${entry("y", "ISS-7")}\n}\n` });
  const files = ["src/a.ts", "contracts.json", "card-changes.json"];
  const appended = commit("feat: eight (ISS-8)", { "src/a.ts": "export const one = 11;\nexport const two = 2;\nexport const seven = 7;\n",
    "contracts.json": "{\n  \"eight\": 8,\n  \"one\": 1,\n  \"seven\": \"7\"\n}\n",
    "card-changes.json": `{\n${entry("x", "ISS-1")},\n${entry("y", "ISS-7")},\n${entry("z", "ISS-8")}\n}\n` });
  const edited = commit("fix: seven is 77 (ISS-9)", { "src/a.ts": "export const one = 11;\nexport const two = 2;\nexport const seven = 77;\n" });
  const state = { issues: [{ documentId: "uuid-7", issueId: "ISS-7", status: "in_progress", title: "t" }], answer: {} };
  const { tracker, ask } = await servedReader(state, room);
  const kindLine = /^Verdict kind: /u;
  const filesConcluded = "the commits it adds change src/a.ts, contracts.json, card-changes.json, of this issue's changed files, so it does not carry this issue's change unchanged";
  try {
    state.answer["forge_issues.judged_build"] = servedAnswer(head, { sha: appended, carries: "touched", touched: files, why: filesConcluded });
    assert.deepEqual(await ask(), [`Served: dev serves ${appended}, which carries this issue's change unchanged (its added commits change no line `
      + "this issue's own commits made in src/a.ts, card-changes.json; contracts.json is generated (linguist-generated)) — judge what it "
      + `serves, record with --commit ${head} only, never --commit and --runtime together, and name ${appended} and that it descends from ${head} in --why`]);
    /* forge ISS-1357: the line above kept the build while this one repeated core's file reading that it does not carry the change (ISS-122). */
    assert.deepEqual(await ask(kindLine), [`Verdict kind: commit, at ${head} — release 0.4.0-dev.702 shipped it; the commits ${appended} adds change `
      + "src/a.ts, contracts.json, card-changes.json, of this issue's files, but none of this issue's lines outside generated contracts.json"]);
    state.answer["forge_issues.judged_build"] = servedAnswer(head, { sha: edited, carries: "touched", touched: files, why: filesConcluded });
    assert.deepEqual(await ask(), [`Served: dev serves ${edited}, whose added commits change lines this issue's own commits made: `
      + `src/a.ts in ${edited.slice(0, 12)} — ${stop}`, anyway(head)]);
    assert.deepEqual(await ask(kindLine), [`Verdict kind: commit, at ${head} — release 0.4.0-dev.702 shipped it; ${filesConcluded}`],
      "where the lines stop the judge, core's reading stands as it was");
    state.answer["forge_issues.judged_build"] = servedAnswer(head, { sha: base, carries: "touched", touched: files });
    const [behind] = await ask();
    assert.ok(behind.includes(`their lines were not compared here (${base.slice(0, 12)} does not descend from ${head.slice(0, 12)} here; `
      + `fetch both, or brief from a git checkout of the project that holds ${base.slice(0, 12)}) — `), behind);
  } finally {
    tracker.close();
  }
});

/* forge qa run 22c4f613: briefed off any git checkout, or off any checkout of the project, the brief named
   why nothing was read and not where a reading could be taken (ISS-122). */
test("off any git checkout the stop names the checkout to brief from, and off the project's checkouts the kind names --project", async () => {
  const { ranAsync, tempHome } = await import("../fixtures.mjs");
  const { OWN, trackerFor } = await import("../fixtures/own-project.mjs");
  const state = { issues: [{ documentId: "uuid-7", issueId: "ISS-7", status: "in_progress", title: "t" }],
    answer: { "forge_issues.judged_build": servedAnswer(HEAD, { sha: LIVE, carries: "touched", touched: ["src/a.ts"] }) } };
  const { tracker, env } = await trackerFor(state);
  const nowhere = tempHome("brief-nowhere").path;
  const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
  const ask = (aim) => ranAsync(FORGE, ["brief", "ISS-7", "--judge", ...aim, "--url", "https://dev.example.com", "--criteria", "1"], env, nowhere);
  try {
    const aimed = await ask(["--project", OWN.slug]);
    assert.equal(aimed.status, 0, aimed.stderr);
    assert.ok(aimed.stdout.includes(`their lines were not compared here (this directory is in no git checkout; brief from a git checkout of `
      + `the project that holds ${LIVE.slice(0, 12)}) — ${stop}`), aimed.stdout);
    const unaimed = await ask([]);
    assert.equal(unaimed.status, 0, unaimed.stderr);
    assert.ok(unaimed.stdout.includes(`Verdict kind: not read (${nowhere} is in no checkout of a Forge project; pass --project <slug>) — `
      + "ask the dispatcher"), unaimed.stdout);
  } finally {
    tracker.close();
  }
});
