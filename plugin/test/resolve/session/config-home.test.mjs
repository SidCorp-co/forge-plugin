/* A `forge` call standing in a run's own worktree reads and writes that run's config home whatever
   the shell exports, as a hook does for the same tree (ISS-2824): unset is filled, a value that
   disagrees is refused rather than overridden, and a tree naming no run is the environment's. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { standsInNoTree, tempRoom } from "../../fixtures.mjs";

import { RUN_ID, SCRATCH, SCRATCH_AT } from "../../../src/resolve/session/run-id.mjs";
import {
  configHomeConflict, configHomeRow, configHomeRows, developerConfigPath, settleConfigHome,
} from "../../../src/resolve/session/config-home.mjs";

/* A worktree `tools/run/workspace/start.mjs` could have cut: the run id and the scratch record
   beside its git directory, named exactly as `scratchAt` requires. Returns the tree and the home a
   hook already reads there. */
const worktree = (id) => {
  const at = tempRoom("config-home-");
  const gitDir = join(at, "checkout", ".git", "worktrees", "wt-one");
  const scratch = join(at, `${SCRATCH}${id}`);
  mkdirSync(gitDir, { recursive: true });
  mkdirSync(join(at, "wt-one"), { recursive: true });
  writeFileSync(join(at, "wt-one", ".git"), `gitdir: ${gitDir}\n`);
  writeFileSync(join(gitDir, RUN_ID), `${id}\n`);
  writeFileSync(join(gitDir, SCRATCH_AT), scratch);
  return { tree: join(at, "wt-one"), home: join(scratch, "home"), scratch };
};

