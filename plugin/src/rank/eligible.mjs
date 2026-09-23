/* Which open issues a run may take, and the sentence for every one it may not. A filter dropping a
   row in silence is a backlog that shrank for no stated reason: docs/cli/next.md. */
import { CODE_SPAN_NONEMPTY_PATTERN } from "../markdown.mjs";
import { describe, leaseOf, stateOf } from "../flow/lease.mjs";
import { TAKEABLE } from "./weights.mjs";
import { holdsBack } from "../flow/earned.mjs";
import { sessionOf } from "../resolve/config.mjs";
import { INDEPENDENT } from "../flow/qa/verdicts.mjs";
import { judgementOf, policyUnread } from "../tracker/project-config.mjs";
import { filedAt } from "./score.mjs";

/* A path in a code span, in the segment shape a repository names a file or a tree by. */
const SPAN = new RegExp(CODE_SPAN_NONEMPTY_PATTERN, "gu");
const PATH = /^[\w.@-]+(?:\/[\w.@-]*)+$/u;

export const pathsNamed = (text) => {
  const found = new Set();
  for (const [, span] of String(text ?? "").matchAll(SPAN)) {
    const one = span.trim().replace(/[,.;:]$/u, "");
    if (PATH.test(one)) found.add(one);
  }
  return [...found];
};

const bare = (path) => path.replace(/\/+$/u, "");

/** The same file, or one path naming a tree the other sits in. */
export const meets = (one, other) => {
  const [left, right] = [bare(one), bare(other)];
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
};

export const heldPaths = (plans) =>
  plans.flatMap(({ issueId, plan }) => pathsNamed(plan).map((path) => ({ issueId, path })));

/** One row's verdict and the reason with it. `body` is null where the window did not read it, and
 *  the filter that needs one then says nothing rather than guessing. */
export const eligibilityOf = (row,
  { blockers = [], unresolved = [], lease = null, body = null, held = [] } = {}) => {
  const status = String(row?.status ?? "");
  if (!TAKEABLE.includes(status)) {
    return { eligible: false, soft: false, reason: `status ${status || "(none)"} is not one a run takes` };
  }
  const taken = leaseOf(lease);
  if (stateOf(taken, sessionOf()) === "live") {
    return { eligible: false, soft: false, reason: `lease held by ${describe(taken)}` };
  }
  const stuck = blockers.filter(holdsBack);
  if (stuck.length) {
    return {
      eligible: false,
      soft: false,
      reason: stuck.map((one) => `blocked by ${one.otherDisplayId} (${one.otherStatus})`).join(", "),
    };
  }
  if (unresolved.length) {
    return {
      eligible: false,
      soft: false,
      reason: unresolved.map((one) => `names "${one.phrase}" as a blocker, matching no title`).join(", "),
    };
  }
  const mine = body === null ? [] : pathsNamed(body);
  const shared = held.find((one) => mine.some((path) => meets(path, one.path)));
  if (shared) {
    return { eligible: false, soft: true, reason: `holds ${shared.path} with ${shared.issueId}` };
  }
  return { eligible: true, soft: false, reason: null };
};

/** The status a judging run claims from, the declaration that offers one, and the lease that leaves
 *  one out — this session's own included, where `eligibilityOf` lets it through, an issue a run
 *  holds being its own to carry on with. Listed apart and what a row costs: docs/cli/next.md. */
export const JUDGING = ["developed"];

const offersJudging = (policy) => judgementOf(policy) === INDEPENDENT;

const judgingVerdict = (lease) => {
  const taken = leaseOf(lease);
  return ["live", "mine"].includes(stateOf(taken, sessionOf()))
    ? { offerable: false, reason: `lease held by ${describe(taken)}` }
    : { offerable: true, reason: null };
};

/** Offered, left out, and what the bound did not reach, oldest first so the bound covers the same
 *  rows on every call. `leaseFor` is the caller's, this module answering off values. */
export const judgingFrom = async (rows, { policy, leaseFor, cap }) => {
  const why = policyUnread(policy);
  if (why) return { unread: why };
  if (!offersJudging(policy)) return null;
  const at = rows
    .filter((one) => JUDGING.includes(String(one?.status ?? "")))
    .sort((one, other) => filedAt(one) - filedAt(other));
  const window = at.slice(0, cap);
  const judged = await Promise.all(window.map(async (row) =>
    ({ row, issueId: row.issueId, ...judgingVerdict(await leaseFor(row)) })));
  return {
    offered: judged.filter((one) => one.offerable),
    left: judged.filter((one) => !one.offerable),
    unreached: at.length - window.length,
  };
};
