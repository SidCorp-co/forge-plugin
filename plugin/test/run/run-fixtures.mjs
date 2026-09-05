/* What both readers of `tools/run.mjs` exercise it on, since neither runs against this checkout.
   Not a `.test.mjs`, so the suite collects no test of its own here. */
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

/* Before the shape reader is loaded: it reaches the tracker's own settings, and a module that read
   the developer's config directory would run on their credential. */
process.env.XDG_CONFIG_HOME = tempRoom("run-script-home-");

export const ROOT = new URL("../../..", import.meta.url).pathname;
const OWN_SLUG = JSON.parse(readFileSync(join(ROOT, ".forge.json"), "utf8")).slug;
export const SCRIPT = join("tools", "run.mjs");
/* npm and node without whatever else the developer has on PATH: the ship path's last two steps are
   `claude`, and a machine that has it would prove nothing about what a missing step does. */
export const BARE = { ...process.env, PATH: `${dirname(realpathSync(process.execPath))}:/usr/bin:/bin` };

export const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
export const runIn = (cwd, argv, env = process.env) =>
  spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env });

/* Every file the script is, itself and the five it loads. `check` stands in for the repository's
   gate, which ship spends by name — the real one needs a tree this scratch checkout is not. */
export const GATE = "node -e \"console.log('scratch gate ran')\"";

const COPIED = [SCRIPT, join("tools", "run", "args.mjs"), join("tools", "run", "review.mjs"),
  join("tools", "checkout.mjs"), join("tools", "gates", "timing.mjs")];

export const scratch = (name, gate = GATE) => {
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of COPIED) {
    mkdirSync(join(work, dirname(one)), { recursive: true });
    cpSync(join(ROOT, one), join(work, one));
  }
  /* The CLI's source too, the filing being a module call, with the one directory it reaches out to. */
  cpSync(join(ROOT, "plugin", "src"), join(work, "plugin", "src"), { recursive: true });
  cpSync(join(ROOT, "plugin", "hooks", "vendor"), join(work, "plugin", "hooks", "vendor"), { recursive: true });
  writeFileSync(join(work, ".forge.json"), JSON.stringify({ slug: OWN_SLUG }));
  writeFileSync(join(work, "package.json"),
    JSON.stringify({ name: "scratch", version: "1.0.0", type: "module", scripts: { check: gate } }, null, 2));
  mkdirSync(join(work, ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, ".claude-plugin", "marketplace.json"), JSON.stringify({ name: "scratch-local" }));
  mkdirSync(join(work, "plugin", ".claude-plugin"), { recursive: true });
  writeFileSync(join(work, "plugin", ".claude-plugin", "plugin.json"), JSON.stringify({ name: "scratch", version: "1.0.0" }));
  mkdirSync(join(work, "node_modules"), { recursive: true });
  return { at, work };
};

export const committed = (work, message) => {
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "package.json", ".claude-plugin", "plugin", "tools", ".forge.json");
  git(work, "commit", "-m", message);
};

/* The endpoint the in-process filing reaches, one per module load: the release step's create is a
   module call now, and a run pointed at nothing would report a filing the network lost rather than
   the outcome each case is about. `state` is what a case seeds and reads back. */
const ROOM = tempRoom("run-tracker-");
const [SEED, CALLS, HOME] = ["tracker-state.json", "tracker-calls.jsonl", "tracker-home"];
const SEED_AT = join(ROOM, SEED);
const CALLS_AT = join(ROOM, CALLS);

const BACKLOG = { issues: [], comments: {}, memory: {}, mint: "filed-uuid" };

/** Every case starts with a backlog of its own and nothing recorded against it. */
export const noBacklog = (seed = {}) => {
  writeFileSync(SEED_AT, JSON.stringify({ ...BACKLOG, ...seed }));
  writeFileSync(CALLS_AT, "");
};

noBacklog();
const served = spawn(process.execPath,
  [join(import.meta.dirname, "tracker-process.mjs"), ROOM, SEED, CALLS, HOME],
  { stdio: ["ignore", "pipe", "inherit"] });
await new Promise((ready) => served.stdout.once("data", ready));
served.stdout.destroy();
served.unref();
process.on("exit", () => served.kill());

Object.assign(BARE, { XDG_CONFIG_HOME: readFileSync(join(ROOM, HOME), "utf8").trim() });

export const seen = (action, name = "forge_issues") =>
  (existsSync(CALLS_AT) ? readFileSync(CALLS_AT, "utf8") : "").split("\n").filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((one) => one.name === name && one.args.action === action);

