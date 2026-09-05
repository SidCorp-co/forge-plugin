/* One place writes a create on the issues tool, and it is the filing interface: docs/cli/filing.md. */
import { lineAt } from "../line-at.mjs";

export const INTERFACE = "plugin/src/tracker/filing.mjs";
export const TOOL = "forge_issues";

const CREATE = new RegExp(String.raw`["']${TOOL}["'][^;]{0,200}?action:\s*["']create["']`, "gsu");

export const createsIn = (text, where) =>
  [...String(text).matchAll(CREATE)].map(({ index }) => ({ where, line: lineAt(text, index) }));

export const creationProblems = (found) =>
  found.filter((one) => one.where !== INTERFACE).map((one) =>
    `${one.where}:${one.line} writes a create on ${TOOL}, and ${INTERFACE} is the one place that may.`
    + " Call `fileIssue` there with what this route knows and print its answer, rather than deciding"
    + " a filing's shape a second time.");
