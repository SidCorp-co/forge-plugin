/* Which populations a reading may be compared across: the same table classed them and the same
   answers armed it. What the rows are is `classes.mjs`; what a crossing costs a comparison is
   docs/cli/stats-the-latency.md. */
import {
  CLAIM_CLASS, DEPLOY, POLL, READY_CLASS, RECHECK_CLASS, SHELL, SHELL_EDITS, WAIT, WHOLE_SET_CLASS,
} from "./classes.mjs";

/** The generation of the class table. A row added or removed, or a pattern changed so a call moves
 *  between rows, is a new generation, and a reading carries the one that classed it. */
export const TABLE = 3;

/** The table before readings carried a generation; those cross every row. */
const FIRST = 1;

/** The generation each row's population last changed at, birth included: every row `namedRows()`
 *  gives, so one added without a generation is red rather than a silent zero, and a verb's own row
 *  only where another took its calls. A row is comparable with a reading held at `g` exactly where
 *  this is at or below `g`. A removed row keeps its entry; one that took another's calls is stamped
 *  where it took them. The table's alone: what a project decides is below. */
export const MOVED_AT = new Map([
  ...["gate", "ship", "test", "cleanup", "git", "edit", "write", WHOLE_SET_CLASS, RECHECK_CLASS]
    .map((label) => [label, FIRST]),
  ["read", 3], [POLL, 3], [WAIT, 3], [SHELL, 3], [DEPLOY, 3], [CLAIM_CLASS, 3], [READY_CLASS, 3],
  ...SHELL_EDITS.map((label) => [label, 3])]);

/** The rows a project's release model decides — `DECLARABLE`'s parallel for the half its own words
 *  decide. The `deploy` row is in the table only where that model says the release reaches
 *  production on its own, so there the four rows below it hand over calls and the fallback loses
 *  those no row matched; and what `ship` counts is the whole of the phase where the project commands
 *  its release and the landing alone where it does not. A reading carries both halves, or a
 *  redeclared row reads as a row that got slower (ISS-1975, ISS-2086). */
export const DECIDED_BY_RELEASE = [DEPLOY, "read", POLL, WAIT, SHELL, ...SHELL_EDITS,
  "ship", READY_CLASS];
