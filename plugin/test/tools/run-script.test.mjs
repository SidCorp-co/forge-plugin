/* The repository's own steps around a change lived in a prompt one session wrote, so sixteen runs
   obeyed a copy nobody could see go stale (ISS-79). Every rule below is a line that prompt carried,
   exercised on a scratch checkout rather than on this one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tempRoom } from "../fixtures.mjs";

/* Before the shape reader is loaded: it reaches the tracker's own settings, and a module that read
   the developer's config directory would run on their credential. */
process.env.XDG_CONFIG_HOME = tempRoom("run-script-home-");
const { shapeOf } = await import("../../src/tracker/issue-shape.mjs");

const ROOT = new URL("../../..", import.meta.url).pathname;
const SCRIPT = join("tools", "run.mjs");
/* npm and node without whatever else the developer has on PATH: the ship path's last two steps are
   `claude`, and a machine that has it would prove nothing about what a missing step does. */
const BARE = { ...process.env, PATH: `${dirname(realpathSync(process.execPath))}:/usr/bin:/bin` };

const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
const runIn = (cwd, argv, env = process.env) =>
  spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env });

/* The three files the script is: itself, the module it reads the install record through, and the
   git helpers it shares with the gate runner. `check` stands in for the repository's own gate,
   which ship spends by name — the real one needs a tree this scratch checkout is not. */
const GATE = "node -e \"console.log('scratch gate ran')\"";

const scratch = (name, gate = GATE) => {
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of [SCRIPT, join("tools", "checkout.mjs"), join("plugin", "src", "tools", "plugin-copy.mjs")]) {
    mkdirSync(join(work, dirname(one)), { recursive: true });
    cpSync(join(ROOT, one), join(work, one));
  }
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.0", scripts: { check: gate } }, null, 2));
  mkdirSync(join(work, ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "scratch-local" }));
  mkdirSync(join(work, "plugin", ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, "plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: "scratch", version: "1.0.0" }));
  mkdirSync(join(work, "node_modules"), { recursive: true });
  return { at, work };
};

const committed = (work, message) => {
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "package.json", ".claude-plugin", "plugin", "tools");
  git(work, "commit", "-m", message);
};

/* Step 7 is reached only from a tree that is not the checkout, so every fixture shipping from the
   scratch root early-returns past it (ISS-143). `pull.rebase` is set in the scratch repository
   rather than left to the developer's: off it, this case turns on a setting the test does not hold. */
test("step 7 follows to the pushed head over a dirty checkout, and stops where a fast-forward cannot", () => {
  const { at, work } = pushed("follows");
  git(work, "config", "pull.rebase", "true");
  landIn(work, join("docs", "another-run.md"), 1, "a fold another run keeps open");
  git(work, "push", "origin", "HEAD:master");
  const tree = join(at, "wt-ISS-143");
  git(work, "worktree", "add", tree, "-b", "iss-143");
  landIn(tree, join("plugin", "src", "one.mjs"), 4, "the change this release ships");
  const theirs = join(work, "docs", "another-run.md");
  writeFileSync(theirs, "the fold, as that run has it now\n");

  const run = runIn(tree, ["ship"], BARE);
  assert.match(run.stdout, /step 7\/10  the checkout follows/u, run.stdout);
  assert.match(run.stderr, /stopped at step 8 \(marketplace scratch-local\)/u,
    `step 7 stopped on a checkout it had only to fast-forward:\n${run.stdout}${run.stderr}`);
  assert.equal(git(work, "rev-parse", "HEAD").stdout.trim(), git(tree, "rev-parse", "HEAD").stdout.trim(),
    "the marketplace installs from the checkout's working tree, so it has to reach the pushed head");
  assert.equal(readFileSync(theirs, "utf8"), "the fold, as that run has it now\n",
    "a dirty path the release does not move is another run's work, and losing it is worse than the stop");

  /* A checkout holding a commit of its own is the case that genuinely cannot fast-forward, and the
     stop has to name a route: the two a run reaches for unaided are both worse than the failure. */
  landIn(work, join("docs", "local.md"), 1, "a commit the checkout has and the remote does not");
  landIn(tree, join("plugin", "src", "two.mjs"), 4, "another change");
  const stopped = runIn(tree, ["ship"], BARE);
  assert.match(stopped.stderr, /stopped at step 7 \(the checkout follows\)/u, stopped.stderr);
  assert.match(stopped.stderr, /status --short/u, `no read for the path in the way:\n${stopped.stderr}`);
  assert.match(stopped.stderr, /log --oneline origin\/master\.\.HEAD/u,
    `no read for the commits that are not upstream:\n${stopped.stderr}`);
  assert.match(stopped.stderr, /git stash/u, "the route a run must not take is named, being the one it reaches for");
});

