/* A clause of the requirements tree, asked for by identifier and printed as the phase implementing
   it needs it. What the identifiers mean and what a citation claims: docs/requirements/. */
import { fail } from "./resolve/settings.mjs";
import { usageOf } from "./resolve/visibility.mjs";
import { Refused, refuse } from "./record.mjs";
import { didYouMean } from "./suggest.mjs";
import { KIND, parseRef } from "./spec/parse.mjs";
import { ambiguousUnder, clauseOf, lookup, nearest, withDescendants } from "./spec/index.mjs";
import { specTree } from "./spec/tree.mjs";

const FORMS = "FR-04 · UC-04-3 · AC-04-3-1 · NFR-02 · EI-01 · BR-09 · G-01 · M-01 · C-05 · A-02";
const LINK = /\[([^\]]*)\]\([^)]*\)/gu;

/* A link's target is the tree's own storage, and this verb addresses clauses by identifier: the
   label is the clause's words, the target is how they are filed. */
const readable = (text) => String(text).replace(LINK, "$1");
const HELD_IN_A_ROW = ["BR", "G", "M", "C", "A"];
const KNOWN = ["--json", "--where"];
const TWO_HOMES = "two documents define this: ask for it alone, and both are named.";

export const USAGE = [
  usageOf("spec"),
  "One clause of this project's requirements tree, by identifier and never by path: a requirement",
  "with its use cases and their criteria, a use case with its criteria, a business rule with the",
  "clauses that enforce it, a criterion on its own.",
  "",
  `  <id>        ${FORMS}`,
  "  <id>~<rev>  a citation: the clause prints, and a revision that has moved is called stale",
  "  --json      the clause and everything printed under it, one object each, for a verb to read",
  "  --where     the file and heading behind each clause, the one path this verb ever prints",
  "",
  "An unknown identifier is refused with the nearest ones, and one that two documents define is",
  "refused as ambiguous. The rules, the notation and what a citation claims: docs/requirements/.",
].join("\n");

const headLine = (clause, pad) => {
  const title = clause.title && clause.title !== clause.id ? ` — ${clause.title}` : "";
  return `${pad}${clause.id}${title}${clause.rev === null ? "  (no revision)" : `  rev ${clause.rev}`}`;
};

const fieldLine = (clause) =>
  Object.entries(clause.fields)
    .filter(([key, value]) => !["Rev", "Enforces"].includes(key) && value !== clause.title)
    .map(([key, value]) => `${key}: ${readable(value)}`)
    .join(" · ");

/* Every identifier a print carries is answered the way the asked one is: a clause is ambiguous
   when a document above it is, and naming it by whichever copy was read first would answer with a
   clause nobody asked for. */
const twoHomes = (index, id) => {
  const found = lookup(index, id);
  if (!found.ambiguous) return null;
  if (!found.via) return TWO_HOMES;
  return `sits under ${found.via}, which two documents define: ask for ${found.via} alone, and both are named.`;
};

const named = (index, ids, pad) =>
  ids.map((id) => {
    const two = twoHomes(index, id);
    if (two) return `${pad}${id}  ${two}`;
    return `${pad}${id}  ${clauseOf(index, id)?.title ?? "(no clause of that identifier)"}`;
  });

const linesFor = (index, clause, pad, given) => {
  const out = [headLine(clause, pad)];
  const fields = fieldLine(clause);
  if (fields) out.push(`${pad}${fields}`);
  if (given.where) out.push(`${pad}in ${clause.file}${clause.heading ? `, under "${clause.heading}"` : ""}`);
  if (clause.enforces.length) out.push(`${pad}Enforces:`, ...named(index, clause.enforces, `${pad}  `));
  if (clause.text && !HELD_IN_A_ROW.includes(clause.prefix)) {
    const body = readable(clause.text).split("\n").map((line) => (line ? `${pad}${line}` : ""));
    out.push(...(body.length > 1 ? ["", ...body] : body));
  }
  for (const child of clause.children) {
    const two = twoHomes(index, child);
    if (two) {
      out.push("", `${pad}  ${child}  ${two}`);
      continue;
    }
    out.push("", ...linesFor(index, clauseOf(index, child), `${pad}  `, given));
  }
  return out;
};