/* Without the push the fetch has nothing to name and the range is undefined. */
export const pushed = (name) => {
  const { at, work } = scratch(name);
  git(at, "init", "--bare", "origin.git");
  git(work, "init", "-b", "master");
  committed(work, "one");
  git(work, "remote", "add", "origin", join(at, "origin.git"));
  git(work, "push", "origin", "HEAD:master");
  return { at, work };
};

export const landIn = (work, path, lines, message) => {
  mkdirSync(join(work, dirname(path)), { recursive: true });
  writeFileSync(join(work, path), "the change\n".repeat(lines));
  git(work, "add", path);
  git(work, "commit", "-m", message);
};

/* Step 8 is `claude`, which BARE does not carry, so the release runs as far as it can and the last
   step is then reached in a process of its own — which is how a resume reaches it too. */
export const lastStep = (work) => {
  runIn(work, ["ship"], BARE);
  return runIn(work, ["ship", "--from", "10"], BARE);
};

export const ref = (work) => git(work, "rev-parse", "--verify", "--quiet", "refs/forge/reviewed").stdout.trim();

/* The tracker the release step's LOOKUPS go through, at the path the step invokes. Every call is
   logged with the body it was piped, `new` leaves the row a later `issues` finds, and a
   `forge-refuses` file is the network that is not there — all above the checkout, an artefact inside
   it being a file the first ship step refuses. The filing is not among them. */
const STUB = `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const room = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
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
  const marked = join(room, "forge-size");
  const description = existsSync(marked) ? readFileSync(marked, "utf8") : "no mark here";
  const planned = join(room, "forge-plan");
  const plan = existsSync(planned) ? readFileSync(planned, "utf8") : "";
  process.stdout.write(JSON.stringify({ issueId: argv[1], status, description, plan }, null, 2));
  process.exit(0);
}
if (argv[0] === "record" && argv[1] === "report") {
  const page = join(room, "forge-record-page");
  process.stdout.write(existsSync(page) ? readFileSync(page, "utf8") : "Every criterion has a verdict.");
  process.exit(0);
}
if (existsSync(join(room, "forge-collides"))) {
  process.stderr.write("Hold — this files an issue the flow cannot carry.\\n\\n"
    + "- read: " + process.argv[1] + " read the body\\n"
    + "- read: the title of this filing, against ISS-135, overlapping at 1.00\\n"
    + "  clear: forge new <body> --title T --into ISS-135\\n");
  process.exit(1);
}
if (existsSync(join(room, "forge-shape-refuses"))) {
  process.stderr.write("forge_issues -> project scratch (from .forge.json), prose as written\\n"
    + "Hold \u2014 this files an issue the flow cannot carry. Each line below is what was read, "
    + "what the shape wants and the one command that clears it.\\n\\n"
    + "- read: no heading naming the outcome\\n  wants: a heading naming the outcome\\n"
    + "  clear: add a heading ## Outcome and re-send the same command\\n");
  process.exit(1);
}
const title = argv[argv.indexOf("--title") + 1];
appendFileSync(rows, \`\${"ISS-777".padEnd(8)} \${"medium".padEnd(8)} \${"open".padEnd(12)} \${title}\\n\`);
process.stdout.write(JSON.stringify({ documentId: "d", issueId: "ISS-777", title }, null, 2));
`;

/* Committed before the mark is planted, so the stub itself is behind the range the count reads. */
export const stubbed = (work) => {
  mkdirSync(join(work, "plugin", "bin"), { recursive: true });
  writeFileSync(join(work, "plugin", "bin", "forge"), STUB, { mode: 0o755 });
  git(work, "add", join("plugin", "bin", "forge"));
  git(work, "commit", "-m", "the tracker this checkout files through");
};

/** The rung the stubbed tracker answers with, for a ship whose branch names an issue: the mark in
 *  the body, and the two things that climb from it — a plan's declaration and a correction. */
export const sized = (at, tier) => writeFileSync(join(at, "forge-size"), `a body.\n\nSize: ${tier}.\n`);
export const planned = (at, text) => writeFileSync(join(at, "forge-plan"), text);
export const corrected = (at, moved) =>
  writeFileSync(join(at, "forge-record-page"), `Correction  (2026-09-05T10:00, contract 1)\n  What moved: ${moved}\n`);

export const called = (at) => readFileSync(join(at, "forge-calls.json"), "utf8")
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));

/* The range, the size and the rules are the step's to measure, never a person's to copy out (ISS-112). */
export const owedAt = (name) => {
  const { at, work } = pushed(name);
  stubbed(work);
  runIn(work, ["review", "--done"], BARE);
  const from = ref(work);
  landIn(work, join("plugin", "src", "wide.mjs"), 501, "a module a run grew (ISS-77)");
  return { at, work, from };
};