/* A scratch checkout with a bare origin it has already pushed to, which is the state every step
   past the first reads: without it the fetch has nothing to name and the range is undefined. */
const pushed = (name) => {
  const { at, work } = scratch(name);
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  return { at, work };
};

const landIn = (work, path, lines, message) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), "the change\n".repeat(lines));
  git(work, "add", path);
  git(work, "commit", "-m", message);
};

/* Step 8 is `claude`, which BARE does not carry, so the release runs as far as it can and the last
   step is then reached in a process of its own — which is how a resume reaches it too. */
const lastStep = (work) => {
  runIn(work, ["ship"], BARE);
  return runIn(work, ["ship", "--from", "10"], BARE);
};

const ref = (work) => git(work, "rev-parse", "--verify", "--quiet", "refs/forge/reviewed").stdout.trim();

/* The tracker the release step files through, standing in for the CLI at the path the step invokes.
   Every call is logged with the body it was piped, `new` leaves the row a later `issues` finds, and
   a `forge-refuses` file is the network that is not there — all three above the checkout, because
   an artefact inside it is an uncommitted file and the first ship step refuses a dirty tree.
   CommonJS: the scratch manifest names no module type and a wrapper carries no extension. */
const STUB = `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const room = join(__dirname, "..", "..", "..");
const argv = process.argv.slice(2);
const body = argv.includes("-") ? readFileSync(0, "utf8") : "";
appendFileSync(join(room, "forge-calls.json"), JSON.stringify({ argv, body }) + "\\n");
if (existsSync(join(room, "forge-refuses"))) {
  process.stderr.write("the tracker did not answer: getaddrinfo ENOTFOUND\\n");
  process.exit(1);
}
const rows = join(room, "forge-rows.txt");
const STATUS_AT = 2;
if (argv[0] === "issues") {
  const want = argv.includes("--status") ? argv[argv.indexOf("--status") + 1] : null;
  const all = (existsSync(rows) ? readFileSync(rows, "utf8") : "").split("\\n").filter(Boolean);
  const kept = want ? all.filter((line) => line.trim().split(/\\s+/)[STATUS_AT] === want) : all;
  for (const line of kept) process.stdout.write(line + "\\n");
  process.stdout.write(\`\\n\${kept.length} issue(s)\\n\`);
  process.exit(0);
}
if (argv[0] === "issue") {
  if (existsSync(join(room, "forge-unread"))) {
    process.stderr.write("forge issue failed: fetch failed\\n");
    process.exit(1);
  }
  const row = (existsSync(rows) ? readFileSync(rows, "utf8") : "").split("\\n")
    .find((line) => line.startsWith(argv[1]));
  const status = row ? row.trim().split(/\\s+/)[STATUS_AT] : "open";
  process.stdout.write(JSON.stringify({ issueId: argv[1], status }, null, 2));
  process.exit(0);
}
if (existsSync(join(room, "forge-collides"))) {
  process.stderr.write("Hold — this files an issue the flow cannot carry.\\n\\n"
    + "- read: " + process.argv[1] + " read the body\\n"
    + "- read: the title of this filing, against ISS-135, overlapping at 1.00\\n"
    + "  clear: forge new <body> --title T --into ISS-135\\n");
  process.exit(1);
}
const title = argv[argv.indexOf("--title") + 1];
appendFileSync(rows, \`\${"ISS-777".padEnd(8)} \${"medium".padEnd(8)} \${"open".padEnd(12)} \${title}\\n\`);
process.stdout.write(JSON.stringify({ documentId: "d", issueId: "ISS-777", title }, null, 2));
`;