const withEnv = (values, run) => {
  const was = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(was)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("a tree naming no run answers null, and a shell's own export never conflicts with nothing", () => {
  const at = standsInNoTree("config-home");
  withEnv({ XDG_CONFIG_HOME: "/anywhere", FORGE_BORROW_FROM: undefined, HOME: user() }, () => {
    assert.deepEqual(configHomeRow(at), { tree: null, asked: "/anywhere", conflict: false });
    assert.equal(configHomeConflict(at), null);
    assert.equal(settleConfigHome(at), null, "outside any run's worktree, this call is the environment's own");
    assert.equal(process.env.XDG_CONFIG_HOME, "/anywhere", "and never rewritten there");
    assert.equal(process.env.FORGE_BORROW_FROM, undefined, "nor handed a borrow");
    assert.deepEqual(configHomeRows(at), [{ owed: false, label: "config home",
      said: "/anywhere  ← XDG_CONFIG_HOME; no run's tree stands here" }]);
  });
});

test("a tree naming a run answers that run's own home", () => {
  const { tree, home } = worktree("iss-467-abcd1234");
  withEnv({ XDG_CONFIG_HOME: undefined }, () => {
    assert.deepEqual(configHomeRow(tree), { tree: home, asked: null, conflict: false });
  });
});

/* A user whose own config exists, so a borrow has a file to name. */
const user = () => {
  const at = tempRoom("config-home-user-");
  mkdirSync(join(at, ".config", "forge"), { recursive: true });
  writeFileSync(join(at, ".config", "forge", "config.json"), "{}\n");
  return at;
};

test("an unset shell is filled silently from the tree, so a run that forgot the export need not keep forgetting it", () => {
  const { tree, home } = worktree("iss-2824-aaaa1111");
  withEnv({ XDG_CONFIG_HOME: undefined, FORGE_BORROW_FROM: undefined, HOME: tempRoom("config-home-bare-") }, () => {
    assert.equal(process.env.XDG_CONFIG_HOME, undefined);
    const conflict = settleConfigHome(tree);
    assert.equal(conflict, null, "silence, since nothing here disagreed with anything");
    assert.equal(process.env.XDG_CONFIG_HOME, home, "filled with the tree's own home");
    assert.equal(process.env.FORGE_BORROW_FROM, undefined, "and no borrow of a file that is not there");
    const [row, borrow] = configHomeRows(tree);
    assert.match(row.said, /filled because the shell exported no XDG_CONFIG_HOME/u);
    assert.equal(borrow.owed, true, "a home borrowing nothing is a row the run has an act on");
    assert.match(borrow.said, /^none, and .* is not there to borrow from/u);
  });
});

test("an unset borrow is filled with this machine's own config, by reference", () => {
  const { tree, home } = worktree("iss-2824-aaaa2222");
  withEnv({ XDG_CONFIG_HOME: undefined, FORGE_BORROW_FROM: undefined, HOME: user() }, () => {
    assert.equal(settleConfigHome(tree), null);
    assert.equal(process.env.XDG_CONFIG_HOME, home);
    assert.equal(process.env.FORGE_BORROW_FROM, developerConfigPath());
    const [, borrow] = configHomeRows(tree);
    assert.deepEqual([borrow.owed, borrow.said], [false,
      `${developerConfigPath()}  ← this machine's own config, filled because the shell exported no FORGE_BORROW_FROM; read, never written`]);
  });
});

test("a borrow the shell already named is kept, and one naming another file is flagged with the export", () => {
  const { tree, home } = worktree("iss-2824-aaaa3333");
  withEnv({ XDG_CONFIG_HOME: home, FORGE_BORROW_FROM: "/elsewhere/config.json", HOME: user() }, () => {
    assert.equal(settleConfigHome(tree), null);
    assert.equal(process.env.FORGE_BORROW_FROM, "/elsewhere/config.json", "never overridden");
    const [row, borrow] = configHomeRows(tree);
    assert.match(row.said, /this tree's own run, as the shell exports$/u);
    assert.equal(borrow.owed, true);
    assert.ok(borrow.said.endsWith(`export FORGE_BORROW_FROM=${developerConfigPath()}`), borrow.said);
  });
});

test("a shell naming the same home settles as no conflict at all", () => {
  const { tree, home } = worktree("iss-2824-bbbb2222");
  withEnv({ XDG_CONFIG_HOME: home, FORGE_BORROW_FROM: "/machine/config.json" }, () => {
    assert.equal(configHomeConflict(tree), null);
    assert.equal(settleConfigHome(tree), null);
    assert.equal(process.env.XDG_CONFIG_HOME, home, "left exactly as the shell already had it");
  });
});

test("a shell naming a different home is refused rather than silently overridden, and never rewritten", () => {
  const { tree, home } = worktree("iss-2824-cccc3333");
  withEnv({ XDG_CONFIG_HOME: "/tmp/some-other-home" }, () => {
    const said = settleConfigHome(tree);
    assert.match(said, /XDG_CONFIG_HOME=\/tmp\/some-other-home names a different home/u);
    assert.ok(said.includes(home), "names the tree's own path");
    assert.ok(said.includes(`export XDG_CONFIG_HOME=${home}`), "pastes back the tree's own export");
    assert.ok(said.includes(developerConfigPath()), "and the file a borrow reads from");
    assert.equal(process.env.XDG_CONFIG_HOME, "/tmp/some-other-home", "the shell's own value stands");
    const rows = configHomeRows(tree);
    assert.equal(rows.length, 1, "the conflict is the one row the doctor prints");
    assert.equal(rows[0].owed, true);
    assert.ok(!rows[0].said.includes("No configuration was read"), "a doctor that keeps running does not claim it read nothing");
    assert.ok(said.includes("No configuration was read or written"), "a refused call does");
  });
});

test("no other variable suppresses that refusal — an unrelated shell state earns the tree nothing", () => {
  const { tree, home } = worktree("iss-2824-eeee5555");
  withEnv({ XDG_CONFIG_HOME: "/tmp/unrelated", TMPDIR: "/tmp/forge-run-some-other-run" }, () => {
    const said = settleConfigHome(tree);
    assert.match(said, /XDG_CONFIG_HOME=\/tmp\/unrelated names a different home/u);
    assert.ok(said.includes(home), "the developer's own machine is never the silent answer (BR-17)");
  });
});

test("developerConfigPath names this machine's own file, under HOME and not any run's tree", () => {
  assert.equal(developerConfigPath(), join(homedir(), ".config", "forge", "config.json"));
});

/* `dirname` proves the fixture's own claim: the home a tree earns sits one level under its scratch,
   exactly as `run.mjs start` lays the two out. */
test("the home resolved sits under the tree's own scratch", () => {
  const { tree, home, scratch } = worktree("iss-2824-ffff6666");
  withEnv({ XDG_CONFIG_HOME: undefined }, () => {
    assert.equal(dirname(home), scratch);
    assert.equal(configHomeRow(tree).tree, home);
  });
});
