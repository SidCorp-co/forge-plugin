/* The shape a record takes on the page: written out, read back, gathered by kind and printed. Apart from `record.mjs`, which is the verb that spends these, because a record is read by four callers that write nothing — the entry checks, the route, the report and the prose pipeline. */
import { SHAPES, atMinute, blockOf, criterionNumber, readRecords, tagFor, unwrap } from "../machine.mjs";
import { CONTRACT } from "../../guides/contract.mjs";

/* A heading for a person, the payload fenced and the tag in a code span so the prose rewrite copies both byte for byte. The stamp is read off the issue at the write and is no flag: a value the author could type is one they could get wrong about what the record is matched by. Each block whole, so one of them is byte for byte the record a single write makes. */
export const render = (kind, blocks, status = null) => {
  const shape = SHAPES[kind];
  const entries = (Array.isArray(blocks) ? blocks : [blocks]).flatMap((fields) => shape.fields
    .map((field) => [field.flag, fields[field.flag]])
    .filter(([, value]) => !(value === undefined || value === null || (Array.isArray(value) && !value.length))));
  if (shape.stamp && status) entries.push([shape.stamp.flag, status]);
  return [`## ${shape.heading}`, "", blockOf(entries), "", tagFor(kind, CONTRACT)].join("\n");
};

export const parseAll = (body) => readRecords(unwrap(body), (kind) => SHAPES[kind]);

/* The first block: for readers asking about the comment rather than about a criterion. */
export const parse = (body) => parseAll(body)[0] ?? null;

/* Latest of each kind, latest verdict per criterion, and the criteria no verdict names. */
export const assemble = (comments, criteria) => {
  const records = comments
    .flatMap((one) => parseAll(one.body ?? "").map((record) => ({ at: one.createdAt ?? "", record })))
    .sort((a, b) => a.at.localeCompare(b.at));
  const latest = {};
  const verdicts = new Map();
  const repeated = {};
  /* A verdict whose criterion this build cannot read is kept apart rather than keyed by what the read produced: keying by that is how an owed list came to name a criterion `NaN`. */
  const unreadable = [];
  for (const { at, record } of records) {
    if (record.kind === "verdict") {
      const number = criterionNumber(record.fields.criterion);
      if (number === null) unreadable.push({ at, record });
      else verdicts.set(number, { at, record });
      continue;
    }
    latest[record.kind] = { at, record };
    if (SHAPES[record.kind].repeats) (repeated[record.kind] ??= []).push({ at, record });
  }
  const owed = criteria.filter((one) => !verdicts.has(one.number)).map((one) => one.number);
  return { latest, verdicts, owed, repeated, unreadable };
};

/* The label is the shape's, never the record's: a record carries keys, and two forms of one record read back under one heading. A rewritten one carries no key and says so instead of nothing. */
export const printRecord = ({ at, record }) => {
  const shape = SHAPES[record.kind];
  console.log(`${shape.heading}  (${atMinute(at)}, contract ${record.contract})`);
  if (record.rewritten) return console.log("  rewritten by the prose pipeline: no field of this shape reads back");
  for (const field of [...shape.fields, ...(shape.stamp ? [shape.stamp] : [])]) {
    const value = record.fields[field.flag];
    if (value === undefined || (Array.isArray(value) && !value.length)) continue;
    for (const one of Array.isArray(value) ? value : [value]) console.log(`  ${field.label}: ${one}`);
  }
  return null;
};