/* Committed before the mark is planted, so the stub itself is behind the range the count reads. */
const stubbed = (work) => {
  mkdirSync(join(work, "plugin", "bin"), { recursive: true });
  writeFileSync(join(work, "plugin", "bin", "forge"), STUB, { mode: 0o755 });
  git(work, "add", join("plugin", "bin", "forge"));
  git(work, "commit", "-m", "the tracker this checkout files through");
};

const called = (at) => readFileSync(join(at, "forge-calls.json"), "utf8")
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));

/* The threshold and the mark are typed here rather than imported: nothing imports an entry point,
   and a second party that has to agree with the constants is what pins them to the help at all. */
test("-h names all three steps, the resume flag and the threshold it counts against", () => {
  const run = runIn(ROOT, ["-h"]);
  assert.equal(run.status, 0, run.stderr);
  for (const said of ["start <ISS-nn>", "ship [--from N]", "review [--done [ref]]", "--from N",
    "worktree", "restart", "refs/forge/reviewed", "500 changed line(s)", "npm run check",
    "The release count is printed beside it and decides nothing",
    "--done <the range's end>"]) {
    assert.ok(run.stdout.includes(said), `${said} is not in the usage:\n${run.stdout}`);
  }
  assert.ok(!run.stdout.includes("3 release(s)"), `a release count is no part of the trigger:\n${run.stdout}`);
});

test("start adds the worktree, links what the checkout installed, and names the wrapper to probe with", () => {
  const { work } = scratch("start");
  git(work, "init", "-b", "master");
  committed(work, "one");
  const run = runIn(work, ["start", "ISS-88", "one-line"]);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const tree = join(dirname(work), "wt-ISS-88");
  assert.ok(existsSync(tree), `${tree} was not made:\n${run.stdout}${run.stderr}`);
  assert.ok(existsSync(join(tree, "node_modules")), "the checkout's node_modules is not linked in");
  assert.ok(run.stdout.includes(join(tree, "plugin", "bin", "forge")),
    `the wrapper a probe must invoke is not named:\n${run.stdout}`);
  assert.equal(git(work, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim(), "master", "the checkout stays where it was");

  const again = runIn(work, ["start", "ISS-88", "one-line"]);
  assert.equal(again.status, 1, again.stdout);
  assert.ok(again.stderr.includes(tree), `the refusal does not name the worktree already there:\n${again.stderr}`);
  assert.ok(again.stderr.includes("worktree remove"), again.stderr);
});

/* A rebase drops a bump identical to one already upstream without a conflict, and the tree then
   names a version carrying none of the change with nothing red to say so. */
test("ship takes a version above the remote head, pushes, and stops at the first step it cannot take", () => {
  const { at, work } = scratch("ship");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  writeFileSync(join(work, "one.txt"), "the change\n");
  git(work, "add", "one.txt");
  git(work, "commit", "-m", "the change");

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, "the last two steps need `claude`, which this PATH does not carry");
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.1",
    `1.0.0 was already upstream, so the release owed 1.0.1:\n${run.stdout}`);
  assert.equal(git(at, "-C", join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD").stdout.trim(), "the push did not land the bump it made");
  assert.ok(run.stdout.includes("scratch gate ran"), `the gate step did not spend the tree's own gate:\n${run.stdout}`);
  assert.match(run.stderr, /stopped at step 8 \(marketplace scratch-local\)/u, run.stderr);
  assert.match(run.stderr, /Resume from there: node \S+ ship --from 8/u, run.stderr);
  assert.ok(!run.stdout.includes("Released."), "nothing may claim a release it did not finish");
});

/* A release ships what a gate has passed. Before ISS-117 nothing here gated at all: the head was
   pushed on the strength of whatever the session remembered running. */
test("a red gate stops the ship before it bumps, pushes or installs anything", () => {
  const { at, work } = scratch("gated", "node -e \"process.exit(1)\"");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  landIn(work, "one.txt", 1, "the change");

  const run = runIn(work, ["ship"], BARE);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /stopped at step 4 \(the gate\)/u, run.stderr);
  assert.equal(JSON.parse(readFileSync(join(work, "package.json"), "utf8")).version, "1.0.0",
    "the version was raised past a gate that had not passed");
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD~1").stdout.trim(), "the change was pushed past a red gate");

  /* The run that most needs a gate is the one that edited something to get past a failed step, so
     a resume aimed past the gate spends it first rather than pushing on the last run's word. */
  const resumed = runIn(work, ["ship", "--from", "6"], BARE);
  assert.match(resumed.stderr, /stopped at step 4 \(the gate\)/u, resumed.stderr);
  assert.equal(git(join(at, "origin.git"), "rev-parse", "master").stdout.trim(),
    git(work, "rev-parse", "HEAD~1").stdout.trim(), "a resume past the gate pushed an ungated tree");
});

