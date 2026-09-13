/* What a gate asks the consult log per tool call and per run, answered off the log's bytes: holding it as rows to answer either cost 503 ms and 167 MB of heap on a 43 MB log, where it is the history rather than the question that grew (ISS-1044). The questions needing the reply's own grammar are replies.mjs beside this; these two need none, and all three are a folder down because `plugin/src/codex/` is at the width limit whose stated remedy is a subfolder. */
import { jsonlBack, jsonlMark } from "../../hooks/hook-log-file.mjs";
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
