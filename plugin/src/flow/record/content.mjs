/* What a record's field has to SAY, as against whether it is there. Each is applied at the write and again on the read-back, so a record typed past this route is measured by the same rule, and each returns the sentence its refusal reads or null. docs/cli/record.md. */

/** A repeating field's own rule over every value it was given, applied by the write and by the read-back through this one call. */
export const eachProblem = (field, values) =>
  (values ?? []).map((one) => field.each?.(one)).find(Boolean) ?? null;

/* An identity commit names what a verdict judged or what a deployment is, and core refuses an
   abbreviation of it the same words its runtime is (VERDICT_COMMIT_NOT_FULL), so an `identity` field
   takes only a whole object id — the two widths `machine/identity.mjs`'s WHOLE_ID reads. A commit that
   is not an identity — a merged clause's landing sha, a landed commit a head contains — is matched by
   its short head through `sameCommit`, so it keeps the 7-to-40-hex form, as `isCommit` does (ISS-20). */
const FULL_COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu;

export const isFullCommit = (value) => FULL_COMMIT.test(String(value ?? "").trim());

const HEX = "7 to 40 hex digits";
const WHOLE_SHA = "a full sha — 40 hex digits (git sha-1) or 64 (sha-256), the whole object id "
  + "`$(git rev-parse HEAD)` gives";

/** What a commit-typed field takes, and the refusal a value that is no sha earns, both in that field's own words: its `takes` where it declares one, else its label, and neither where those words are the flag's own, since `takes commit as ...` hands a caller back the word it typed. An `identity` commit must be whole, so its width is the full sha; any other is matched by its head, so it reads the short form. The sentence is composed after `--<flag>` by whichever table holds the field. One home, because two tables refuse such a value and `-h` describes it, and a flag name written as a literal in any of them refuses the kind's second commit-typed field in the first's name (ISS-833). */
export const commitTakes = (field) => {
  const said = field.takes ?? String(field.label ?? "").toLowerCase();
  const width = field.identity ? WHOLE_SHA : HEX;
  return said === field.flag ? width : `${said} as ${width}`;
};

export const commitProblem = (field, value) => `takes ${commitTakes(field)}, not \`${value}\`.`;

/* A place a reader can open: a path by separator or extension, a backticked span, a code name in any of
   the three casings this tree writes, a clause or issue key, or a design flow's state by its kebab name
   and revision — `hop-expected-next-state rev 2` (ISS-27). */
const OPENABLE = [
  /[\w.@-]+\/[\w./@-]+/u,
  /\b[\w-]+\.[A-Za-z]{2,5}\b/u,
  /`[^`\n]+`/u,
  /\b[A-Z]{2,}(?:[-_][A-Z0-9]+)+\b/u,
  /\b[a-z][a-z0-9]*[A-Z]\w*\b/u,
  /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/u,
  /\b[A-Za-z_]\w*\(\)/u,
  /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+ rev \d+\b/u,
];

/** What the field takes, in the words its own refusal opens with and its kind's help prints: a form
 *  stated only where a value is turned back is one a caller pays a composed write to learn (ISS-457).
 *  Every field carrying an `each` declares one of these, and `record-rows.mjs` prints it. */
export const WHERE_TAKES = "a path or an identifier — a file, a symbol, a clause, an issue key — so a "
  + "reader can go and open it";

export const whereProblem = (value) => {
  const said = String(value ?? "");
  if (OPENABLE.some((one) => one.test(said))) return null;
  return `takes ${WHERE_TAKES}; \`${said}\` names nothing to look at, and a confirmation whose where `
    + "names nothing is one nobody can check.";
};

/* A wave's member is read live by this value alone, so anything around it is a member the resume cannot
   find (ISS-818). Core takes the member as a uuid; the issue key is the hand-typed form of the same one,
   so both read, and nothing around either does (ISS-17). */
const MEMBER_KEY = /^[A-Z][A-Z0-9]*-\d+$/u;
const MEMBER_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const MEMBER_TAKES = "an issue key, `ISS-45`, or an issue uuid, one per --member";

export const memberProblem = (value) => {
  const said = String(value ?? "");
  return MEMBER_KEY.test(said) || MEMBER_UUID.test(said)
    ? null
    : `takes ${MEMBER_TAKES}; \`${value}\` is not one, and a member the resume cannot read by its key or its uuid is one it cannot report.`;
};

/* The reading, the assumption it was taken under, and the line that reverses it; the third is what a decision record exists for. */
export const DECISION_PARTS = ["reading", "assumption", "undo"];
const PARTS = DECISION_PARTS.length;

export const DECISION_TAKES = `\`${DECISION_PARTS.join(" | ")}\` — three parts on one line`;

export const decisionProblem = (value) => {
  const parts = String(value ?? "").split("|").map((one) => one.trim());
  const undo = parts.slice(PARTS - 1).join("|").trim();
  if (parts.length >= PARTS && undo) return null;
  return `takes ${DECISION_TAKES} — and this one carries `
    + `${parts.filter(Boolean).length} of them. The ${DECISION_PARTS.at(-1)} is the part that says `
    + `what reverses the decision, and one with none is a decision nobody can take back.`;
};

/* A finding is a disposition against an identifier the reviewer chose: the series is a reviewer's to
   number from F1 or from G1 (ISS-933), and a bare number is a count. The consult that raised it may
   open the line, so two reads' F1s stand as rows a reader can tell apart. Words after either
   disposition say what changed or why, an acceptance being where the sentence a later reader has to
   have actually lives. */
const FINDING = /^(?:\S+ )?[A-Za-z]+\d+ (?:accepted(?:: .+)?|rejected: .+)$/u;
/* Asked before the grammar, so a rejection with nothing after it is told what it lacks rather than
   what shape to take. Its identifier is as loose as the other's, or a `G1 rejected` would fall to a
   message about a grammar it already satisfies. */
const BARE_REJECTED = /^(?:\S+ )?[A-Za-z]+\d+ rejected$/u;

export const FINDING_TAKES = "`F1 accepted`, `F1 rejected: why`, or either opening with the consult "
  + "that raised it — `8c1a15 F1 accepted: what changed`";

export const findingProblem = (value) => {
  const said = String(value ?? "");
  if (BARE_REJECTED.test(said)) return `needs a reason after a rejected finding: \`${said}: why\``;
  return FINDING.test(said) ? null : `takes ${FINDING_TAKES}, not \`${said}\``;
};

export const RECOMMEND_TAKES = "the number of the reading this run would take, counting the first `--reading` as 1";

/** A question's recommended reading, by its number among the readings. Absent is a record written
 *  before the field existed, which the write refuses on its own as a missing flag. */
export const recommendProblem = (given, count) => {
  if (given === undefined) return null;
  const at = /^\d+$/u.test(String(given)) ? Number(given) : 0;
  return at >= 1 && at <= count ? null
    : `--recommend naming one of the ${count} readings, not \`${given}\`: it takes ${RECOMMEND_TAKES}`;
};
