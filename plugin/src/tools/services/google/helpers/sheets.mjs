/* `+read` and `+append`: a range of a spreadsheet read, and rows added under it; `+addtab` and `+copytab`:
   a tab added to a spreadsheet, and one copied into another. None takes content away, so none owes `--yes`. */
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

const counted = (flag, raw) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) invalid(`+addtab: --${flag} takes a whole number from 1, not \`${raw}\`.`);
  return value;
};

const gridOf = (flags) => {
  const grid = {};
  if (flags.rows !== undefined) grid.rowCount = counted("rows", flags.rows);
  if (flags.cols !== undefined) grid.columnCount = counted("cols", flags.cols);
  return Object.keys(grid).length ? { gridProperties: grid } : {};
};

const addTab = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--rows", "--cols", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +addtab" });
  if (positionals.length !== 2) invalid("+addtab takes a spreadsheet id and the new tab's title: +addtab <spreadsheet> <title> [--rows n] [--cols n]");
  const [spreadsheet, title] = positionals;
  const method = methodById("sheets.spreadsheets.batchUpdate");
  const body = { requests: [{ addSheet: { properties: { title, ...gridOf(flags) } } }] };
  const answer = await invoke(method, requestFor(method, { positionals: [spreadsheet], body }), optionsOf(flags, ["+addtab", ...argv]));
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

const copyTab = async (argv) => {
  const { flags, positionals } = parseFlags(argv, { values: ["--to", ...ACCOUNT_VALUES], switches: PREVIEW_SWITCHES, verb: "google +copytab" });
  if (positionals.length !== 2 || flags.to === undefined) {
    invalid("+copytab takes a spreadsheet id, a tab's sheetId and --to: +copytab <spreadsheet> <sheetId> --to <spreadsheet>");
  }
  if (!/^\d+$/u.test(positionals[1])) {
    invalid(`+copytab: \`${positionals[1]}\` is not a sheetId; a tab's sheetId is the number after gid= in its link, and \`forge google sheets spreadsheets get <spreadsheet>\` lists them.`);
  }
  const method = methodById("sheets.spreadsheets.sheets.copyTo");
  const request = requestFor(method, { positionals, body: { destinationSpreadsheetId: flags.to } });
  const answer = await invoke(method, request, optionsOf(flags, ["+copytab", ...argv]));
  if (answer !== null) say(JSON.stringify(answer, null, 2));
};

export const SHEETS_HELPERS = { "+read": read, "+append": append, "+addtab": addTab, "+copytab": copyTab };
