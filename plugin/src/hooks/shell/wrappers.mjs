// What stands between sudo, env, exec, time, command or nohup and the program it runs, spelled as the pattern `STARTS` and the stage verb finder in shell-spans.mjs both splice in.

import { BLANKS, shellWord } from "./word.mjs";

/* Each wrapper's row lists what of its own takes an argument, and the cluster rule is getopt's, as options.mjs states it for the write verbs. Whatever a row leaves out is read as bare, and a long one may still carry an `=value` of its own, which is how `sudo --preserve-env=PATH` and `env --ignore-signal=INT` spell theirs.
   sudo's are those its manual lists as taking an argument; `-h` is left off, since its host is attached only and a bare `-h` is the help. env's are GNU's and uutils'; `-S` is left off, its value being the command line itself, so reading it as taking none keeps the verb it carries in view; a quoted one is `SPLITS`'s. exec's `-a` names the program's zeroth argument; GNU time's `-f` and `-o` take a format and a file, `--output` being only a prefix of the name its table holds. `command` and `nohup` take none.
   `others` is the rest of a program's long options, sudo's from sudo.ws and env's from GNU and uutils alike: none takes a value here, and each is listed because a prefix it shares is no option's. */
const OPTIONS = {
  sudo: {
    takes: "CDgpRrTtUu",
    chdir: ["D", "chdir"],
    long: ["chdir", "chroot", "close-from", "command-timeout", "group", "other-user", "prompt", "role", "type", "user"],
    others: ["askpass", "auth-type", "background", "bell", "edit", "help", "host", "list", "login", "login-class", "no-update",
      "non-interactive", "preserve-env", "preserve-groups", "remove-timestamp", "reset-timestamp", "set-home", "shell", "stdin",
      "validate", "version"],
  },
  env: {
    takes: "Cafu",
    chdir: ["C", "chdir"],
    long: ["argv0", "chdir", "file", "unset"],
    others: ["block-signal", "debug", "default-signal", "help", "ignore-environment", "ignore-signal", "list-signal-handling", "null",
      "split-string", "version"],
  },
  exec: { takes: "a", long: [] },
  time: { takes: "fo", long: ["format", "output-file"], others: ["append", "help", "portability", "quiet", "verbose", "version"] },
  command: { takes: "", long: [] },
  nohup: { takes: "", long: [] },
  /* Read only by the word walk below, which asks what program a launcher runs; the shell reader's
     patterns are built for its own prefix list and never reach these rows. `positional` counts the
     arguments a launcher takes before its program, as timeout's duration. */
  nice: { takes: "n", long: ["adjustment"] },
  setsid: { takes: "", long: [] },
  ionice: { takes: "cnpPu", long: ["class", "classdata", "pid", "pgid", "uid"] },
  stdbuf: { takes: "ioe", long: ["input", "output", "error"] },
  timeout: { takes: "ks", long: ["kill-after", "signal"], positional: 1 },
  xargs: { takes: "adEILnPs", long: ["arg-file", "delimiter", "eof", "replace", "max-lines", "max-args", "max-procs", "max-chars"] },
  npx: { takes: "pc", long: ["package", "call"] },
};

const VALUE = shellWord(";&|()<>");

/** Whether the table names this wrapper. */
export const wraps = (name) => Object.hasOwn(OPTIONS, name);

/** One wrapper's row for a reader walking words rather than a pattern: the short options taking a
 *  value, the long ones, how many arguments come before its program, and the options naming the
 *  directory it runs that program in. Null for a word the table does not name. */
export const wrapperRow = (name) => (wraps(name)
  ? { takes: OPTIONS[name].takes, long: OPTIONS[name].long, positional: OPTIONS[name].positional ?? 0, chdir: OPTIONS[name].chdir ?? [] }
  : null);

/* A long option cut to any prefix getopt takes, the same rule clap's inferred long options keep: down to the shortest prefix no other long option of its program begins with, or its whole name alone where a longer option begins with all of it, since an exact name is selected even where it prefixes another. A prefix two options share is refused by the program, so it is neither of them here. */
const abbreviated = (wrapper, name) => {
  const { long, others = [] } = OPTIONS[wrapper];
  const rivals = [...long, ...others].filter((one) => one !== name);
  const from = [...name].findIndex((_, at) => !rivals.some((one) => one.startsWith(name.slice(0, at + 1)))) + 1 || name.length;
  return name.slice(0, from) + name.slice(from).split("").reduceRight((rest, one) => `(?:${one}${rest})?`, "");
};

const optionRun = (name) => {
  const { takes, long } = OPTIONS[name];
  const names = long.map((one) => abbreviated(name, one)).join("|");
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

/** env handed its command as one string to split, through to where the string opens: env at any path, its options, then `-S` alone or ending a cluster, attached or behind blanks, or `--split-string` or a prefix of it behind an `=` or blanks. Past a `--` a `-S` is the command. Spliced into `RUNNER`.
 *  A reader takes the string for shell code, and env splits by rules of its own: no `;`, `|` or `&&` ends a command, no `$(…)` runs one, nothing is globbed, only `${NAME}` expands. Each over-reads, so it refuses more, never less. The one split a shell would miss is env's `\_`, a blank, which the reader opening the string turns into one. */
export const SPLITS = String.raw`(?:\S*\/)?env${optionRun("env")}${BLANKS}+`
  + String.raw`(?:-(?:(?![${OPTIONS.env.takes}S])\w)*S${BLANKS}*|--${abbreviated("env", "split-string")}(?:=|${BLANKS}+))`;
