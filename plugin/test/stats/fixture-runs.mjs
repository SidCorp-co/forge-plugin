/* One made transcript and the corpus around it, small enough to add up by hand. */
import { spawnSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slugFor } from "../../src/stats/corpus/corpus.mjs";
import { tempRoom } from "../fixtures.mjs";

export const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
export const PROJECT = "/fixture/project";
export const BASE = Date.parse("2026-09-01T00:00:00.000Z");
export const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

export const OPUS = "claude-opus-5";

/* The model is on the assistant record the host writes, so a made transcript carries one too. */
export const use = (id, seconds, name, input, model = OPUS) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", model, content: [{ type: "tool_use", id, name, input }] },
});

/* What the API billed, as the host records it: the usage travels on the assistant record, and one
   response is written as several of those records under one `message.id`. */
export const spoke = (id, seconds, usage, model = OPUS) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "assistant", id, model, usage, content: [{ type: "text", text: "said" }] },
});

export const priced = (input, cacheCreate, cacheRead, output) => ({
  input_tokens: input,
  cache_creation_input_tokens: cacheCreate,
  cache_read_input_tokens: cacheRead,
  output_tokens: output,
});

/* One response as the host writes it: three records under one id, each repeating that response's
   usage, which is how a sum per record reads twice what was billed. */
export const RESPONSE = [100, 101, 102].map((second) => spoke("msg_one", second, priced(10, 100, 1200, 50)));
export const NOUGHTS = spoke("msg_two", 200, priced(0, 0, 0, 0));
export const MARKER_TURN = spoke("msg_three", 300, priced(7, 7, 7, 7), "<synthetic>");
export const NO_USAGE = spoke("msg_four", 400, undefined);
export const SHORT_USAGE = spoke("msg_five", 500,
  { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3 });

/* A record the host wrote no model onto: the attribution has nothing to read and the API billed it
   all the same. */
export const MODELLESS = JSON.stringify({
  timestamp: at(600),
  message: { role: "assistant", id: "msg_six", usage: priced(1, 2, 3, 4), content: [{ type: "text", text: "said" }] },
});

/* Two measured requests and 1200 cache read counted once. Every moment is inside the span the calls
   already cover, a run's clock being every record's. */
export const SPOKEN = [...RESPONSE, NOUGHTS, MARKER_TURN, NO_USAGE, SHORT_USAGE];

export const result = (id, seconds, content, isError = false) => JSON.stringify({
  timestamp: at(seconds),
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] },
});

/* Twelve calls with a marker of each kind, two waits worth naming, one refusal, one command typed
   three times and one call whose result never came. */
export const CALLS = [
  ["c1", 0, 10, "cat plugin/src/cli.mjs", "the file"],
  ["c2", 30, 5, "./plugin/bin/forge claim ISS-99", "claimed"],
  ["c3", 60, 5, "forge record plan ISS-99 /tmp/plan.md", "planned"],
  ["c4", 120, 120, "cd /w && npm run check 2>&1 | tail -5", "All 12 gate step(s) passed"],
  ["c5", 300, 30, "node --test plugin/test/stats/runs.test.mjs", "ok"],
  ["c6", 400, 900, "forge codex consult --send bodies plugin/src/stats/runs.mjs", "1 finding"],
  ["c7", 1400, 300, "forge codex consult --recheck", "confirmed"],
  ["c8", 1800, 5, "forge record verdict ISS-99 --criterion 1", "recorded"],
  ["c9", 1850, 5, "forge advance ISS-99", "developed -> awaiting_release"],
  ["c10", 1900, 240, "node /w/tools/run.mjs ship --note x", "awaiting_release"],
  ["c11", 2200, 20, 'until ! pgrep -f "tools/run.mjs ship"; do sleep 10; done', "done"],
  ["c12", 2300, 5, "forge issue ISS-99 --full", "the body"],
  ["c13", 2320, 5, "forge issue ISS-99 --full", "the body"],
  ["c14", 2340, 5, "forge issue ISS-99 --full", "the body"],
];

export const REFUSED = ["c15", 2400, 5, "forge advance ISS-99", "Hold — ISS-99 owes a release note.", true];
export const UNANSWERED = ["c16", 2500, "git status --short"];

export const transcript = () => [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "Skill forge:issue-flow ISS-99" } }),
  ...CALLS.flatMap(([id, start, waited, command, body]) =>
    [use(id, start, "Bash", { command }), result(id, start + waited, body)]),
  use(REFUSED[0], REFUSED[1], "Bash", { command: REFUSED[3] }),
  result(REFUSED[0], REFUSED[1] + REFUSED[2], REFUSED[4], true),
  use(UNANSWERED[0], UNANSWERED[1], "Bash", { command: UNANSWERED[2] }),
  ...SPOKEN,
].join("\n");

/* The rows have to add up to the corpus: a run filed under no rung and dropped would leave a table
   that silently reports fewer runs than the profile above it. */

/* A subagent that was not an issue-flow run: it is skipped and said to be, because a corpus that
   shrank because the marker moved reads exactly like a quiet week. */
export const OTHER = [
  JSON.stringify({ timestamp: at(0), type: "user", message: { role: "user", content: "summarise this file" } }),
  use("x1", 0, "Bash", { command: "wc -l README.md" }),
  result("x1", 3, "12 README.md"),
].join("\n");

export const indexIn = (room, session, name, text) => {
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), session, "tasks");
  mkdirSync(tasks, { recursive: true });
  const path = join(tasks, name);
  writeFileSync(path, `${text}\n`);
  return path;
};

export const storedIn = (room, session, name, text) => {
  const held = join(room, ".claude", "projects", slugFor(PROJECT), session, "subagents");
  mkdirSync(held, { recursive: true });
  const path = join(held, name);
  writeFileSync(path, `${text}\n`);
  return path;
};

export const corpus = () => {
  const room = tempRoom("stats-runs-");
  indexIn(room, "session-one", "a0001.output", transcript());
  indexIn(room, "session-one", "a0002.output", OTHER);
  return room;
};

export const asked = (room, ...argv) =>
  spawnSync(FORGE, ["stats", "runs", ...argv], {
    encoding: "utf8",
    /* The home is the room's own: every home-rooted path this verb reads is read where it is used, so a case that left it would profile the developer's own store. */
    env: { ...process.env, HOME: room, XDG_CONFIG_HOME: tempRoom("stats-home-"), TMPDIR: room },
  });

/* A case about --checkout itself calls `asked`: a helper naming a flag makes the caller's own
   occurrence a second one, which the parser refuses rather than overrides (ISS-930). */
export const ask = (room, ...argv) => asked(room, "--checkout", PROJECT, ...argv);

/* The two halves as the host writes them: the transcript in the store, and the index entry that is a symlink to it. */
export const linkedIn = (room, session, name, text) => {
  const held = storedIn(room, session, `agent-${name}.jsonl`, text);
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), session, "tasks");
  mkdirSync(tasks, { recursive: true });
  symlinkSync(held, join(tasks, `a${name}.output`));
};