const staleLine = (ref, clause) => {
  if (ref.cited === null) return null;
  if (clause.rev === null) {
    return `The citation ${ref.id}~${ref.cited} names a revision and ${ref.id} carries none: its table has no Rev column.`;
  }
  if (clause.rev === ref.cited) return null;
  return `The citation ${ref.id}~${ref.cited} is stale: ${ref.id} is at revision ${clause.rev}, not ${ref.cited}.`;
};

const asData = (clause, given) => ({
  id: clause.id,
  prefix: clause.prefix,
  kind: clause.kind,
  rev: clause.rev,
  title: clause.title,
  text: clause.text,
  fields: clause.fields,
  parents: clause.parents,
  children: clause.children,
  enforces: clause.enforces,
  enforcedBy: clause.enforcedBy,
  citations: clause.citations,
  hash: clause.hash,
  ...(given.where ? { file: clause.file, heading: clause.heading } : {}),
});

const printed = (index, clause, ref, given) => {
  const stale = staleLine(ref, clause);
  if (stale) console.log(`${stale}\n`);
  console.log(linesFor(index, clause, "", given).join("\n"));
  if (clause.parents.length) {
    console.log(`\nOf:\n${named(index, clause.parents, "  ").join("\n")}`);
  }
  if (clause.enforcedBy.length) {
    console.log(`\nEnforced by:\n${named(index, clause.enforcedBy, "  ").join("\n")}`);
  }
};

const read = (argv) => {
  const given = { json: false, where: false };
  const rest = [];
  for (const token of argv) {
    if (!token.startsWith("--")) rest.push(token);
    else if (KNOWN.includes(token)) given[token.slice(2)] = true;
    else refuse(`spec takes no ${token}. Flags: ${KNOWN.join(" ")}`);
  }
  if (!rest.length) refuse(`${usageOf("spec")} — an identifier, not a path. One of ${FORMS}.`);
  if (rest.length > 1) refuse(`spec reads one clause at a time, not \`${rest.join(" ")}\`.`);
  return { given, token: rest[0] };
};

const clauseFor = (index, ref) => {
  const found = lookup(index, ref.id);
  if (found.ambiguous) {
    const what = found.via ? `${ref.id} sits under ${found.via}, which is` : `${ref.id} is`;
    refuse(
      `${what} defined in ${found.ambiguous.join(" and ")}, and an identifier names one clause.\n`
        + "Retire one of them: a retired clause keeps its number and is never reused, so the other stands.",
    );
  }
  if (found.foreign) {
    refuse(`${ref.id} names ${found.foreign}, which is not a clause of the specification. Ask for one of ${FORMS}.`);
  }
  if (!found.clause) refuse(didYouMean("clause", ref.id, nearest(index, ref.id), `The forms are ${FORMS}.`));
  return found.clause;
};

const run = (argv) => {
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") return console.log(USAGE);
  const { given, token } = read(argv);
  const ref = parseRef(token);
  if (!ref) {
    refuse(`\`${token}\` is no identifier of this tree. One of ${FORMS}, optionally with the revision it was cited at, as in BR-09~1.`);
  }
  if (!KIND[ref.prefix] && ref.prefix !== "R") refuse(`\`${token}\` carries no known prefix. One of ${FORMS}.`);
  const index = specTree();
  const clause = clauseFor(index, ref);
  if (!given.json) return printed(index, clause, ref, given);
  return console.log(JSON.stringify({
    asked: token,
    cited: ref.cited,
    stale: Boolean(staleLine(ref, clause)),
    ambiguous: ambiguousUnder(index, clause.id),
    clauses: withDescendants(index, clause.id).map((one) => asData(one, given)),
  }, null, 2));
};

export const spec = (argv) => {
  try {
    run(argv);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
spec.answersHelp = true;
