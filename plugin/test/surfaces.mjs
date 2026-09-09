/* What a caller reads before typing a flag, for the two checks that hold every printed `forge` form to it. Help is per sub-verb and per record kind, so `--criterion` is on `record verdict -h` and `--send` on `codex consult -h`: a check that stops at the verb's row judges neither, and one that took every kind's text at once would judge nothing. One table, because the doc walk and the source walk drifting apart is the same defect twice (ISS-700). */
import { USAGE as ADVANCE } from "../src/flow/advance.mjs";
import { USAGE as CLAIM } from "../src/flow/claim.mjs";
import { USAGE as RECORD } from "../src/flow/record/record.mjs";
import { USAGE as RESUME } from "../src/flow/resume.mjs";
import { SAYS as CLOUDFLARE, USAGE as CLOUDFLARE_USAGE } from "../src/tools/services/cloudflare.mjs";
import { SAYS as CODEX, USAGE as CODEX_USAGE } from "../src/codex/codex.mjs";
import { SAYS as KNOWLEDGE, USAGE as KNOWLEDGE_USAGE } from "../src/tools/knowledge.mjs";
import { SAYS as STATS } from "../src/stats/stats.mjs";
import { CHECK_USAGE, USAGE as SPEC } from "../src/spec/verbs.mjs";
import { KINDS, kindUsage } from "../src/flow/record/record-rows.mjs";
import { usageOf } from "../src/resolve/visibility.mjs";

/** The verb's own `-h` text, for a row on `forge -h` that names no flag because it delegates. */
export const OWN = {
  advance: ADVANCE, claim: CLAIM, cloudflare: CLOUDFLARE_USAGE, codex: CODEX_USAGE,
  knowledge: KNOWLEDGE_USAGE, record: RECORD, resume: RESUME, spec: SPEC,
};

/** One level in: the sub-verb's or the kind's own text, keyed by the word the caller types. */
const UNDER = {
  cloudflare: CLOUDFLARE,
  codex: CODEX,
  knowledge: KNOWLEDGE,
  record: Object.fromEntries(KINDS.map((kind) => [kind, kindUsage(kind)])),
  spec: { check: CHECK_USAGE },
  stats: STATS,
};

/* A word no table knows is a positional, not a sub-verb: `forge attach issue ISS-1 body.md` is judged by the verb's surface, where an empty one would turn every flag on it into a finding. */
export const surfaceOf = (verb, sub = null) => {
  const row = usageOf(verb);
  const under = sub ? UNDER[verb]?.[sub] : null;
  if (under) return `${row}\n${under}`;
  return row.includes("--") ? row : `${row}\n${OWN[verb] ?? ""}`;
};
