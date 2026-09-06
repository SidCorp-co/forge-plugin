/* One place writes each shape on the issues tool: the filing interface creates (docs/cli/filing.md)
   and the field writer updates. One module because this directory is at the folder-width limit. */
import { lineAt } from "../line-at.mjs";

export const TOOL = "forge_issues";

export const WRITERS = {
  create: {
    interface: "plugin/src/tracker/filing/route.mjs",
    instead: "Call `fileIssue` there with what this route knows and print its answer, rather than"
      + " deciding a filing's shape a second time.",
  },
  update: {
    interface: "plugin/src/tracker/field-write.mjs",
    instead: "Call `writeField` there with the field's name, rather than sending an update whose cap,"
      + " renewal, comment delivery and read-back are this caller's to remember.",
  },
};

/* And one place says what a filing did: the route returns a value and prints nothing, so a second verb wanting the same reply copied the three lines rather than the call, and the copies drifted a fold apart (ISS-348). Named by what each formats, so a route printing one by hand is the failure and not a route that files, and the module defining a line is no caller of it. docs/cli/filing.md. */
export const SAYS = {
  interface: "plugin/src/tracker/filing/say.mjs",
  formatters: ["foldedInto", "filedAs", "issueLanded"],
  instead: "Call `fileAndSay` there with the route's own intro line, rather than formatting a fold,"
    + " a filed-as or a landed line a second time.",
};
/* The call and not the name: spending a line is what this counts, so the module defining one, the import carrying it and this registry naming all three are none of them a second copy. */
const SAID = new RegExp(String.raw`\b(${SAYS.formatters.join("|")})\s*\(`, "gu");

export const saidIn = (text, where) =>
  [...String(text).matchAll(SAID)].map(({ index, 1: what }) => ({ where, what, line: lineAt(text, index) }));

export const sayProblems = (found) =>
  found.filter((one) => one.where !== SAYS.interface).map((one) =>
    `${one.where}:${one.line} formats a filing's reply with \`${one.what}\`, and ${SAYS.interface} `
    + `is the one place that may. ${SAYS.instead}`);

/* The action is captured, so a create is never reported against the writer that owns updates. */
const SHAPES = Object.keys(WRITERS).join("|");
const WRITE = new RegExp(String.raw`["']${TOOL}["'][^;]{0,200}?action:\s*["'](${SHAPES})["']`, "gsu");

export const writesIn = (text, where) =>
  [...String(text).matchAll(WRITE)].map(({ index, 1: shape }) => ({ where, shape, line: lineAt(text, index) }));

export const writerProblems = (found) =>
  found.filter((one) => one.where !== WRITERS[one.shape].interface).map((one) =>
    `${one.where}:${one.line} writes \`action: "${one.shape}"\` on ${TOOL}, and `
    + `${WRITERS[one.shape].interface} is the one place that may. ${WRITERS[one.shape].instead}`);
