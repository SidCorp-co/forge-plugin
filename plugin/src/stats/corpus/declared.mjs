/* What a project declared its commands to be, apart from the classifier that reads a corpus by them:
   a door that REFUSES on one of these is a gate's, and the classifier is not on a gate's path
   (ISS-1904). The command-position reading is here because that is where a declared command is
   matched; the classifier imports it back. docs/cli/stats-rows.md. */

import { escaped } from "../../markdown.mjs";
import { projectFileAt } from "../../resolve/settings.mjs";

/* Where a command actually starts. A bare space is not one: read as a command position, an echoed line was a record and a grep argument a claim (ISS-1714). */
const LEADS = String.raw`(?:^|[\n;|&(){}])[ \t]*`
  + String.raw`(?:(?:[A-Za-z_][\w.]*=\S*|sudo|time|timeout|env|xargs|do|then|else|if|!)[ \t]+(?:\d+[ \t]+)?)*`;

export const at = (what) => new RegExp(LEADS + what, "u");

/** What a checkout says its own gate, test and ship are, so `--checkout` reads the profiled project's commands and not this process's. */
export const DECLARES = "stats.commands";
export const DECLARABLE = ["gate", "ship", "test", "cleanup"];
export const declaredIn = (directory) => projectFileAt(directory)?.stats?.commands ?? null;

/** The words a project declared, in one spelling a reading is held under; what that keeps apart is
 *  `classes.mjs`'s account (ISS-2086). */
export const declaredSaid = (declared = null) => DECLARABLE
  .map((label) => label + "=" + declaredCommands(label, declared).join(" ")).join("\n");

/** The commands a project typed under one label, as it typed them: a blank string, a number and an empty list each declare nothing, exactly as an absent key does. */
export const declaredCommands = (label, declared) => {
  const said = declared?.[label];
  return (Array.isArray(said) ? said : [said])
    .filter((one) => typeof one === "string" && one.trim()).map((one) => one.trim());
};

/* Matched as the text the project typed, nothing read out of its shape: guessing that any script named `gates.mjs` is a gate is how a profiler counts a project's unrelated tooling (ISS-1586). */
export const declares = (label, declared) => {
  const many = declaredCommands(label, declared);
  return many.length ? `(?:${many.map(escaped).join("|")})` : null;
};

/** The half of the table a route that REFUSES is handed — the labels this project declared a command for — and beside it the doors given that no declared command arms, with what the project wrote there. A fallback at a door costs an adopting project a refusal at a command it never named, which is why the built-in table stayed in the classifier, out of reach of this module (G-12, ISS-1905). The two are one reading, so the gate silent at a door and the row saying why cannot disagree. */
export const declaredClasses = (declared = null) => DECLARABLE
  .map((label) => [label, declares(label, declared)])
  .filter(([, said]) => said !== null).map(([label, said]) => [label, at(said)]);

export const unarmedDoors = (doors, declared = null) => doors
  .filter((label) => DECLARABLE.includes(label) && !declares(label, declared))
  .map((label) => ({ label, wrote: declared?.[label] === undefined ? null : JSON.stringify(declared[label]) }));
