/* Which correction the report prints beside which record, and which superseded payloads under
   which correction: a correction names what it corrects, so it is read where that record is read
   rather than in a list of its own, and the value it let a write replace is read under it. Apart
   from `report.mjs`, which prints, because this decides and prints nothing. */
import { criterionNumber, handleOf } from "../../machine.mjs";

/* The place a correction stands, keyed as the report keys what it prints: one per kind that can
   only be current, and one per criterion's verdict, whose occasion is the criterion. */
const placeOf = (corrects) => {
  const [kind, ...rest] = String(corrects ?? "").split(":");
  if (kind !== "verdict") return kind;
  const number = criterionNumber(rest.join(":"));
  return number === null ? null : `verdict:${number}`;
};

/**
 * `printed` is every place the report prints a record at. Answers what stands beside each of
 * them, and the corrections and superseded payloads that stand beside nothing, which the report
 * keeps in the counted lists it has always printed.
 */
export const besideOf = (repeated, printed) => {
  const payloads = new Map();
  for (const one of repeated.superseded ?? []) {
    const by = String(one.record.fields.by ?? "");
    payloads.set(by, [...(payloads.get(by) ?? []), one]);
  }
  const beside = new Map();
  const loose = [];
  const placed = new Set();
  for (const one of repeated.correction ?? []) {
    const place = placeOf(one.record.fields.corrects);
    if (!printed.has(place)) {
      loose.push(one);
      continue;
    }
    const under = one.id ? payloads.get(handleOf(one.id)) ?? [] : [];
    for (const payload of under) placed.add(payload);
    beside.set(place, [...(beside.get(place) ?? []), { correction: one, under }]);
  }
  return {
    at: (place) => beside.get(place) ?? [],
    corrections: loose,
    superseded: (repeated.superseded ?? []).filter((one) => !placed.has(one)),
  };
};
