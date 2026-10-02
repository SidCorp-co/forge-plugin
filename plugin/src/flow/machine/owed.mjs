/* One owed item — what the record lacks and the one command that supplies it — and the way every
   reader prints a set of them. Beside the shape table rather than in the checks, so a check split out
   of them takes the shape with it and imports nothing back, and so a refusal's shortfall and a write's
   own tail cannot spell one differently. Re-exported by `../machine.mjs`, which every reader imports. */

export const need = (what, command) => ({ what, command });

/** A command laid out at the printer's own depth. An item whose one command is two routes is two
 *  lines, and a continuation carrying no prefix starts at column zero under an indented first,
 *  which reads as prose rather than as the second thing to type (ISS-1993). */
export const commandAt = (command, gap) => String(command).replaceAll("\n", `\n${gap}`);

export const missingLines = (missing) =>
  missing.map((one) => `\n  ${one.what}\n    ${commandAt(one.command, "    ")}`);