/* Every resume runs in a process that watched none of the steps before it, so a step reading what
   an earlier one held in memory is a step that cannot be resumed. Both were review findings. */
test("a resumed ship commits a bump left on disk, and never says nothing moved when it cannot tell", () => {
  const { at, work } = scratch("resume");
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  writeFileSync(join(work, "one.txt"), "the change\n");
  git(work, "add", "one.txt");
  git(work, "commit", "-m", "the change");
  runIn(work, ["ship"], BARE);

  const headVersion = () => JSON.parse(git(work, "show", "HEAD:package.json").stdout).version;
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.2", scripts: { check: GATE } }, null, 2));
  runIn(work, ["ship", "--from", "5"], BARE);
  assert.equal(headVersion(), "1.0.2", "a version raised on disk and left uncommitted is committed by the resume");

  const told = runIn(work, ["ship", "--from", "10"], BARE);
  assert.match(told.stdout, /moved since [0-9a-f]{7}/u, told.stdout + told.stderr);
  rmSync(join(work, ".git", "forge-ship-from"));
  const blind = runIn(work, ["ship", "--from", "10"], BARE);
  assert.match(blind.stderr, /no forge-ship-from in this tree's git directory/u, blind.stderr);
  assert.doesNotMatch(blind.stdout, /moved since/u, "a run that cannot compare may not tell a session it is safe");
});

/* Every delegated run reviews its own diff and stops, so what two runs each wrote is in no run's
   range. The count that spans them is the release step's, not anyone's judgement per issue. */
test("with no mark, the last step says it cannot count and plants nothing", () => {
  const { work } = pushed("unmarked");
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");

  const run = lastStep(work);
  assert.match(run.stderr, /no refs\/forge\/reviewed in this repository/u, run.stderr);
  assert.match(run.stderr, /the release that introduced this rule/u, run.stderr);
  assert.doesNotMatch(run.stdout, /release\(s\)/u, "a run that cannot count may not report a count");
  assert.equal(ref(work), "", "the release step is not the mark's writer");

  const asked = runIn(work, ["review"], BARE);
  assert.equal(asked.status, 1, asked.stdout);
  assert.match(asked.stderr, /no refs\/forge\/reviewed/u, asked.stderr);
});

/* The release count fired first on both readings it ever triggered, so the calendar of releases was
   the trigger and the code there is to read was not. It is printed and it decides nothing. */
test("releases alone owe no reading, however many, and the count still names them", () => {
  const { work } = pushed("releases");
  const planted = runIn(work, ["review", "--done"], BARE);
  assert.match(planted.stdout, /refs\/forge\/reviewed planted at [0-9a-f]{7}/u, planted.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());

  for (const nth of [1, 2, 3]) {
    landIn(work, join("plugin", "hooks", `gate-${nth}.mjs`), 4, `the ${nth} change`);
    const under = lastStep(work);
    assert.match(under.stdout, new RegExp(`${nth} release\\(s\\), ${nth} file\\(s\\)`, "u"), under.stdout);
    assert.doesNotMatch(under.stdout, /a review of/u, `${nth} release(s) of 4 lines is no reading's worth`);
    assert.match(under.stdout, /short of the 500 line\(s\) that call for a reading/u, under.stdout);
  }
});

/* Read through the verb rather than through a ship, so the release count stays at zero and the
   volume is the only thing that can be what fired. */
test("the five hundredth changed line is owed a reading, and only in the counted paths", () => {
  const { work } = pushed("lines");
  runIn(work, ["review", "--done"], BARE);

  landIn(work, join("docs", "long.md"), 600, "prose, which the one-home check reads");
  const outside = runIn(work, ["review"], BARE);
  assert.match(outside.stdout, /holds 0 release\(s\), 0 file\(s\), 0 changed line\(s\)/u, outside.stdout);
  assert.match(outside.stdout, /^Short of the 500 changed line\(s\)/mu, "docs/ is not a path this count reads");

  landIn(work, join("plugin", "src", "wide.mjs"), 499, "a module a run grew");
  const under = runIn(work, ["review"], BARE);
  assert.match(under.stdout, /holds 0 release\(s\), 1 file\(s\), 499 changed line\(s\)/u, under.stdout);
  assert.match(under.stdout, /^Short of the/mu, "499 is one line short, and the boundary is exact");

  landIn(work, join("plugin", "src", "wide.mjs"), 500, "the line that crosses it");
  const owed = runIn(work, ["review"], BARE);
  assert.match(owed.stdout, /holds 0 release\(s\), 1 file\(s\), 500 changed line\(s\)/u, owed.stdout);
  assert.match(owed.stdout, /^A review is owed:/mu, owed.stdout);
  assert.match(lastStep(work).stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\)/u,
    "the release step says it too, on a release count of its own bump alone");
});

