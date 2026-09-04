/* The hook as Claude Code runs it, because what this gate gets wrong is never the recording — it is
   when it speaks. One state file serves every checkout on the machine, so the cases that matter are
   a second turn, a second project, and both at once. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { callHook, homeEnv, tempRoom } from "../fixtures.mjs";

const HOOK = new URL("../../hooks/entries/codex-turn.mjs", import.meta.url).pathname;
const HOME = homeEnv("codex-turn");
const room = tempRoom("codex-turn-");
const STATE = join(HOME.XDG_CONFIG_HOME, "forge", "codex.json");
const FORGE = new URL("../../bin/forge", import.meta.url).pathname;

const repo = (name) => {
  const root = join(room, name);
  mkdirSync(join(root, "docs"), { recursive: true });
  writeFileSync(join(root, ".git"), "gitdir: elsewhere\n");
  return root;
};

/* A turn is where the last prompt is, so a transcript is what says which turn this is. */
const transcript = (at) => {
  const path = join(room, `t-${randomUUID()}.jsonl`);
  writeFileSync(path, `${JSON.stringify({ type: "user", promptSource: "typed", timestamp: at })}\n`);
  return path;
};

const wrote = (root, rel) => {
  writeFileSync(join(root, rel), `${randomUUID()}\n`);
  return join(root, rel);
};

const fired = (root, rel, at, session = "s1") => {
  const file = wrote(root, rel);
  const run = callHook(
    HOOK,
    {
      session_id: session,
      tool_name: "Bash",
      tool_input: { command: `printf x > ${file}` },
      transcript_path: transcript(at),
      cwd: root,
    },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  const said = run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput.additionalContext : null;
  return said ?? null;
};

const pending = (root) => {
  const held = JSON.parse(readFileSync(STATE, "utf8"));
  return (held.turns ?? {})[root]?.files ?? [];
};

const ONE = repo("one");

/* The failure this exists for: sid-erp held eleven files recorded hours earlier, so every later turn
   in every later session recorded silently. The list is not the thing that decides. */
test("a later turn is told even though the list from an earlier one is still pending", () => {
  const at = "2026-09-01T10:00:00.000Z";
  assert.match(fired(ONE, "docs/A.md", at), /forge codex consult/u);
  assert.equal(fired(ONE, "docs/B.md", at), null, "the same turn is told once");
  const later = fired(ONE, "docs/C.md", "2026-09-01T10:30:00.000Z");
  assert.match(later, /docs\/C\.md/u, "a new prompt is a new turn");
  assert.deepEqual(pending(ONE), ["docs/A.md", "docs/B.md", "docs/C.md"], "all three still pending");
});

test("a second session is its own turn, whatever the first one was told", () => {
  const at = "2026-09-01T11:00:00.000Z";
  assert.match(fired(ONE, "docs/D.md", at, "s2"), /docs\/D\.md/u);
  assert.equal(fired(ONE, "docs/E.md", at, "s2"), null);
});

/* A storm, because spawning ten hooks does not overlap them: process start staggers the writes and
   the race hides. Four processes recording into two checkouts at once is contention, and without a
   lock the read-modify-write loses whatever another one wrote in between. */
const STORM = `
import { hookRecord } from "${new URL("../../src/codex/codex.mjs", import.meta.url).pathname}";
/* With -e there is no script path, so the first argument is argv[1]. */
const [root, mine, count] = process.argv.slice(1);
for (let n = 0; n < Number(count); n += 1) {
  hookRecord({}, [\`\${root}/docs/\${mine}-\${n}.md\`], () => true);
}
`;

test("nothing is lost when several projects record at the same moment", async () => {
  /* Its own config home, because the lock lives beside the state file and a directory an earlier
     test made would hide a lock that cannot be taken until the first write. */
  const fresh = homeEnv("codex-storm");
  const roots = [repo("par-a"), repo("par-b")];
  const EACH = 25;
  const writers = ["w1", "w2"];
  for (const root of roots) {
    for (const mine of writers) {
      for (let n = 0; n < EACH; n += 1) writeFileSync(join(root, "docs", `${mine}-${n}.md`), "x");
    }
  }
  const runs = [];
  for (const root of roots) {
    for (const mine of writers) {
      runs.push(
        new Promise((done) => {
          spawn(process.execPath, ["--input-type=module", "-e", STORM, root, mine, String(EACH)], {
            env: fresh,
            stdio: ["ignore", "ignore", "inherit"],
          }).on("close", done);
        }),
      );
    }
  }
  await Promise.all(runs);
  const state = join(fresh.XDG_CONFIG_HOME, "forge", "codex.json");
  const held = JSON.parse(readFileSync(state, "utf8"));
  const stormPending = (root) => (held.turns ?? {})[root]?.files ?? [];
  const wanted = writers
    .flatMap((mine) => Array.from({ length: EACH }, (_, n) => `docs/${mine}-${n}.md`))
    .sort();
  for (const root of roots) {
    assert.deepEqual(
      [...stormPending(root)].sort(),
      wanted,
      `${root} lost ${wanted.length - stormPending(root).length} of ${wanted.length} to another writer`,
    );
  }
});

/* A writer killed between its open and its rename leaves the temp file behind for good: the pid in the
   name means no later writer touches it. One minute old is nobody's write in progress. */
test("a temp file a killed writer left behind is swept, and a live one is not", async () => {
  process.env.XDG_CONFIG_HOME = HOME.XDG_CONFIG_HOME;
  const { writeJsonPrivate } = await import("../../src/resolve/config.mjs");
  const room = join(HOME.XDG_CONFIG_HOME, "forge");
  mkdirSync(room, { recursive: true });
  const target = join(room, "swept.json");
  const stranded = `${target}.999999.tmp`;
  const busy = `${target}.999998.tmp`;
  for (const one of [stranded, busy]) writeFileSync(one, "half a write");
  const old = new Date(Date.now() - 600_000);
  utimesSync(stranded, old, old);
  writeJsonPrivate(target, { a: 1 });
  assert.equal(existsSync(stranded), false, "a minute-old temp file was left");
  assert.equal(existsSync(busy), true, "a write in progress was deleted under it");
  assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { a: 1 });
});

