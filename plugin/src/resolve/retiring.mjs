/* The names this release still answers and the line each names instead — one release, then the row
   goes and the name moves to checks/retired-names.mjs, which holds no replacement. Why a redirect
   is allowed here and nowhere else, and `flag` rows: docs/cli/withholding-a-verb.md. */
export const RETIRING = [
  {
    typed: "plan",
    release: "3.35.211",
    instead: "forge record plan <uuid|ISS-45> <plan.md>",
  },
  {
    typed: "new --into",
    release: "3.35.211",
    verb: "new",
    flag: "--into",
    instead: "forge comment <uuid|ISS-45> <file.md|@file|-> [--title T]",
  },
];

const said = (row) =>
  `\`forge ${row.typed}\` is retired: one write has one verb, and this write's is\n  ${row.instead}`;

export const retiredRefusal = (typed) => {
  const row = RETIRING.find((one) => one.typed === typed);
  return row ? said(row) : null;
};

export const retiredFlagIn = (verb, argv) => {
  const row = RETIRING.find((one) => one.verb === verb
    && argv.some((word) => word === one.flag || String(word).startsWith(`${one.flag}=`)));
  return row ? said(row) : null;
};
