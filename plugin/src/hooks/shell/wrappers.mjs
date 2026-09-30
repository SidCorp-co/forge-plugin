// The options each wrapper word takes before the command it runs, and the one pattern of them every reader of what stands before a verb is built from.

/* Per wrapper: the short letters and the long names that take a value. A value is the rest of a cluster behind its letter, or the next word where nothing is left, so a value-taking letter ends its cluster — the getopt rule the write verbs' own table reads. Every other short letter and long name takes none, and a long one may still carry an `=value` of its own, which is how `sudo --preserve-env=PATH` and `env --ignore-signal=INT` spell theirs.
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
    ...(names ? [String.raw`--(?:${names})(?:=\S*|\s+${word})`] : []),
    names ? String.raw`--(?!(?:${names})(?![\w-]))[\w-]+(?:=\S*)?` : String.raw`--[\w-]+(?:=\S*)?`,
  ];
  return String.raw`(?:\s+(?:${one.join("|")}))*(?:\s+--(?=\s))?`;
};
