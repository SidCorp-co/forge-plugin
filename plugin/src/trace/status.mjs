/* What a clause's rung is derived from, and nothing that fetches. AC-14-4-3, docs/cli/spec-the-status.md. */
import { criteriaOf, lookAnswered } from "../flow/earned.mjs";
import { verdictHeads } from "../flow/record/merged.mjs";
import { sameCommit } from "../tracker/evidence.mjs";
import { opensWith } from "../spec/parse.mjs";

export const RUNGS = ["unclaimed", "partial", "implemented", "verified"];

export const opensOn = (row, id) => criteriaOf(row)
  .filter((one) => opensWith(one.text)?.id === id)
  .map((one) => one.number);

export const couldProve = (row, id) =>
  row?.status === "closed" && Boolean(row?.mergedAt) && opensOn(row, id).length > 0;

/* Every criterion it opened on the clause: three claims with one failed is not a proof. */
const proved = (row, id, view) => {
  const numbers = opensOn(row, id);
  const heads = view ? verdictHeads(view.comments) : [];
  if (!numbers.length || !heads.length) return false;
  return numbers.every((number) => {
    const held = view.verdicts.get(number)?.record.fields;
    return held?.verdict === "pass" && heads.some((one) => sameCommit(held.commit, one));
  });
};

/* Declared, never inferred: a plan answering neither question, or carrying no witnessed section, has not said no look was owed.
   A `none` under that section has, and is read here as it is at the rung that asks for the park, or a clause proved by an issue owed none stays short of the top rung waiting for one. */
const declaresNoScreen = ({ screen, look }) => screen === "no" && look === "no";
const looked = (view) => declaresNoScreen(view.flags) || view.witnessed?.none === true || lookAnswered(view);

const rungOf = (provers) => {
  if (!provers.length) return "partial";
  return provers.every(({ view }) => looked(view)) ? "verified" : "implemented";
};

/** A verdict this did not reach and one nobody wrote read alike, so a prefix costs the rung too. */
const threadCut = (short) => `${short.join("\n")}\nNo rung is derived where the record of an `
  + "issue that could prove the clause came back a prefix.";

/** One clause's rung; null where the set was cut, those rows then saying nothing about it. */
export const clauseStatus = (id, read, views = new Map(), short = []) => {
  const citedBy = (read?.rows ?? []).map((row) => ({ issueId: row.issueId, cited: row.cited }));
  const cut = read?.cut ?? (short.length ? threadCut(short) : null);
  if (!read || cut) return { id, rung: null, cut, citedBy, provers: [] };
  const provers = read.rows
    .map((row) => ({ row, view: views.get(row.documentId) }))
    .filter(({ row, view }) => view && proved(row, id, view));
  return {
    id,
    rung: read.rows.length ? rungOf(provers) : "unclaimed",
    cut: null,
    citedBy,
    provers: provers.map(({ row }) => row.issueId),
  };
};

/** A requirement stands at the lowest rung any clause under it took, and at none where any was cut. */
export const lowestOf = (statuses) => {
  if (!statuses.length) return null;
  if (statuses.some((one) => one.rung === null)) return null;
  return RUNGS[Math.min(...statuses.map((one) => RUNGS.indexOf(one.rung)))];
};
