/* One row per name a losing verb gets one release of, empty while no window is open, and a row's own release is when it closes; the rule, the `flag` shape and why a redirect is allowed only here: docs/cli/withholding-a-verb.md. */
export const RETIRING = [];

const said = (row) =>
  `\`forge ${row.typed}\` is retired: one write has one verb, and this write's is\n  ${row.instead}`;

export const retiredRefusal = (typed, retiring = RETIRING) => {
  const row = retiring.find((one) => one.typed === typed);
  return row ? said(row) : null;
};

export const retiredFlagIn = (verb, argv, retiring = RETIRING) => {
  const row = retiring.find((one) => one.verb === verb
    && argv.some((word) => word === one.flag || String(word).startsWith(`${one.flag}=`)));
  return row ? said(row) : null;
};
