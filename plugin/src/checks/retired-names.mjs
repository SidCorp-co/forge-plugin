/* The retired names, held once so a sentence naming a verb that no longer runs fails something. An
   entry names no replacement: pointing at what took over is the redirect docs/cli/withholding-a-verb.md forbids. */
import { lineAt } from "../markdown.mjs";
import { RECORDS_RATHER_THAN_INSTRUCTS } from "./doc-shape.mjs";
import { RETIRING } from "../resolve/retiring.mjs";

export const RETIRED = [
  { name: "feedback", kind: "directory", release: "3.35.45" },
  { name: "codex-order", kind: "tool", release: "3.35.134" },
  { name: "forge_step_start", kind: "tool", release: "3.35.225" },
  { name: "deps", kind: "verb", release: "3.35.237" },
  { name: "dep", kind: "verb", release: "3.35.237" },
];

const KINDS = ["verb", "flag", "tool", "directory"];
const FIELDS = ["name", "kind", "release"];

/* Where this surface puts a name, never a bare word; a directory is the path form rooted, `./`
   included — the folder sat at a checkout's root, so `/api/feedback/` and a delimiter are not it. */
const shapesOf = ({ name, kind }) =>
  ({
    verb: [
      new RegExp(`\\bforge\\s+${name}\\b`, "gu"),
      new RegExp(`(["'\`])${name}(?:\\s[^"'\`]*)?\\1`, "gu"),
    ],
    flag: [new RegExp(`--${name}\\b`, "gu")],
    tool: [new RegExp(`\\b${name}\\b`, "gu")],
    directory: [new RegExp(`(?<![\\w./-])(?<!/[\\w-]+ )(?:\\.\\.?/)*${name}/`, "gu")],
  })[kind] ?? [];

const WHY = "docs/cli/withholding-a-verb.md";
const stem = (rel) => rel.split("/").pop().replace(/\.[^.]+$/u, "");

const SELF = `plugin/${import.meta.url.split("/plugin/").pop()}`;
const REQUIREMENTS = /^docs\/requirements\//u;
const history = (rel) => RECORDS_RATHER_THAN_INSTRUCTS.test(rel) || REQUIREMENTS.test(rel);
/* Each records a name rather than routing to it: the argument, the case that watches one, and the
   note `forge hooks --how` answers a retired gate's name with. */
const RECORDS = new Set([
  "docs/cli/feedback.md",
  "plugin/hooks/how/codex-order.md",
  "plugin/test/checks/retired-names.test.mjs",
]);

export const exempt = (rel) => rel === SELF || history(rel) || RECORDS.has(rel);

const mentions = ({ rel, text }, entry) =>
  [...new Set(shapesOf(entry).flatMap((shape) =>
    [...text.matchAll(shape)].map(({ index }) => lineAt(text, index))))]
    .sort((one, other) => one - other)
    .map((line) => `${rel}:${line} names the ${entry.kind} ${entry.name}, retired in ${entry.release}`
      + ` — delete the mention rather than aiming it at a live name (${WHY})`);

/* `live` is the verb surface, and only a directory shares a word with a live verb by design. */
const named = ({ rel }, entry, live) =>
  stem(rel) === entry.name && entry.kind !== "flag"
    && !(entry.kind === "directory" && live.includes(entry.name))
    ? [`${rel} is named for the ${entry.kind} ${entry.name}, retired in ${entry.release} — the file`
      + ` leaves with the name it is about (${WHY})`]
    : [];

export const problems = (files, retired = RETIRED, live = []) =>
  files
    .filter(({ rel }) => !exempt(rel))
    .flatMap((file) => retired.flatMap((entry) =>
      [...named(file, entry, live), ...mentions(file, entry)]));

/* The window's own rule: the two registries may not both hold a name — an entry here carries no replacement and a retiring row is nothing but one — so a name in both is a window that never closed. */
export const retiringProblems = (retiring = RETIRING, retired = RETIRED) =>
  retiring.flatMap((row) => {
    const who = row?.typed ?? "a retiring row";
    if (!String(row?.release ?? "").trim()) {
      return [`${who} names no release, so nothing says which one release it gets (${WHY})`];
    }
    /* The row's own field, not the display string re-parsed: a row shaped other than "verb --flag" derives the wrong name and this rule quietly stops matching. */
    const name = String(row.flag ?? String(row.typed).split(" ").at(-1)).replace(/^--/u, "");
    return retired.some((one) => one.name === name)
      ? [`${who} is retiring here and retired in ${WHY}'s own registry: one of the two is wrong, and`
        + " a retired name carries no replacement, so it is this row that goes"]
      : [];
  });

/* An entry missing its release would fire a finding nobody can act on. */
export const registryProblems = (retired = RETIRED) =>
  retired.flatMap((entry, at) => {
    const who = entry?.name ?? `entry ${at + 1}`;
    if (!/^[\w-]+$/u.test(entry?.name ?? "")) return [`${who} is not a name a pattern can match`];
    if (!KINDS.includes(entry.kind)) return [`${who} is a ${entry.kind}, not one of ${KINDS.join(", ")}`];
    if (!String(entry.release ?? "").trim()) return [`${who} names no release that retired it`];
    return Object.keys(entry)
      .filter((key) => !FIELDS.includes(key))
      .map((key) => `${who} carries ${key}; a retired name is held with the release that retired it`
        + ` and nothing that points at a live one (${WHY})`);
  });
