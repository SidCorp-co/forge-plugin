/* One corpus of made transcripts and one spawn of the verb, for every case that reads them. */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { runsUnder } from "../../src/stats/runs.mjs";
import { slugFor } from "../../src/stats/transcripts.mjs";
import { tempRoom } from "../fixtures.mjs";

export const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
export const PROJECT = "/fixture/project";
export const BASE = Date.parse("2026-09-01T00:00:00.000Z");
export const HOUR = 3600;
export const at = (seconds) => new Date(BASE + seconds * 1000).toISOString();

/* One run per hour, ten minutes plus two more every fifth, so two windows' medians differ by hand. */
const runText = (n) => {
  const start = n * HOUR;
  const lasted = 600 + (n % 5) * 120;
  return [
    JSON.stringify({ timestamp: at(start), type: "user", message: { role: "user", content: `Skill forge:issue-flow ISS-${n}` } }),
    JSON.stringify({ timestamp: at(start + 30), message: { role: "assistant", content: [{ type: "tool_use", id: `c${n}`, name: "Bash", input: { command: `forge claim ISS-${n}` } }] } }),
    /* The line claim.mjs prints for an ownership granted; a body merely saying so joins nothing (ISS-821). */
    JSON.stringify({ timestamp: at(start + lasted), message: { role: "user", content: [{ type: "tool_result", tool_use_id: `c${n}`, content: `ISS-${n}  claim: session iss-${n} (agent, pid 1), renewed for 30 minute(s)` }] } }),
  ].join("\n");
};

export const corpusOf = (many, room = tempRoom("stats-eval-")) => {
  const tasks = join(room, `claude-${process.getuid()}`, slugFor(PROJECT), "session", "tasks");
  mkdirSync(tasks, { recursive: true });
  for (let n = 0; n < many; n += 1) writeFileSync(join(tasks, `a${String(n).padStart(4, "0")}.output`), `${runText(n)}\n`);
  return room;
};

export const rootOf = (room) => join(room, `claude-${process.getuid()}`, slugFor(PROJECT));

/* HOME is empty, so every run is unrecorded; the config home is fresh unless the case hands one over. */
export const askStats = (room, argv, home = tempRoom("stats-eval-home-")) =>
  spawnSync(FORGE, ["stats", ...argv], {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: home, TMPDIR: room, HOME: tempRoom("stats-eval-user-") },
  });

export const ask = (room, ...argv) => askStats(room, ["eval", "--checkout", PROJECT, ...argv]);

export const runsOf = (many) => runsUnder(rootOf(corpusOf(many)), null).runs;
