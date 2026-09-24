/* One device made small: a registered project with a checkout, a session store naming it, runs on
   chosen days, a consult log, a hook log and a release reading — every home the verb reads rooted
   in one room, so no case reads the developer's own. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { slugFor } from "../../../src/stats/corpus/corpus.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { FORGE, transcript } from "../fixture-runs.mjs";

export const NAME = "daily-fixture";
export const SLUG = "daily-fixture-slug";

const day = (at) => new Date(at).toISOString().slice(0, 10);
export const today = () => day(Date.now());
export const daysAgo = (back) => day(Date.now() - back * 86_400_000);

/* The fixture run of `stats runs`'s own suite, moved onto another day: its calls sit between 00:00
   and 00:42 UTC, so under TZ=UTC every one of them is on the day named. */
export const runOn = (on) => transcript().replaceAll("2026-09-01T", `${on}T`);

const jsonl = (rows) => `${rows.map((one) => JSON.stringify(one)).join("\n")}\n`;

/** The room, its config home, the checkout and the store, with a run on each day named. */
export const device = ({ days = [], consults = [], hooks = [], marks = [], config = {}, project = {} } = {}) => {
  const room = tempRoom("stats-daily-");
  const home = join(room, "config");
  const checkout = join(room, "work", NAME);
  mkdirSync(checkout, { recursive: true });
  spawnSync("git", ["init", "-q", checkout], { cwd: room, encoding: "utf8" });
  mkdirSync(join(home, "forge", "projects", NAME), { recursive: true });
  writeFileSync(join(home, "forge", "projects", NAME, "config.json"), JSON.stringify({ slug: SLUG, ...project }));
  if (Object.keys(config).length) writeFileSync(join(home, "forge", "config.json"), JSON.stringify(config));
  const store = join(room, ".claude", "projects", slugFor(checkout));
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "session-top.jsonl"), jsonl([{ type: "user", cwd: checkout, sessionId: "session-top" }]));
  days.forEach((on, index) => {
    const held = join(store, `session-${index}`, "subagents");
    mkdirSync(held, { recursive: true });
    writeFileSync(join(held, `agent-a${index}.jsonl`), `${runOn(on)}\n`);
  });
  if (consults.length) writeFileSync(join(home, "forge", "codex-log.jsonl"), jsonl(consults));
  if (hooks.length) writeFileSync(join(home, "forge", "hook-log.jsonl"), jsonl(hooks));
  if (marks.length) writeFileSync(join(home, "forge", "eval-marks.jsonl"), jsonl(marks));
  return { room, home, checkout, reports: join(home, "forge", "reports") };
};

export const envOf = (held, extra = {}) => ({
  ...process.env, HOME: held.room, XDG_CONFIG_HOME: held.home, TMPDIR: held.room, TZ: "UTC", FORGE_CODEX_DISABLE: "1", ...extra,
});

/** The verb, standing in the room and never in this checkout. */
export const daily = (held, ...argv) => spawnSync(FORGE, ["stats", "daily", ...argv],
  { encoding: "utf8", cwd: held.room, env: envOf(held) });

export const consult = (at, extra = {}) => ({
  kind: "consult", ok: true, reply: "CODEX: 1 findings (0 blocker, 1 major, 0 minor)\n- **F1 — New — major:** x",
  at, model: "cx/model-a", prompt: { v: 3, sha: "abc123" }, calls: 4, budget: 4, id: `c-${at}`, ...extra,
});
