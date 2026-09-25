/* A run on a branch cut releases ago wrote its records under the flow that branch carried, while the
   tracker and the landing judged them under the installed one (ISS-2529). Each copy here prints
   which one it is, since the choice is invisible in an exit code. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FLOW_VERBS, copyForVerb, flowRow } from "../../src/tools/flow-copy.mjs";
import { VERB_NAMES } from "../../src/resolve/visibility.mjs";
import { tempRoom } from "../fixtures.mjs";

const BIN = new URL("../../bin/", import.meta.url).pathname;
const PLUGIN = new URL("../..", import.meta.url).pathname;
const NAME = JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name;

const wrote = (path, body) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
};

const copy = (dir, label) => {
  wrote(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: NAME, version: label === "installed" ? "2.0.0" : "1.0.0" }));
  wrote(join(dir, "src", "cli.mjs"), `import "./flow.mjs";\nprocess.stdout.write("${label} cli " + process.argv.slice(2).join(" ") + "\\n");\n`);
  wrote(join(dir, "src", "flow.mjs"), "export const flow = 1;\n");
  wrote(join(dir, "src", "apart.mjs"), "export const apart = 1;\n");
  wrote(join(dir, "src", "commands.mjs"), '  claim: loads("./claiming.mjs", "claim"),\n');
  wrote(join(dir, "src", "claiming.mjs"), "export const claim = 1;\n");
  wrote(join(dir, "guides", "contract.md"), "# contract\n");
  return dir;
};

const git = (cwd, ...args) => {
  const ran = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" });
  assert.equal(ran.status, 0, ran.stderr);
  return ran.stdout.trim();
};

/* A checkout committed once, an installed copy whose record names that commit, and the link. */
const world = ({ recorded = true } = {}) => {
  const room = tempRoom("flow-copy-");
  const repo = join(room, "checkout");
  const checkout = copy(join(repo, "plugin"), "checkout");
  wrote(join(repo, ".claude-plugin", "marketplace.json"), JSON.stringify({ plugins: [{ name: NAME, source: "./plugin" }] }));
  git(repo, "init", "-q");
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "base");
  const sha = git(repo, "rev-parse", "HEAD");
  const installed = copy(join(room, "cache", "2.0.0"), "installed");
  const home = join(room, "home");
  const record = join(home, ".claude", "plugins", "installed_plugins.json");
  if (recorded) {
    wrote(record, JSON.stringify({ version: 2, plugins: { [`${NAME}@fake`]: [
      { scope: "user", installPath: installed, version: "2.0.0", lastUpdated: "2026-01-02T00:00:00.000Z", gitCommitSha: sha },
    ] } }));
  }
  mkdirSync(join(room, "bin"));
  symlinkSync(join(BIN, "forge"), join(room, "bin", "forge"));
  return { room, repo, checkout, installed, home, record };
};

const inWorld = (options, check) => {
  const made = world(options);
  try {
    check(made);
  } finally {
    rmSync(made.room, { recursive: true, force: true });
  }
};

const ran = (wrapper, { cwd, home }, ...args) =>
  spawnSync(wrapper, args, {
    encoding: "utf8",
    cwd,
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: join(home, ".config") },
  });

test("through the link inside a checkout, a flow verb runs the installed copy and any other verb the checkout's", () => {
  inWorld({}, ({ room, checkout, home }) => {
    const link = join(room, "bin", "forge");
    for (const verb of FLOW_VERBS) {
      assert.match(ran(link, { cwd: checkout, home }, verb, "ISS-1").stdout, new RegExp(`^installed cli ${verb} ISS-1$`, "mu"));
    }
    assert.match(ran(link, { cwd: checkout, home }, "spec", "FR-01").stdout, /^checkout cli spec FR-01$/mu);
    assert.match(ran(link, { cwd: checkout, home }, "codex", "consult").stdout, /^checkout cli codex consult$/mu);
  });
});

test("with no install record that resolves, a flow verb inside a checkout runs the checkout's copy", () => {
  inWorld({ recorded: false }, ({ room, checkout, home }) => {
    const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "claim", "ISS-1");
    assert.match(run.stdout, /^checkout cli claim ISS-1$/mu);
    assert.equal(run.stderr, "", "and nothing is said about a copy that did not answer");
  });
});

test("the checkout's own wrapper, called by its path, runs its own copy for a flow verb too", () => {
  inWorld({}, ({ checkout, home }) => {
    const run = ran(join(BIN, "forge"), { cwd: checkout, home }, "claim", "-h");
    assert.match(run.stdout, /^Usage: forge claim /mu, "this tree's own CLI answered");
    assert.doesNotMatch(run.stdout, /installed cli/u, "the install record was not consulted");
  });
});

test("a checkout changing nothing a flow verb loads prints nothing about which copy answered", () => {
  inWorld({}, ({ room, checkout, home }) => {
    writeFileSync(join(checkout, "src", "apart.mjs"), "export const apart = 2;\n");
    const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "claim", "ISS-1");
    assert.match(run.stdout, /^installed cli claim ISS-1$/mu);
    assert.equal(run.stderr, "", "a change outside the verb's graph is no reason to speak");
  });
});

test("a checkout changing what a flow verb loads is told which copy answered and how to run its own", () => {
  for (const [path, body] of [["src/flow.mjs", "export const flow = 2;\n"], ["src/claiming.mjs", "export const claim = 2;\n"], ["guides/contract.md", "# changed\n"]]) {
    inWorld({}, ({ room, repo, checkout, home }) => {
      git(repo, "checkout", "-qb", "change");
      writeFileSync(join(checkout, path), body);
      git(repo, "commit", "-qam", "change");
      const run = ran(join(room, "bin", "forge"), { cwd: checkout, home }, "claim", "ISS-1");
      assert.match(run.stdout, /^installed cli claim ISS-1$/mu, "the installed copy still answers");
      assert.ok(run.stderr.includes(`the installed copy 2.0.0 answered, and this checkout changes what it runs (${path})`),
        `the copy that answered and the change are named for ${path}:\n${run.stderr}`);
      assert.ok(run.stderr.includes(`\`${join(checkout, "bin", "forge")} claim\``), `with the command that runs the checkout's own:\n${run.stderr}`);
    });
  }
});

test("doctor's row for the flow names the copy, why that one, and a change it would not run", () => {
  inWorld({}, ({ checkout, installed, record }) => {
    const where = { cwd: checkout, root: PLUGIN, record };
    assert.equal(copyForVerb({ verb: "record", ...where }).dir, installed);
    const clean = flowRow(where);
    assert.match(clean, new RegExp(`^installed 2\\.0\\.0 at ${installed} — ${FLOW_VERBS.join(", ")}: a flow verb runs the flow the installed copy serves`, "u"));
    assert.doesNotMatch(clean, /changes what they load/u);
    writeFileSync(join(checkout, "src", "flow.mjs"), "export const flow = 3;\n");
    assert.match(flowRow(where), /this checkout changes what they load \(src\/flow\.mjs\)/u);
  });
});

/* One declaration: the wrapper and the dispatcher name no verb of it, and each is a verb there is. */
test("the flow's verbs are declared once, and each is a verb of this CLI", () => {
  for (const verb of FLOW_VERBS) assert.ok(VERB_NAMES.includes(verb), `${verb} is no verb of forge`);
  for (const file of [join(BIN, "forge"), join(PLUGIN, "src", "dispatch.mjs")]) {
    const body = readFileSync(file, "utf8");
    for (const verb of FLOW_VERBS) assert.doesNotMatch(body, new RegExp(`["'\`]${verb}["'\`]`, "u"), `${file} names ${verb}`);
  }
});
