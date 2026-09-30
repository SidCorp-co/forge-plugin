// What stands between sudo, env, exec, time, command or nohup and the program it runs, spelled as the pattern `STARTS` and the stage verb finder in shell-spans.mjs both splice in.

/* Each wrapper's row lists what of its own takes an argument, and the cluster rule is getopt's, as options.mjs states it for the write verbs. Whatever a row leaves out is read as bare, and a long one may still carry an `=value` of its own, which is how `sudo --preserve-env=PATH` and `env --ignore-signal=INT` spell theirs.
   sudo's are those its manual lists as taking an argument; `-h` is left off, since its host is attached only and a bare `-h` is the help. env's are GNU's and uutils'; `-S` is left off, its value being the command line itself, so reading it as taking none keeps the verb it carries in view. exec's `-a` names the program's zeroth argument; GNU time's `-f` and `-o` take a format and a file. `command` and `nohup` take none. */
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

/** Whether the table names this wrapper. */
export const wraps = (name) => Object.hasOwn(OPTIONS, name);

/** The options one wrapper may carry before its command, each behind the blanks that separate it, then an optional bare `--`: a regular-expression source to splice after the wrapper's own word. `word` is the caller's reading of one shell word, the value a value-taking option names. A value-taking letter or long name has no value-less reading here, so a verb spelled as an option's value is that option's value and never the command. Non-capturing, being spliced into a reader's pattern. */
export const optionsAfter = (name, word) => {
  const { takes, long } = OPTIONS[name];
  const names = long.join("|");
  const bare = takes ? String.raw`(?:(?![${takes}])\w)` : String.raw`\w`;
  const one = [
    String.raw`-${bare}+(?=\s)`,
    ...(takes ? [String.raw`-${bare}*[${takes}]\s*${word}`] : []),
    ...(names ? [String.raw`--(?:${names})(?:=(?:${word})?|\s+${word})`] : []),
    names ? String.raw`--(?!(?:${names})(?![\w-]))[\w-]+(?:=(?:${word})?)?` : String.raw`--[\w-]+(?:=(?:${word})?)?`,
  ];
  return String.raw`(?:\s+(?:${one.join("|")}))*(?:\s+--(?=\s))?`;
};
