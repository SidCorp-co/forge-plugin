/* `+read` and `+append`: a range of a spreadsheet read, and rows added under it. */
import { ACCOUNT_VALUES, PREVIEW_SWITCHES, invoke, optionsOf } from "../invocation.mjs";
import { VALIDATION, refuse, say } from "../exits.mjs";
import { parseFlags, requestFor } from "../request.mjs";
import { methodById } from "../surface.mjs";

const invalid = (message) => refuse(VALIDATION, `google ${message}`);

const read = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ACCOUNT_VALUES, switches: PREVIEW_SWITCHES, verb: "google +read" });
  if (positionals.length !== 2) invalid("+read takes a spreadsheet id and a range: +read <spreadsheet> <range>");
  const method = methodById("sheets.spreadsheets.values.get");
  const answer = await invoke(method, requestFor(method, { positionals }), optionsOf(flags, ["+read", ...argv]));
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

/* Rows as JSON: an array of rows, or one row as a flat array. A comma list would split a cell holding one. */
const rowsOf = (raw) => {
  let value = null;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    invalid(`+append: --values is not JSON: ${error.message}. Write rows as --values '[["a","b"],["c","d"]]'`);
  }
  if (!Array.isArray(value) || !value.length) invalid("+append: --values takes a JSON array of rows, or one row as a flat array.");
  return value.every(Array.isArray) ? value : [value];
};

const append = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--values", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +append" });
  if (positionals.length !== 2 || flags.values === undefined) {
    invalid("+append takes a spreadsheet id, a range and --values: +append <spreadsheet> <range> --values '[[\"a\",\"b\"]]'");
  }
  const method = methodById("sheets.spreadsheets.values.append");
  const request = requestFor(method, { positionals, params: { valueInputOption: "USER_ENTERED" }, body: { values: rowsOf(flags.values) } });
  const answer = await invoke(method, request, optionsOf(flags, ["+append", ...argv]));
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

export const SHEETS_HELPERS = { "+read": read, "+append": append };
