/* The one reader of a window a caller types — `3d`, `12h`, `90m` — for every flag that takes one.
   The flag travels with the verb because two flags share this reader and one verb takes both, so a
   refusal can only name what was typed if it is told (ISS-2138). */
import { fail } from "../../resolve/settings.mjs";

export const UNITS = { d: 86_400_000, h: 3_600_000, m: 60_000 };
const ASKED = /^(?<many>\d+)(?<unit>[dhm])$/u;

/** The window in milliseconds, or the refusal naming the verb and the flag the caller typed. */
export const durationOf = (raw, verb, flag) => {
  if (typeof verb !== "string" || !verb || typeof flag !== "string" || !flag.startsWith("--")) {
    throw new TypeError("durationOf takes the verb and the flag the window was typed on, so its refusal names both.");
  }
  const asked = ASKED.exec(raw)?.groups;
  if (!asked || Number(asked.many) < 1) {
    fail(`${verb}: ${flag} takes a window like \`3d\`, \`12h\` or \`90m\`, not \`${raw}\`.`);
  }
  return Number(asked.many) * UNITS[asked.unit];
};
