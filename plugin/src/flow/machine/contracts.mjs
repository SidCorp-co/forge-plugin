/* A record is judged by the shapes of the contract number its tag carries, so bumping the number
   re-judges nothing earned before it (ISS-60). The current number's row is `SHAPES` itself; a bump
   keeps the old table under its own number before the live one changes, which is what FR-04's way
   back means by leaving the old reader in place. */
import { CONTRACT } from "../../guides/contract.mjs";
import { SHAPES } from "../machine.mjs";

export const SHAPES_AT = Object.freeze({ [CONTRACT]: SHAPES });

/** The newest number a table holds, which is the one this build writes under. */
export const newestOf = (table = SHAPES_AT) => Math.max(...Object.keys(table).map(Number));

export const shapesAt = (contract, table = SHAPES_AT) =>
  (Object.hasOwn(table, contract) ? table[contract] : null);

/* A number past the newest is still read with the newest shapes, so the entry checks meet it and
   refuse it by name rather than the page dropping it unread. */
export const shapeFor = (kind, contract, table = SHAPES_AT) =>
  (shapesAt(contract, table) ?? table[newestOf(table)])[kind] ?? null;

/** Why a record this build cannot judge is refused, with the one step that clears it. */
export const contractGap = (contract, table = SHAPES_AT) => {
  const newest = newestOf(table);
  const held = Object.keys(table).map(Number).sort((a, b) => a - b);
  const reads = held.length > 1 ? `contract ${held[0]} to ${newest}` : `contract ${newest}`;
  return `a contract ${contract} record, and this build reads ${reads}: `
    + "`claude plugin update` then restart the session";
};
