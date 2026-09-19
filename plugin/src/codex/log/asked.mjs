/* What a gate and the resolution report ask the consult log per tool call and per run, answered off the log's bytes: holding it as rows to answer either cost 503 ms and 167 MB of heap on a 43 MB log, where it is the history rather than the question that grew (ISS-1044). The questions needing the REPLY's own grammar are replies.mjs beside this; none here needs it, the one string parsed below being one this tool wrote itself, and all three are a folder down because `plugin/src/codex/` is at the width limit whose stated remedy is a subfolder. */
import { jsonlBack, jsonlMark } from "../../hooks/log/hook-log-file.mjs";
import { isAnswered } from "../codex-log.mjs";

const CONSULT = jsonlMark("kind", "consult");

/* Every row the mark selects is parsed, at 177 ms against the 26 ms of counting the mark itself: a row torn by an append that stopped carries the mark and is no consult, and `forge doctor` prints this once a run. */
export const consultCount = (bytes) => {
  let found = 0;
  for (const one of jsonlBack(bytes, [CONSULT])) if (one.kind === "consult") found += 1;
  return found;
};

export const sentShaOf = (bytes, root, rel) => {
  for (const one of jsonlBack(bytes, [jsonlMark("rel", rel)], [jsonlMark("root", root)])) {
    if (!isAnswered(one) || one.root !== root) continue;
    const hit = (one.sent ?? []).find((sent) => sent.rel === rel);
    if (hit) return hit.sha ?? null;
  }
  return null;
};

/* The command and the clock, found in and then taken out of the one string `codex-tools.mjs` writes and `codex-rounds.mjs` carries into `refused`: the pair is what says whether a record still speaks about the budget a project has now, a stop at 300s saying nothing about a 600s clock. The mark is searched for as bytes, so it is escaped here the way the row was escaped when written, and the enclosing quotes come off because it is a fragment of a value rather than the value. */
const STOPPED = /^run_check : `(.+)` ran past ([0-9.]+)s and was stopped/su;
const markFor = (command) => JSON.stringify(`run_check : \`${command}\` ran past `).slice(1, -1);

/** Every consult of `command` whose check was stopped at or above `ms`, newest first, no older than `since`. The row carries `root`, the checkout it ran in, and nothing naming a project, so each one comes back with its own checkout for the caller to attribute rather than attributed here. Read whole and then ordered: `at` is stamped when a consult starts and its row appended when it ends, so append order is not time order and a walk that stopped at the first expired row would lose the live ones behind it. */
export const checkStops = (bytes, { command, ms, since }) => {
  const out = [];
  for (const one of jsonlBack(bytes, [markFor(command)])) {
    const at = Date.parse(one.at);
    if (!Number.isFinite(at) || at < since) continue;
    for (const said of one.refused ?? []) {
      const hit = STOPPED.exec(said);
      if (hit?.[1] === command && Number(hit[2]) * 1000 >= ms) out.push({ at: one.at, root: one.root ?? null });
    }
  }
  return out.sort((first, next) => Date.parse(next.at) - Date.parse(first.at));
};
