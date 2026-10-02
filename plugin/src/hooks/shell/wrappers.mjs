// What stands between sudo, env, exec, time, command or nohup and the program it runs, spelled as the pattern `STARTS` and the stage verb finder in shell-spans.mjs both splice in.

import { BLANKS, shellWord } from "./word.mjs";

/* Each wrapper's row lists what of its own takes an argument, and the cluster rule is getopt's, as options.mjs states it for the write verbs. Whatever a row leaves out is read as bare, and a long one may still carry an `=value` of its own, which is how `sudo --preserve-env=PATH` and `env --ignore-signal=INT` spell theirs.
   sudo's are those its manual lists as taking an argument; `-h` is left off, since its host is attached only and a bare `-h` is the help. env's are GNU's and uutils'; `-S` is left off, its value being the command line itself, so reading it as taking none keeps the verb it carries in view; a quoted one is `SPLITS`'s. exec's `-a` names the program's zeroth argument; GNU time's `-f` and `-o` take a format and a file. `command` and `nohup` take none. */
const OPTIONS = {
  sudo: {
    takes: "CDgpRrTtUu",
    long: ["chdir", "chroot", "close-from", "command-timeout", "group", "other-user", "prompt", "role", "type", "user"],
  },
  env: { takes: "Cafu", long: ["argv0", "chdir", "file", "unset"] },
  exec: { takes: "a", long: [] },
  time: { takes: "fo", long: ["format", "output"] },
  command: { takes: "", long: [] },
  nohup: { takes: "", long: [] },
};

const VALUE = shellWord(";&|()<>");

/** Whether the table names this wrapper. */
export const wraps = (name) => Object.hasOwn(OPTIONS, name);

const optionRun = (name) => {
  const { takes, long } = OPTIONS[name];
  const names = long.join("|");
  const bare = takes ? String.raw`(?:(?![${takes}])\w)` : String.raw`\w`;
  const one = [
    String.raw`-${bare}+(?=${BLANKS})`,
    ...(takes ? [String.raw`-${bare}*[${takes}]${BLANKS}*${VALUE}`] : []),
    ...(names ? [String.raw`--(?:${names})(?:=(?:${VALUE})?|${BLANKS}+${VALUE})`] : []),
    names ? String.raw`--(?!(?:${names})(?![\w-]))[\w-]+(?:=(?:${VALUE})?)?` : String.raw`--[\w-]+(?:=(?:${VALUE})?)?`,
  ];
  return String.raw`(?:${BLANKS}+(?:${one.join("|")}))*`;
};

/** The options one wrapper may carry before its command, each behind blanks, then an optional bare `--`: a non-capturing source to splice after the wrapper's word. A value-taking option has no value-less reading, so a verb spelled as its value is never the command. */
export const optionsAfter = (name) => String.raw`${optionRun(name)}(?:${BLANKS}+--(?=${BLANKS}))?`;

/* A long option cut to any prefix getopt takes: `--split` is `--split-string`, no other of env's beginning with an `s`. */
const abbreviated = (name, from) =>
  name.slice(0, from) + name.slice(from).split("").reduceRight((rest, one) => `(?:${one}${rest})?`, "");

/** env handed its command as one string to split, through to where the string opens: env at any path, its options, then `-S` alone or ending a cluster, attached or behind blanks, or `--split-string` or a prefix of it behind an `=` or blanks. Past a `--` a `-S` is the command. Spliced into `RUNNER`.
 *  A reader takes the string for shell code, and env splits by rules of its own: no `;`, `|` or `&&` ends a command, no `$(…)` runs one, nothing is globbed, only `${NAME}` expands. Each over-reads, so it refuses more, never less. The one split a shell would miss is env's `\_`, a blank, which the reader opening the string turns into one. */
export const SPLITS = String.raw`(?:\S*\/)?env${optionRun("env")}${BLANKS}+`
  + String.raw`(?:-(?:(?![${OPTIONS.env.takes}S])\w)*S${BLANKS}*|--${abbreviated("split-string", 1)}(?:=|${BLANKS}+))`;
