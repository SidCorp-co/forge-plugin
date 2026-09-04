/* What both readers of `tools/run.mjs` exercise it on, since neither runs against this checkout.
   Not a `.test.mjs`, so the suite collects no test of its own here. */
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { tempRoom } from "../fixtures.mjs";

/* Before the shape reader is loaded: it reaches the tracker's own settings, and a module that read
   the developer's config directory would run on their credential. */
process.env.XDG_CONFIG_HOME = tempRoom("run-script-home-");

export const ROOT = new URL("../../..", import.meta.url).pathname;
export const SCRIPT = join("tools", "run.mjs");
/* npm and node without whatever else the developer has on PATH: the ship path's last two steps are
   `claude`, and a machine that has it would prove nothing about what a missing step does. */
export const BARE = { ...process.env, PATH: `${dirname(realpathSync(process.execPath))}:/usr/bin:/bin` };

export const git = (cwd, ...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
export const runIn = (cwd, argv, env = process.env) =>
  spawnSync(process.execPath, [SCRIPT, ...argv], { cwd, encoding: "utf8", env });

/* Every file the script is, itself and the four it loads. `check` stands in for the repository's
   gate, which ship spends by name — the real one needs a tree this scratch checkout is not. */
export const GATE = "node -e \"console.log('scratch gate ran')\"";

export const scratch = (name, gate = GATE) => {
  const at = tempRoom(`${name}-`);
  const work = join(at, "checkout");
  for (const one of [SCRIPT, join("tools", "run", "review.mjs"), join("tools", "checkout.mjs"),
    join("tools", "gates", "timing.mjs"), join("plugin", "src", "tools", "plugin-copy.mjs")]) {
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

export const committed = (work, message) => {
  for (const [key, value] of [["user.email", "t@example.test"], ["user.name", "Test"]]) git(work, "config", key, value);
  git(work, "add", "package.json", ".claude-plugin", "plugin", "tools");
  git(work, "commit", "-m", message);
};

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

/* The tracker the release step files through, at the path the step invokes. Every call is logged with
   the body it was piped, `new` leaves the row a later `issues` finds, and a `forge-refuses` file is the
   network that is not there — all above the checkout, an artefact inside it being an uncommitted file
   the first ship step refuses. CommonJS: the scratch manifest names no module type. */
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
