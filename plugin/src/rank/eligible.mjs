/* Which open issues a run may take, and the sentence for every one it may not. A filter dropping a
   row in silence is a backlog that shrank for no stated reason: docs/cli/next.md. */
import { describe, leaseOf, stateOf } from "../flow/lease.mjs";
import { TAKEABLE, TERMINAL } from "./weights.mjs";
import { sessionOf } from "../resolve/config.mjs";

/* A path in a code span, in the segment shape a repository names a file or a tree by. */
const SPAN = /`([^`\n]+)`/gu;
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
export const eligibilityOf = (row, { blockers = [], lease = null, body = null, held = [] } = {}) => {
  const status = String(row?.status ?? "");
  if (!TAKEABLE.includes(status)) {
    return { eligible: false, soft: false, reason: `status ${status || "(none)"} is not one a run takes` };
  }
  const taken = leaseOf(lease);
  if (stateOf(taken, sessionOf()) === "live") {
    return { eligible: false, soft: false, reason: `lease held by ${describe(taken)}` };
  }
  const stuck = blockers.filter((one) => !TERMINAL.includes(one.status));
  if (stuck.length) {
    return {
      eligible: false,
      soft: false,
      reason: stuck.map((one) => `blocked by ${one.issueId} (${one.status})`).join(", "),
    };
  }
  const mine = body === null ? [] : pathsNamed(body);
  const shared = held.find((one) => mine.some((path) => meets(path, one.path)));
  if (shared) {
    return { eligible: false, soft: true, reason: `holds ${shared.path} with ${shared.issueId}` };
  }
  return { eligible: true, soft: false, reason: null };
};
