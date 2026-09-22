/* R-11's escape leaves a criterion unproved and owed to an issue, so it is a promise, and a promise
   names somebody who can still keep it. The SHAPE of one is judged in
   plugin/src/spec/claims/proof.mjs, offline and handed no status at all, because the documentation
   gates and the suite run with no tracker and have to answer the same way twice. Its SUBJECT is
   here, read in the two places that already have what they need: the report that spends the tracker,
   and the act that ends the owing, which spends nothing. UC-14-8 states the division. */
import { escapesIn } from "../../spec/claims/proof.mjs";
import { noLongerOwes } from "../../flow/earned/park-status.mjs";
import { TREE, specTreeRead } from "../../spec/tree.mjs";

/** What a whole reading says of a key it holds no issue for. No such issue keeps a promise either,
 *  so it stands with the closed and the dropped rather than with the ones still owing. */
export const MISSING = "no such issue";

const ended = (status) => status === MISSING || noLongerOwes(status);

const LABEL = "proof escapes";

/** Every escape of `documents` judged by `statusOf`, which takes a key and answers its status, or
 *  `null` where this reading cannot say — on which nothing is passed and nothing is failed. An
 *  escape naming no key at all is counted and not judged: that is `proofProblems`'s finding. */
export const owingRead = (documents, statusOf) => {
  const escapes = escapesIn(documents);
  const judged = escapes
    .filter((one) => one.key)
    .map((one) => ({ ...one, status: statusOf(one.key) }));
  return {
    escapes: escapes.length,
    unnamed: escapes.length - judged.length,
    gone: judged.filter((one) => ended(one.status)),
    unjudged: judged.filter((one) => one.status === null),
  };
};

const tally = (rows, of) => {
  const counts = new Map();
  for (const row of rows) counts.set(of(row), (counts.get(of(row)) ?? 0) + 1);
  return [...counts].sort((one, two) => two[1] - one[1]);
};

const named = (counts, keep) => counts.slice(0, keep).map(([one, held]) => `${one} ${held}`).join(", ");

const ROUTE = "Point each at the case that proves its clause, or at an issue that still owes it";

const goneSaid = ({ escapes, gone }) => {
  const byKey = tally(gone, (one) => one.key);
  const byFile = tally(gone, (one) => one.file);
  const rest = byKey.length > 3 ? `, and ${byKey.length - 3} more key(s)` : "";
  return `${gone.length} of ${escapes} escape(s) under ${TREE}/ are owed to an issue that no longer`
    + ` owes the case: ${named(byKey, 3)}${rest}. Most of them are in ${byFile[0][0]}`
    + ` (${byFile[0][1]}). ${ROUTE} — \`grep -rn "none yet — ${byKey[0][0]}" ${TREE}\` names its lines`;
};

const cleanSaid = ({ escapes }) => (escapes
  ? `${escapes} escape(s) under ${TREE}/, every one of them owed to an issue that still owes the case`
  : `no criterion under ${TREE}/ stands on R-11's escape`);

/** `forge doctor`'s rows for one reading, and none at all where the project keeps no tree. A reading
 *  that did not reach the escapes is a note and never a fault: the row says how many went unjudged
 *  and why, which is neither a pass nor a red on any of them. */
export const owingEscapeRows = ({ read, why = null } = {}) => {
  if (!read) return [];
  if (read.unjudged.length) {
    return [{ level: "note", label: LABEL, detail: `${read.unjudged.length} of ${read.escapes}`
      + ` escape(s) under ${TREE}/ went unjudged: ${why ?? "the issue list did not answer"}.`
      + " Nothing is passed or failed on a reading that did not reach it" }];
  }
  return [{ level: read.gone.length ? "miss" : "ok", label: LABEL,
    detail: read.gone.length ? goneSaid(read) : cleanSaid(read) }];
};

/* Why a reading judges nothing, in the words the row prints. Both shapes are `cutSaid`'s rule in
   plugin/src/trace/citing.mjs: a set that may be short derives no status. */
const whyShort = (read) => {
  if (read?.refused) return `the tracker refused the issue list — ${read.refused}`;
  if (!read?.whole) return "the issue list reported rows behind the last page it answered";
  return null;
};

/** The escapes of this checkout's tree against one whole-project issue reading. A key the reading
 *  holds no row for is `MISSING`; every key is unjudged where the reading itself was short. */
export const owingEscapesFrom = (read, held = specTreeRead()) => {
  if (!held) return { read: null, why: null };
  const whole = Boolean(read?.whole) && !read?.refused;
  const status = new Map((read?.rows ?? [])
    .map((row) => [String(row?.issueId ?? "").toUpperCase(), row?.status]));
  const statusOf = (key) => (whole ? status.get(key.toUpperCase()) ?? MISSING : null);
  return { read: owingRead(held.documents, statusOf), why: whyShort(read) };
};

/** What a move into a status that owes nothing leaves behind: every criterion of this checkout's
 *  tree whose escape cites the key that moved, with its file and line. The tree is a local read, so
 *  this spends no call, and a project keeping no tree is told nothing. */
export const escapesOrphaned = (status, key, held = specTreeRead()) => {
  if (!noLongerOwes(status) || !held) return [];
  const wanted = String(key ?? "").toUpperCase();
  const mine = escapesIn(held.documents).filter((one) => one.key?.toUpperCase() === wanted);
  if (!mine.length) return [];
  const many = mine.length === 1 ? "1 criterion" : `${mine.length} criteria`;
  return ["",
    `${many} under ${TREE}/ stand unproved and owed to ${wanted}, which owes nothing now:`,
    ...mine.map((one) => `  ${one.file}:${one.line} ${one.id}`),
    `${ROUTE}. Until one of those, the tree reads as though somebody were still going to prove them.`];
};