/* Both readings this count ever asked for were then typed by hand — the range, the size, the rules
   — which is a person copying out what the step had already measured (ISS-112). */
const owedAt = (name) => {
  const { at, work } = pushed(name);
  stubbed(work);
  runIn(work, ["review", "--done"], BARE);
  const from = ref(work);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew (ISS-77)");
  return { at, work, from };
};

test("past the threshold the step files the reading's issue itself, and prints the line that launches it", () => {
  const { at, work, from } = owedAt("filed");

  const owed = lastStep(work);
  const to = git(work, "rev-parse", "HEAD").stdout.trim();
  const filing = called(at).find((one) => one.argv[0] === "new");
  assert.ok(filing, `nothing was filed:\n${owed.stdout}${owed.stderr}`);
  assert.deepEqual(filing.argv.slice(0, 2), ["new", "-"], "the body goes in on stdin");
  assert.ok(filing.argv.includes("--kind") && filing.argv[filing.argv.indexOf("--kind") + 1] === "feature",
    `the filing names no kind the verb takes: ${filing.argv.join(" ")}`);
  assert.ok(filing.argv[filing.argv.indexOf("--title") + 1].includes(`${from.slice(0, 7)}..${to.slice(0, 7)}`),
    `the title names no commit pair: ${filing.argv.join(" ")}`);

  for (const said of ["## Outcome", "## Rules", "## Out of scope", "1 file(s) and 501 changed line(s)",
    `git diff ${from}..${to} -- plugin/src plugin/hooks plugin/bin`, "ISS-77", `review --done ${to}`]) {
    assert.ok(filing.body.includes(said), `the body carries no ${said}:\n${filing.body}`);
  }
  assert.ok(owed.stdout.includes("filed ISS-777"), owed.stdout);
  assert.ok(owed.stdout.includes("Work ISS-777. Use the Skill tool: skill forge:issue-flow, args ISS-777."),
    `the launch line is not printed as the parent reads it:\n${owed.stdout}`);
});

/* The stub takes any filing, so what it proves is the argv and the body — not that the CLI would
   have them. The generated pair goes through the reader the verb itself files against, which is
   local: what a duplicate of it is already open is the tracker's and is not asked here. */
test("the generated title and body are a filing this CLI's own shape reader accepts", () => {
  const { at, work } = owedAt("shaped");
  lastStep(work);

  const filing = called(at).find((one) => one.argv[0] === "new");
  const shape = shapeOf({
    title: filing.argv[filing.argv.indexOf("--title") + 1],
    body: filing.body,
    kind: filing.argv[filing.argv.indexOf("--kind") + 1],
  });
  assert.deepEqual(shape.gaps, [], `the filing the step generates would be refused:\n${JSON.stringify(shape.gaps, null, 1)}`);
  assert.equal(shape.said, null, `the filing draws a notice the step cannot answer: ${shape.said}`);
});

