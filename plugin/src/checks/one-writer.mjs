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

/* The action is captured, so a create is never reported against the writer that owns updates. */
const SHAPES = Object.keys(WRITERS).join("|");
const WRITE = new RegExp(String.raw`["']${TOOL}["'][^;]{0,200}?action:\s*["'](${SHAPES})["']`, "gsu");

export const writesIn = (text, where) =>
  [...String(text).matchAll(WRITE)].map(({ index, 1: shape }) => ({ where, shape, line: lineAt(text, index) }));

export const writerProblems = (found) =>
  found.filter((one) => one.where !== WRITERS[one.shape].interface).map((one) =>
    `${one.where}:${one.line} writes \`action: "${one.shape}"\` on ${TOOL}, and `
    + `${WRITERS[one.shape].interface} is the one place that may. ${WRITERS[one.shape].instead}`);
