/* What a record's field is refused for before anything is sent: a blank on any field a caller may
   not leave out, and on a prose field a route to the text standing where the text goes. Refused
   rather than expanded, as the two `--set` verbs refuse it, because a record is never edited or
   removed and expansion is the reading that could not be taken back once callers leaned on it:
   docs/cli/record.md. */
import { refuse } from "../../refusal.mjs";
import { routeIn, routeRefusal } from "../../resolve/payload.mjs";
import { typedArgv } from "../../resolve/flags.mjs";
import { SHAPES } from "../machine.mjs";

/** The note kind's prose, which rides no row of `SHAPES` because `noteFrom` reads its two forms itself. */
export const NOTE_PROSE = {
  user: { flag: "user", label: "User-facing", prose: true },
  technical: { flag: "technical", label: "Technical", prose: true },
  why: { flag: "why", label: "Why", prose: true },
};

const proseOf = (kind) =>
  (kind === "note" ? Object.values(NOTE_PROSE) : (SHAPES[kind]?.fields ?? []).filter((one) => one.prose));

const catForm = (path) => `"$(cat -- ${path})"`;

/* The call as it was typed with this one value swapped, so the line printed is the one to run; a
   run embedded in another script has no argv of its own and gets the flag alone. */
const callWith = (kind, flag, value, path) => {
  const typed = typedArgv();
  const argv = process.argv.slice(2);
  const at = argv.findIndex((one, index) => index > 0 && argv[index - 1] === `--${flag}` && one === value);
  if (!typed || at < 0) return `forge record ${kind} <ISS-nn> ... --${flag} ${catForm(path)}`;
  return ["forge", ...typed.with(at, catForm(path))].join(" ");
};

const published = (field) =>
  `the path itself would be published as --${field.flag}, and a record is never edited or removed, `
  + "so it would stand on the issue in place of the text";

/* A shell hands every field the same blank, a substitution or a quoted variable that came out
   empty, so every field a caller may not leave out is asked and only the source the refusal names
   differs. Each value of a repeating field is asked, since one blank among several cites nothing
   and reads as a write that took it (ISS-196). */
const asksValue = (field) => field.prose || field.many || !field.optional;

const blank = (kind, field, value) =>
  `record ${kind}: --${field.flag} arrived ${value === "" ? "empty" : "as whitespace alone"}, and a record `
  + "holding nothing there tells its reader nothing. "
  + (field.prose
    ? `A value in the form ${catForm("<file>")} arrives like that when the file is missing: write the file, or send the text itself.`
    : "A quoted variable or a substitution that came out empty arrives like that: send the value itself.")
  + " Nothing was sent.";

/* The two routes and not the third: a value that is only a file's name is a sentence here, since a
   correction's --moved names the file a landing wrote and `developed` reads that name back. */
const routed = (value) => {
  const said = value.trim();
  return said === "-" || said.startsWith("@") ? routeIn(value) : null;
};

/** Every value a field was given, judged before the first call to the tracker. */
export const fieldChecked = (kind, field, values) => {
  for (const value of [values].flat()) {
    if (value === undefined) continue;
    if (asksValue(field) && !String(value).trim()) refuse(blank(kind, field, value));
    if (!field.prose) continue;
    const route = routed(String(value));
    if (!route) continue;
    refuse(routeRefusal({
      asked: `record ${kind} --${field.flag} ${route.spelt}`,
      flag: `--${field.flag}`,
      route,
      cost: published(field),
      call: callWith(kind, field.flag, value, route.path),
    }));
  }
};

/** The line a kind's own help prints, so the form is read before a write rather than out of its refusal. */
export const proseHelp = (kind) => {
  const flags = proseOf(kind).map((one) => `--${one.flag}`);
  if (!flags.length) return [];
  const named = flags.length === 1 ? flags[0] : `${flags.slice(0, -1).join(", ")} and ${flags.at(-1)}`;
  return [`Text only on ${named}: pass a file as ${flags.at(-1)} ${catForm("file.md")}, never \`@file\`.`];
};