test("a second ship at the same mark names the issue already there and files nothing", () => {
  const { at, work } = owedAt("twice");
  lastStep(work);

  landIn(work, join("plugin", "src", "wider.mjs"), 40, "more of the same");
  const again = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 1,
    `the mark's reading was filed twice:\n${again.stdout}`);
  assert.match(again.stdout, /ISS-777 is open for this mark already, so nothing was filed/u, again.stdout);
  assert.ok(again.stdout.includes("Work ISS-777."), `the run still has one thing to do:\n${again.stdout}`);
});

/* Two ships fifteen minutes apart read one mark and answered differently: its issue had left `open`
   between them. The window `open` was right for is the one before anybody starts work (ISS-140). */
test("the mark's issue is found at whatever status it has reached, and the lookup asks for none", () => {
  const { at, work, from } = owedAt("statuses");
  /* The row's own shape, rank and all: this projection grew a column between two ships of this
     batch, and a fixture one column short reads the rank as the status and proves nothing. */
  const seed = (key, status) => writeFileSync(join(at, "forge-rows.txt"),
    `${key.padEnd(8)} ${"medium".padEnd(8)} ${status.padEnd(12)} `
    + `The batch ${from.slice(0, 7)}..deadbee is read once as a whole\n`);

  seed("ISS-501", "in_progress");
  const held = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0,
    `an issue the tracker already holds for this mark was filed again:\n${held.stdout}${held.stderr}`);
  assert.match(held.stdout, /ISS-501 is in_progress for this mark already, so nothing was filed/u, held.stdout);
  assert.ok(held.stdout.includes("Work ISS-501."), held.stdout);
  const lookup = called(at).find((one) => one.argv[0] === "issues");
  assert.ok(!lookup.argv.includes("--status"),
    `the question is whether an issue for this mark exists, and a status is no part of it: ${lookup.argv.join(" ")}`);
  assert.ok(called(at).some((one) => one.argv[0] === "issue" && one.argv[1] === "ISS-501"),
    "the status is read off the issue, the row's columns being a projection that grows without notice");

  /* A finished reading whose mark was never moved is a state of its own: the count keeps growing,
     and the route out is the move, never a second filing of a reading already done. */
  seed("ISS-502", "closed");
  const done = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0, done.stdout);
  assert.match(done.stdout, /ISS-502 is closed for this mark and the mark never moved/u, done.stdout);
  assert.match(done.stdout, /review --done/u, `the route out of a finished reading is the move:\n${done.stdout}`);
  assert.doesNotMatch(done.stdout, /Work ISS-502\./u, "a closed issue is nothing to launch a run on");

  /* Counted, a dropped reading would leave the range an issue nobody reads and no route to another. */
  seed("ISS-503", "dropped");
  const again = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 1,
    `a dropped reading left the range with no issue and no filing:\n${again.stdout}${again.stderr}`);
  assert.ok(again.stdout.includes("filed ISS-777"), again.stdout);
});

/* Nothing may invite a duplicate of an issue it has already found: only that issue's status went
   unread, and the count keeps growing until someone reads it. */
test("an issue found but unread files nothing, and is not routed to a filing of its replacement", () => {
  const { at, work, from } = owedAt("unread");
  writeFileSync(join(at, "forge-rows.txt"),
    `${"ISS-504".padEnd(8)} ${"medium".padEnd(8)} ${"tested".padEnd(12)} `
    + `The batch ${from.slice(0, 7)}..deadbee is read once as a whole\n`);
  writeFileSync(join(at, "forge-unread"), "");

  const run = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0,
    `an issue already found was replaced because its status would not read:\n${run.stdout}${run.stderr}`);
  assert.match(run.stderr, /ISS-504 is this mark's reading, so nothing was filed/u, run.stderr);
  assert.match(run.stdout, /forge issue ISS-504/u, run.stdout);
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `a route that files a replacement for an issue already found:\n${run.stdout}`);
});

/* The tracker's own duplicate gate was the only thing that stopped a second issue for a mark that
   already had one, and the step then reported that refusal as a silence and printed the filing the
   gate had just refused as the route out of it (ISS-140). */
