/* Which populations a reading may be compared across: the same table classed them and the same
   answers armed it. What the rows are is `classes.mjs`; what a crossing costs a comparison is
   docs/cli/stats-the-latency.md. */
import { DEPLOY, POLL, READY_CLASS, SHELL, WAIT } from "./classes.mjs";

/** The generation of the class table. A row added or removed, or a pattern changed so a call moves
 *  between rows, is a new generation, and a reading carries the one that classed it. */
export const TABLE = 3;

/** The generation each row's population last changed at; a row absent from here has stood
 *  throughout. Only the last change matters: a row is comparable with a reading held at generation
 *  `g` exactly where this is at or below `g`. A row taken out of the table keeps its entry, and a
 *  row that took another's calls is stamped where it took them, its pattern unmoved. This answers
 *  for the table and for nothing a project said or declared — the two sets below name those. */
export const MOVED_AT = new Map([["read", 3], [POLL, 3], [WAIT, 3], [SHELL, 3], [DEPLOY, 3],
  ["forge claim", 3]]);

/** The rows a project's release model decides — `DECLARABLE`'s parallel for the half its own words
 *  decide. The `deploy` row is in the table only where that model says the release reaches
 *  production on its own, so there the four rows below it hand over calls and the fallback loses
 *  those no row matched; and what `ship` counts is the whole of the phase where the project commands
 *  its release and the landing alone where it does not. A reading carries both halves, or a
 *  redeclared row reads as a row that got slower (ISS-1975, ISS-2086). */
export const DECIDED_BY_RELEASE = [DEPLOY, "read", POLL, WAIT, SHELL, "ship", READY_CLASS];
