/* What a record's field has to SAY, as against whether it is there. Each is applied at the write and again on the read-back, so a record typed past this route is measured by the same rule, and each returns the sentence its refusal reads or null. docs/cli/record.md. */

/** A repeating field's own rule over every value it was given, applied by the write and by the read-back through this one call. */
export const eachProblem = (field, values) =>
  (values ?? []).map((one) => field.each?.(one)).find(Boolean) ?? null;

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

export const whereProblem = (value) => {
  const said = String(value ?? "");
  if (OPENABLE.some((one) => one.test(said))) return null;
  return "takes a path or an identifier — a file, a symbol, a clause, an issue key — so a reader can "
    + `go and open it; \`${said}\` names nothing to look at, and a confirmation whose where names `
    + "nothing is one nobody can check.";
};

/* The reading, the assumption it was taken under, and the line that reverses it; the third is what a decision record exists for. */
export const DECISION_PARTS = ["reading", "assumption", "undo"];
const PARTS = DECISION_PARTS.length;

export const decisionProblem = (value) => {
  const parts = String(value ?? "").split("|").map((one) => one.trim());
  const undo = parts.slice(PARTS - 1).join("|").trim();
  if (parts.length >= PARTS && undo) return null;
  return `takes \`${DECISION_PARTS.join(" | ")}\` — three parts on one line — and this one carries `
    + `${parts.filter(Boolean).length} of them. The ${DECISION_PARTS.at(-1)} is the part that says `
    + `what reverses the decision, and one with none is a decision nobody can take back.`;
};