test("a filing refused by name is reported as refused, and not routed back to the filing it forbade", () => {
  const { at, work } = owedAt("wt-ISS-999");
  writeFileSync(join(at, "forge-collides"), "");

  const run = lastStep(work);
  assert.match(run.stderr, /the tracker refused the filing, and its answer names ISS-135/u,
    `a refusal and a silence are different findings:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /did not answer/u, "the tracker answered — by name, with what it collided with");
  assert.doesNotMatch(run.stdout, /forge new - --title/u,
    `the route under a refusal has to be one the refusal leaves open:\n${run.stdout}`);
  assert.match(run.stdout, /forge issue ISS-135/u, run.stdout);
  assert.doesNotMatch(run.stdout, /Work ISS-135\./u,
    `the gate collides on title similarity, so the key it names is nothing to launch a run on:\n${run.stdout}`);
  assert.match(run.stderr, /names ISS-135:/u, run.stderr);
  assert.doesNotMatch(run.stdout, /ISS-999/u,
    `the collision is the key the tracker named, and a path in its reason carries one too:\n${run.stdout}`);
});

/* A review is never lost for want of a network: nothing is filed, the count and the route print as
   they did before anything filed itself, and the next ship asks again. */
test("a tracker that does not answer files nothing, prints the route, and leaves the next ship to file it", () => {
  const { at, work } = owedAt("offline");
  writeFileSync(join(at, "forge-refuses"), "");

  const blind = lastStep(work);
  assert.equal(blind.status, 0, blind.stderr);
  assert.match(blind.stdout, /a review of [0-9a-f]{7}\.\.HEAD is owed: 1 release\(s\), 1 file\(s\), 501 changed line\(s\)/u, blind.stdout);
  assert.match(blind.stderr, /the tracker did not answer the lookup, so nothing is filed and the next ship asks again/u,
    `a silence names which call it was, so a refusal is not read as one:\n${blind.stderr}`);
  assert.match(blind.stdout, /forge new - --title "review [0-9a-f]{7}\.\.HEAD" --kind feature/u,
    `the route it prints has to run as printed, and --size takes only \`fix\` (ISS-118):\n${blind.stdout}`);
  assert.match(blind.stdout, /start <that ISS-nn>/u, blind.stdout);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 0, "a refused list may not file");

  rmSync(join(at, "forge-refuses"));
  const then = lastStep(work);
  assert.equal(called(at).filter((one) => one.argv[0] === "new").length, 1,
    `the reading was lost rather than retried:\n${then.stdout}${then.stderr}`);
  assert.ok(then.stdout.includes("Work ISS-777."), then.stdout);
});

test("a reading that finds nothing moves the mark in one line, and the count starts again there", () => {
  const { work } = pushed("moved");
  runIn(work, ["review", "--done"], BARE);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew");
  assert.match(lastStep(work).stdout, /a review of/u, "501 lines under plugin/src is past the threshold");

  const before = ref(work);
  const asked = runIn(work, ["review"], BARE);
  assert.match(asked.stdout, /[0-9a-f]{7}\.\.HEAD is the next review's, and holds 1 release\(s\)/u, asked.stdout);
  assert.match(asked.stdout, /git diff [0-9a-f]{40}\.\.HEAD -- plugin\/src plugin\/hooks plugin\/bin/u, asked.stdout);
  assert.equal(ref(work), before, "reading the range moves nothing");

  const done = runIn(work, ["review", "--done", git(work, "rev-parse", "HEAD").stdout.trim()], BARE);
  assert.match(done.stdout, /refs\/forge\/reviewed [0-9a-f]{7} -> [0-9a-f]{7}/u, done.stdout);
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim());
  assert.doesNotMatch(lastStep(work).stdout, /a review of/u, "the range restarts at the mark it just moved");

  const nowhere = runIn(work, ["review", "--done", "no-such-ref"], BARE);
  assert.equal(nowhere.status, 1, nowhere.stdout);
  assert.match(nowhere.stderr, /`no-such-ref` is no commit in this tree/u, nowhere.stderr);
});

/* The plant is the one moment nothing else checks, and a mark off this history opens a range that
   still counts and still prints a plausible number, so no threshold is reached honestly (ISS-104). */
