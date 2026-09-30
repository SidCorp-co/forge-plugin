/* Whether a restart is owed is the dispatcher's to act on and never the run's (ISS-2963): the verb
   says it on standard error, in versions, and the brief it prints carries nothing about the copy. The
   session is a live process started between two cached copies, so the verb reads it as a dispatcher's. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { callHook } from "../fixtures.mjs";
import { HOOK, brief, homeFor, repository } from "./fixture.mjs";

const repo = repository();

const put = (root, files) => {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
};

const cacheOf = (who) => join(who.home, ".claude", "plugins", "cache", "forge-local", "forge");

/** For each pair, a home with the older copy cached before one session started and the newer one
 *  cached and installed after it. `ps` places a start off a boot time kept to the second, so a start
 *  it reads can sit a second either side of the real one: each step is two seconds clear of the next,
 *  and the wait is paid once for every case. */
const sessionBetween = async (...pairs) => {
  const homes = pairs.map(() => homeFor());
  pairs.forEach(([was], at) => put(join(cacheOf(homes[at]), "1.0.0"), was));
  await sleep(2_100);
  const session = spawn("sleep", ["60"], { stdio: "ignore" });
  test.after(() => session.kill());
  await sleep(2_100);
  return homes.map((who, at) => {
    put(join(cacheOf(who), "1.0.1"), pairs[at][1]);
    writeFileSync(join(who.home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
      plugins: { "forge@forge-local": [{ version: "1.0.1", installPath: join(cacheOf(who), "1.0.1"), lastUpdated: new Date().toISOString() }] },
    }));
    return { ...who, env: { ...who.env, CLAUDE_PID: String(session.pid) } };
  });
};

const [owed, unowed] = await sessionBetween(
  [{ "hooks/hooks.json": "{}", "src/a.mjs": "1", "agents/runner.md": "a" },
    { "hooks/hooks.json": "{\"x\":1}", "src/a.mjs": "2", "agents/runner.md": "b" }],
  [{ "hooks/hooks.json": "{}", "src/a.mjs": "1" }, { "hooks/hooks.json": "{}", "src/a.mjs": "2" }],
);

const dispatched = (who, prompt) => {
  const run = callHook(HOOK, {
    session_id: who.session, cwd: repo.main, tool_name: "Agent",
    tool_input: { description: "run it", prompt, subagent_type: "forge:runner" },
  }, who.env, process.cwd(), { skipped: [] });
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return true;
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecision !== "deny";
};

const COPY_LINE = /plugin copy|restart|1\.0\.[01]/iu;

test("a restart owed is said to the dispatcher in versions, and the brief it can send carries no word of the copy", () => {
  const who = owed;
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, who.env);
  assert.equal(run.status, 0, run.stderr);
  const said = run.stderr.trim();
  assert.match(said, /^forge brief: a restart is owed before this dispatch\./u);
  assert.match(said, /loaded forge 1\.0\.0 and 1\.0\.1 is installed/u);
  assert.match(said, /Restart it, which loads 1\.0\.1, and brief again/u);
  assert.match(said, /not part of the brief: send only what standard output printed/u);
  assert.doesNotMatch(said, /hooks\/|src\/|skills\/|agents\/|\.json|\.mjs|\.md/u, "the plugin's own paths are no dispatcher's to place");
  assert.doesNotMatch(run.stdout, COPY_LINE, "the brief a run is handed says nothing of the dispatcher's copy");
  assert.equal(dispatched(who, run.stdout), true, "what standard output printed passes the hook unchanged");
  assert.equal(dispatched(who, `${said}\n${run.stdout}`), false, "and with the restart line pasted in it is refused");
  assert.equal(dispatched(who, `${run.stdout}\n${said}`), false, "wherever the line is pasted");
});

test("copies differing only outside the restart set owe nothing, and nothing is said of them", () => {
  const who = unowed;
  const run = brief(["ISS-7", "--tree", repo.mine], repo.main, who.env);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
  assert.doesNotMatch(run.stdout, COPY_LINE);
});
