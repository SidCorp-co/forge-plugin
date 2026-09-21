/* The rows `forge doctor tracker` prints for the name join: what this CLI asks the tracker's project
   row for against what the row answers, in both directions. The join itself is pure and lives in
   `plugin/src/tracker/name-join.mjs`; what is here is the reading and the words.
   docs/cli/the-name-join.md. */

import { SUBJECTS, joined, striking } from "../../../tracker/name-join.mjs";

/* One route, both shapers: they build the identical path, so the row is read once. */
const ROUTE = "GET /projects/:id";

/* Printed rather than left to a reader, on the same reasoning the row below it is: a reader told
   nothing cannot tell a reading that covered the nested shape from one that never looked. Nineteen of
   this credential's thirty-two projects answer null for a configured blob, and a null carries no
   names on the day it is read (ISS-1970, comment 2). */
const THE_BOUND = "the row's own columns and nothing inside any of them, so a blob the row answers "
  + "null for says nothing here about its own keys";

const WHY_UNSERVED = "each reads undefined on every project and travels on as a null, which is what "
  + "a retired column does — delete it from the shaper, or ask the tracker which name took over";

const WHY_UNDECLARED = "each is either a difference somebody chose, and then it is declared with its "
  + "reason in `CHOSEN` of plugin/src/tracker/name-join.mjs, or a blind spot nobody chose";

/* The count and never the names: a reader is owed the knowledge that two columns of this row are
   never reported on, and nothing beyond it. The row it sits on is the one that always prints, the
   withheld being a property of the reading rather than of a shaper that happened to come out clean. */
const withheld = (held) => (held ? `, ${held} withheld unnamed` : "");

/** The rows, given a reading of the row and the day it was read on. The reader is passed in rather
 *  than reached for, so the count of readings is a thing a case can hold this to. */
export const nameJoinRows = async (read, today) => {
  const got = await read();
  const strike = striking(got?.parts?.page);
  const said = (level, detail) => ({ level, label: "name join", detail: strike(detail) });
  if (got?.refused) {
    return [said("note", `${ROUTE} did not answer, so neither direction of the name join was read `
      + "— not a reading that passed. The endpoint and the credential are `forge doctor machine`'s")];
  }
  const row = got?.parts?.page;
  const shapers = SUBJECTS.map((key) => joined(key, row));
  const rows = [said("ok", `read ${today} off ${ROUTE}${withheld(shapers[0].withheld)}, reaching `
    + THE_BOUND)];
  for (const held of shapers) {
    const key = held.key;
    if (held.unserved.length) {
      rows.push(said("miss", `${key} asks the row for ${held.unserved.join(", ")}, which it does not `
        + `carry: ${WHY_UNSERVED}`));
    }
    if (held.undeclared.length) {
      rows.push(said("miss", `${key} never asks for ${held.undeclared.join(", ")}, which the row `
        + `carries: ${WHY_UNDECLARED}`));
    }
    if (!held.unserved.length && !held.undeclared.length) {
      rows.push(said("ok", `${key}: ${held.read.length} asked for, `
        + `${held.declared.length} dropped by declaration`));
    }
  }
  return rows;
};