/* Proceeding without the lock is right — a turn is not worth losing to a stuck one — and it is also
   the one moment a write can be lost, so the log carries it. A note is not a refusal: the count that
   reads "N refusal(s)" is what a false positive looks like from outside. */
test("giving up on the lock leaves a note, and the note is not counted as a refusal", async () => {
  process.env.XDG_CONFIG_HOME = HOME.XDG_CONFIG_HOME;
  const { holding } = await import("../../src/codex/codex.mjs");
  const lock = join(HOME.XDG_CONFIG_HOME, "forge", "codex.json.lock");
  mkdirSync(dirname(lock), { recursive: true });
  writeFileSync(lock, "somebody-still-holding-it");
  let entered = false;
  holding(() => {
    entered = true;
  });
  rmSync(lock, { force: true });
  assert.ok(entered, "the write happened anyway");
  const log = readFileSync(join(HOME.XDG_CONFIG_HOME, "forge", "hook-log.jsonl"), "utf8");
  const noted = log.trim().split("\n").map((one) => JSON.parse(one)).filter((one) => one.decision === "note");
  assert.equal(noted.length, 1, "the unlocked write left no trace");
  assert.match(noted[0].reason, /without it/u);
  const said = spawnSync(FORGE, ["hooks"], { encoding: "utf8", env: HOME }).stdout;
  assert.doesNotMatch(said, /1 refusal\(s\)/u, "a note counted as a refusal");
  assert.match(said, /1 note\(s\)/u, "and it is reachable");
  assert.match(spawnSync(FORGE, ["hooks", "--notes"], { encoding: "utf8", env: HOME }).stdout, /codex\.json\.lock/u);
});

/* A stale break hands the lock file to whoever took it next. Releasing by path rather than by owner,
   the first writer then deletes the second's lock and both are inside at once — codex found this.
   The environment is moved before the import, because this half runs in-process: the fixture's env
   reaches a child and nothing else, and the first version of this test locked the developer's own
   config directory. */
test("a writer whose lock was broken does not remove the one that replaced it", async () => {
  process.env.XDG_CONFIG_HOME = HOME.XDG_CONFIG_HOME;
  const { holding } = await import("../../src/codex/codex.mjs");
  const lock = join(HOME.XDG_CONFIG_HOME, "forge", "codex.json.lock");
  let entered = false;
  holding(() => {
    entered = true;
    writeFileSync(lock, "another-writer");
  });
  assert.ok(entered, "the lock was never taken");
  assert.equal(readFileSync(lock, "utf8"), "another-writer", "it removed a lock that was not its own");
  rmSync(lock, { force: true });
});

/* The writer asked directly, with no lock between them: what the lock hides is whether the write
   itself survives company. */
const WRITERS = `
import { writeJsonPrivate } from "${new URL("../../src/resolve/config.mjs", import.meta.url).pathname}";
const [path, mine, count] = process.argv.slice(1);
const wide = Object.fromEntries(Array.from({ length: 20_000 }, (_, n) => [\`k\${n}\`, \`\${mine}-\${n}\`]));
for (let n = 0; n < Number(count); n += 1) writeJsonPrivate(path, wide);
`;

test("two writers on one file never leave half of one behind", async () => {
  const path = join(room, "concurrent.json");
  const done = [];
  for (const mine of ["a", "b", "c"]) {
    done.push(
      new Promise((ends) => {
        spawn(process.execPath, ["--input-type=module", "-e", WRITERS, path, mine, "12"], {
          stdio: ["ignore", "ignore", "inherit"],
        }).on("close", ends);
      }),
    );
  }
  let broken = 0;
  let reads = 0;
  let running = true;
  Promise.all(done).then(() => {
    running = false;
  });
  while (running) {
    try {
      JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      if (!String(error.message).includes("ENOENT")) broken += 1;
    }
    reads += 1;
    await new Promise((tick) => setTimeout(tick, 1));
  }
  assert.ok(reads > 20, `${reads} reads is too few to have raced anything`);
  assert.equal(broken, 0, `${broken} of ${reads} reads found a file one writer had not finished`);
});
