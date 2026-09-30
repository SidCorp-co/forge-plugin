/* A park says the issue waits on somebody, and `closed` and `dropped` say nobody is waited on.
   `forge record park` moves no status, so its record would stand on a page every reader of the
   status reads as finished (ISS-1750). The park through advance writes the same record and moves the
   status, and it is judged here by its own checks, so the route printed is never one the next call
   turns back. */
import { Refused, refuse, typedBack } from "../../refusal.mjs";
import { viewFrom } from "../earned.mjs";
import { parkChecked } from "./compose.mjs";

/** The refusal of a park record at a finished status: the advance that replays it, or, where that
 *  advance refuses the call too, its own refusal in place of a command the next call turns back. */
export const finishedRefusal = (reference, blocks, { documentId, body, comments }) => {
  const [got] = blocks;
  const held = `record park: ${reference} is ${body.status}, which owes nothing further, and this `
    + "write moves no status, so its record would say the issue waits on somebody while the status "
    + `says nobody is. Nothing was sent.${blocks.length > 1
      ? " The park through advance takes one park, so the first is the one replayed." : ""}`;
  try {
    parkChecked(viewFrom(documentId, body, comments), reference, got.kind, got.evidence ?? []);
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    refuse(`${held} The park through advance, which moves the status, refuses it too:\n${error.message}`);
  }
  const evidence = (got.evidence ?? []).map((one) => ` --evidence ${typedBack(one)}`).join("");
  refuse(`${held} The park that writes this record and moves the status into the one its kind names:\n`
    + `  forge advance ${reference} --park ${got.kind} --why ${typedBack(got.why)}${evidence}`);
};
