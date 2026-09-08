/* A form is a word this CLI performs through a verb it already has, and it is not a redirect: it runs,
   and says which verb ran it. Why that is allowed where a retirement's is not, what a form may never
   be, and why the line goes to stderr: docs/cli/withholding-a-verb.md. */

/* One row per status something advances to, `open` having none; this file imports nothing, because the near-miss reader reads it and the order table's own tree reads that. */
export const MOVES = {
  confirmed: "confirm",
  clarified: "clarify",
  approved: "approve",
  in_progress: "start",
  developed: "develop",
  tested: "test",
  released: "release",
  closed: "close",
};

const moved = Object.fromEntries(Object.entries(MOVES)
  .map(([status, form]) => [form, { verb: "advance", to: status }]));

export const FORMS = {
  ...moved,
  drop: { verb: "advance", insert: ["--drop"] },
  /* `--kind` is what every other verb asks a kind by, so the form translates the word rather than teaching a second spelling; `unless` is what carries a bare `forge park` to advance's own refusal instead of an ordinary move. */
  park: { verb: "advance", insert: ["--park"], rename: ["--kind", "--park"], unless: "--park" },
  issues: { verb: "issue" },
  list: { verb: "issue" },
  get: { verb: "issue" },
  show: { verb: "issue" },
  read: { verb: "issue" },
  comments: { verb: "comment" },
};

export const FORM_NAMES = Object.keys(FORMS);
export const handledBy = (word) => (Object.hasOwn(FORMS, word) ? FORMS[word] : null);

const refOf = (rest) => (rest[0] !== undefined && !rest[0].startsWith("--") ? rest[0] : null);

/* A status form is its target's name, so a second target is one question asked twice and the parser answers with the last — a `close` advancing elsewhere. */
export const refusedFor = (form, rest) => {
  const row = handledBy(form);
  return row?.to && rest.includes("--to")
    ? `${form} is the form for ${row.to} and carries that target itself, so --to would be a second`
      + ` answer to one question. To name a target, the verb that takes it is \`forge advance\`.`
    : null;
};

/* The named status goes behind the reference, never in front: advance refuses a flag in that position, and that refusal is what a form must not spend a turn on. */
export const argvOf = (form, rest) => {
  const row = handledBy(form);
  const given = row.rename ? rest.map((word) => (word === row.rename[0] ? row.rename[1] : word)) : rest;
  if ((!row.to && !row.insert) || refOf(given) === null) return given;
  const [ref, ...others] = given;
  const named = row.unless && others.includes(row.unless) ? [] : row.insert ?? [];
  return [ref, ...(row.to ? ["--to", row.to] : named), ...others];
};

export const READ_AS = "forge: read";
export const saidFor = (form, rest) => {
  const { verb } = handledBy(form);
  const ref = refOf(rest);
  return `${READ_AS} ${form} as forge ${verb}${ref ? ` ${ref}` : ""}`;
};