test("the first plant proves the target is this history's, apart from a mark behind the head", () => {
  const { work } = pushed("offhistory");
  const held = git(work, "rev-parse", "HEAD^{tree}").stdout.trim();
  const orphan = git(work, "commit-tree", held, "-m", "a commit on no branch of this repository").stdout.trim();

  const off = runIn(work, ["review", "--done", orphan], BARE);
  assert.equal(off.status, 1, off.stdout);
  assert.match(off.stderr, /is on no history reaching this tree's head/u, off.stderr);
  assert.doesNotMatch(off.stderr, /is not a descendant of the mark/u,
    "a target off this history is not a target behind the mark, and the two send a reader to different fixes");
  assert.ok(off.stderr.includes(`git update-ref refs/forge/reviewed ${orphan.slice(0, 7)}`),
    `the plant's escape has to carry the two-argument form:\n${off.stderr}`);
  assert.doesNotMatch(off.stderr, /update-ref refs\/forge\/reviewed [0-9a-f]{7} [0-9a-f]{7}/u,
    "there is no old value on the plant path, so a compare-and-swap escape refuses a second time");
  assert.match(off.stderr, /fetch/u, "a tree that has not fetched is the usual reason, so the refusal names that read");
  assert.equal(ref(work), "", "the refused plant left no mark");

  const planted = runIn(work, ["review", "--done", "HEAD"], BARE);
  assert.equal(planted.status, 0, planted.stderr);
  assert.match(planted.stdout, /planted at [0-9a-f]{7}/u, planted.stdout);
});

/* The range is fixed when its issue is filed and other runs land on the branch while it is being
   read, so HEAD at the end of a review run is ahead of the head that reading reached. A mark planted
   there marks unread commits as read, and unlike a mark left unmoved nothing grows to say so
   (ISS-146). The discriminator is local: an owed range is one a reading was filed for. */
test("a bare --done moves no mark already there, and the named ref moves it to the head that was read", () => {
  const { work } = pushed("named");
  const planted = runIn(work, ["review", "--done"], BARE);
  assert.equal(planted.status, 0, `a plant answers to no range, so it is not refused:\n${planted.stderr}`);
  const from = ref(work);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew, and the reading read to here");
  const reached = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "later.mjs"), 20, "what another run landed while it was being read");

  const bare = runIn(work, ["review", "--done"], BARE);
  assert.equal(bare.status, 1, bare.stdout);
  assert.match(bare.stderr, /a move of the mark names the head the reading reached/u, bare.stderr);
  assert.ok(bare.stderr.includes(git(work, "rev-parse", "HEAD").stdout.trim()),
    `a reading that did reach HEAD has to be left a way to say so:\n${bare.stderr}`);
  assert.equal(ref(work), from, "the refused write moved nothing");

  const told = runIn(work, ["review", "--done", reached], BARE);
  assert.equal(told.status, 0, told.stderr);
  assert.equal(ref(work), reached, "the mark names the head the reading reached, not the head it pushed");

  /* The count is a net diff, so later deletions bring a filed range back under the threshold. */
  landIn(work, join("plugin", "src", "small.mjs"), 20, "a little more, well under the threshold");
  const under = runIn(work, ["review", "--done"], BARE);
  assert.equal(under.status, 1, `every move names its ref, the volume deciding nothing:\n${under.stdout}`);
  assert.equal(ref(work), reached, "the refused write moved nothing");
});

/* A mark moved back hands the next reading a range it has already been told was read — a codex
   finding on this change, alongside the shared ref two review worktrees both write. */
test("the mark only ever moves forward, and the refusal carries the way past a wrong one", () => {
  const { work } = pushed("forward");
  const first = git(work, "rev-parse", "HEAD").stdout.trim();
  landIn(work, join("plugin", "src", "one.mjs"), 4, "the change");
  runIn(work, ["review", "--done"], BARE);

  const back = runIn(work, ["review", "--done", first], BARE);
  assert.equal(back.status, 1, back.stdout);
  assert.match(back.stderr, /is not a descendant of the mark at [0-9a-f]{7}/u, back.stderr);
  assert.match(back.stderr, /git update-ref refs\/forge\/reviewed [0-9a-f]{7} [0-9a-f]{7}/u,
    "a refusal over a mark that is itself the mistake has to carry the way past it");
  assert.equal(ref(work), git(work, "rev-parse", "HEAD").stdout.trim(), "the refused write moved nothing");
});
