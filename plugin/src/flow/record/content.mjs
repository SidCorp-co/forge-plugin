/* What a record's field has to SAY, as against whether it is there. Each is applied at the write and again on the read-back, so a record typed past this route is measured by the same rule, and each returns the sentence its refusal reads or null. docs/cli/record.md. */

/** A repeating field's own rule over every value it was given, applied by the write and by the read-back through this one call. */
export const eachProblem = (field, values) =>
  (values ?? []).map((one) => field.each?.(one)).find(Boolean) ?? null;

const HEX = "7 to 40 hex digits";

/** What a commit-typed field takes, and the refusal a value that is no sha earns, both in that field's own words: its `takes` where it declares one, else its label, and neither where those words are the flag's own, since `takes commit as ...` hands a caller back the word it typed. The sentence is composed after `--<flag>` by whichever table holds the field. One home, because two tables refuse such a value and `-h` describes it, and a flag name written as a literal in any of them refuses the kind's second commit-typed field in the first's name (ISS-833). */
export const commitTakes = (field) => {
  const said = field.takes ?? String(field.label ?? "").toLowerCase();
  return said === field.flag ? HEX : `${said} as ${HEX}`;
};

export const commitProblem = (field, value) => `takes ${commitTakes(field)}, not \`${value}\`.`;

/* A place a reader can open: a path by separator or extension, a backticked span, a code name in any of the three casings this tree writes, or a clause or issue key. */
const OPENABLE = [
  /[\w.@-]+\/[\w./@-]+/u,
  /\b[\w-]+\.[A-Za-z]{2,5}\b/u,
  /`[^`\n]+`/u,
  /\b[A-Z]{2,}(?:[-_][A-Z0-9]+)+\b/u,
  /\b[a-z][a-z0-9]*[A-Z]\w*\b/u,
  /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/u,
  /\b[A-Za-z_]\w*\(\)/u,
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
