/* The hook as Claude Code runs it, because what this gate gets wrong is never the recording — it is
   when it speaks. One state file serves every checkout on the machine, so the cases that matter are
   a second turn, a second project, and both at once. */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { callHook, homeEnv } from "./fixtures.mjs";

const HOOK = new URL("../hooks/codex-turn.mjs", import.meta.url).pathname;
const HOME = homeEnv("codex-turn");
const room = mkdtempSync(join(tmpdir(), "codex-turn-"));
const STATE = join(HOME.XDG_CONFIG_HOME, "forge", "codex.json");

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
import { hookRecord } from "${new URL("../src/codex.mjs", import.meta.url).pathname}";
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

/* The writer asked directly, with no lock between them: what the lock hides is whether the write
   itself survives company. */
const WRITERS = `
import { writeJsonPrivate } from "${new URL("../src/resolve/config.mjs", import.meta.url).pathname}";
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
