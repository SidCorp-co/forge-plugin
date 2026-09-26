/* What a caller reads before typing a flag, for the two checks that hold every printed `forge` form to it. Help is per sub-verb and per record kind, so `--criterion` is on `record verdict -h` and `--send` on `codex consult -h`: a check that stops at the verb's row judges neither, and one that took every kind's text at once would judge nothing. One table, because the doc walk and the source walk drifting apart is the same defect twice (ISS-700). */
import { USAGE as ADVANCE } from "../src/flow/advance.mjs";
import { USAGE as CLAIM } from "../src/flow/claim.mjs";
import { USAGE as RECORD } from "../src/flow/record/record.mjs";
import { USAGE as RESUME } from "../src/flow/resume.mjs";
import { SAYS as CLOUDFLARE, USAGE as CLOUDFLARE_USAGE } from "../src/tools/services/cloudflare.mjs";
import { SAYS as COOLIFY, USAGE as COOLIFY_USAGE } from "../src/tools/services/coolify/coolify.mjs";
import { ALIASES as COOLIFY_ALIASES } from "../src/tools/services/coolify/routes.mjs";
import { SAYS as GOOGLE, USAGE as GOOGLE_USAGE } from "../src/tools/services/google/google.mjs";
import { SAYS as CHATGPT, USAGE as CHATGPT_USAGE } from "../src/tools/services/chatgpt.mjs";
import { SAYS as CODEX, USAGE as CODEX_USAGE } from "../src/codex/codex.mjs";
import { SAYS as KNOWLEDGE, USAGE as KNOWLEDGE_USAGE } from "../src/tools/knowledge.mjs";
import { SAYS as STATS } from "../src/stats/stats.mjs";
import { CHECK_USAGE, USAGE as SPEC } from "../src/spec/verbs.mjs";
import { KINDS, kindUsage } from "../src/flow/record/record-rows.mjs";
import { usageOf } from "../src/resolve/visibility.mjs";
import { SAYS as DOCTOR } from "../src/tools/services/doctor/subjects.mjs";

/** The verb's own `-h` text, for a row on `forge -h` that names no flag because it delegates. */
export const OWN = {
  advance: ADVANCE, chatgpt: CHATGPT_USAGE, claim: CLAIM, cloudflare: CLOUDFLARE_USAGE,
  coolify: COOLIFY_USAGE, google: GOOGLE_USAGE,
  codex: CODEX_USAGE, knowledge: KNOWLEDGE_USAGE, record: RECORD, resume: RESUME, spec: SPEC,
};

/** One level in, for a verb that refuses every other word in that slot: the sub-verb's or the kind's own text, keyed by the word the caller types, and so also the set that slot takes. `spec` is out of it because `forge spec BR-09` names a clause of the requirements tree and only `check` is a word, and coolify's short forms are added back because they dispatch through `ALIASES` and print the group's text rather than one of their own. */
const CLOSED = {
  chatgpt: CHATGPT,
  cloudflare: CLOUDFLARE,
  coolify: COOLIFY,
  google: GOOGLE,
  codex: CODEX,
  knowledge: KNOWLEDGE,
  record: Object.fromEntries(KINDS.map((kind) => [kind, kindUsage(kind)])),
  stats: STATS,
};

const ALSO = { coolify: Object.keys(COOLIFY_ALIASES) };

/* The one doctor subject whose flags follow its name, so its own text is the surface a form after it
   is held to. */
const UNDER = { ...CLOSED, spec: { check: CHECK_USAGE }, doctor: { modules: DOCTOR.modules } };

export const wordsOf = (verb) =>
  (CLOSED[verb] ? [...Object.keys(CLOSED[verb]), ...(ALSO[verb] ?? [])] : null);

/* A word no table knows is a positional, not a sub-verb: `forge attach issue ISS-1 body.md` is judged by the verb's surface, where an empty one would turn every flag on it into a finding. A verb's surface is both tables and not the first one that names a flag: `forge -h` prints one row per verb under a one-screen cap, so a verb long enough keeps flags on its own `-h` alone, and reading the row as the whole surface made `--undeployed` read as a flag the CLI does not have while `forge claim -h` named it (ISS-1993). The row is still held to its own flags where a case pins them. */
export const surfaceOf = (verb, sub = null) => {
  const row = usageOf(verb);
  const under = sub ? UNDER[verb]?.[sub] : null;
  if (under) return `${row}\n${under}`;
  return OWN[verb] ? `${row}\n${OWN[verb]}` : row;
};
