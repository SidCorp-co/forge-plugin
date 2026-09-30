// The options each write verb takes, and the one reading of a command's words over them that every reader in shell-spans.mjs asks.

/* Per verb: the short letters and the long names that take a value, which of those name the file the verb writes, and which name the directory it writes into. A value is the rest of a cluster behind its letter, or the next word where nothing is left, so it is the first letter of a cluster taking one that ends the cluster — the rule GNU's getopt and curl's own parser both read, and the one curl 8.18 was seen keeping here: `-sSo` wrote the file named in the next word, `-sHoq` wrote nothing, `H` having taken `oq`, and `-sDo` wrote a file called `o`.
   GNU's `cp` and `mv` take a value after `-S` and `-t`, its `install` after `-g`, `-m`, `-o` and those two, its `touch` after `-d`, `-r` and `-t`, its `truncate` after `-r` and `-s`, and its `tee` after none; BSD's take no more. `curl`'s and `wget`'s letters are the ones their own `--help` marks as taking an argument (curl 8.18, wget 1.25, whose `-n` takes the letter after it); their long names are those letters' own spellings and the ones that write. A long option not listed is read as taking none, which leaves its value an operand, and neither download verb aims at an operand. The writers are the options each of the two was seen creating its file through, a log and a header dump being files as much as the document is; one that wrote nothing there, `curl -c` with no cookie to keep or `wget --save-cookies`, joins when a run sees it write, and `wget --warc-file` builds its name rather than spelling it. */
const COPIES = { takes: "St", long: ["suffix", "target-directory"], target: ["t", "target-directory"] };
const OPTIONS = {
  cp: COPIES,
  install: { takes: "gmoSt", long: ["group", "mode", "owner", "suffix", "target-directory"], target: ["t", "target-directory"] },
  mv: COPIES,
  tee: { takes: "", long: [] },
  touch: { takes: "drt", long: ["date", "reference"] },
  truncate: { takes: "rs", long: ["reference", "size"] },
  curl: {
    takes: "AbcCdDeEFHKmoPQrtTuUwxXyYz",
    long: ["cert", "config", "continue-at", "cookie", "cookie-jar", "data", "dump-header", "form", "ftp-port", "header",
      "max-time", "output", "output-dir", "proxy", "proxy-user", "quote", "range", "referer", "request", "speed-limit",
      "speed-time", "telnet-option", "time-cond", "upload-file", "user", "user-agent", "write-out",
      "trace", "trace-ascii", "stderr", "libcurl", "etag-save"],
    writes: ["o", "D", "output", "dump-header", "trace", "trace-ascii", "stderr", "libcurl", "etag-save"],
  },
  wget: {
    takes: "aABDeiIlnoOPQRtTUwX",
    long: ["execute", "output-file", "append-output", "input-file", "base", "tries", "output-document", "timeout", "wait",
      "quota", "directory-prefix", "user-agent", "level", "accept", "reject", "domains", "include-directories",
      "exclude-directories"],
    writes: ["O", "o", "a", "output-document", "output-file", "append-output"],
  },
};

/** A verb the table names, anywhere in a text: only a text it matches is one the reader below can answer anything for. */
export const NAMED = new RegExp(String.raw`\b(?:${Object.keys(OPTIONS).join("|")})\b`, "u");
/** Whether the table names this verb, which is what `optionsIn` answers `null` for. */
export const known = (program) => Object.hasOwn(OPTIONS, program);
/** Whether an option the reader answered names the file the verb writes, and, below, the directory it writes into. */
export const writes = (program, name) => OPTIONS[program]?.writes?.includes(name) ?? false;
export const targets = (program, name) => OPTIONS[program]?.target?.includes(name) ?? false;

/** Every option taking a value in one command's words, each `{ name, at, value, next }`: the letter or long name, the index of the word spelling it, the value as a word of its own — the rest of the spelling, placed where it starts, or the next word, which `next` says and which is `undefined` where there is none. Past a bare `--` there are no options. `null` for a verb the table does not name. */
export const optionsIn = (program, words) => {
  if (!known(program)) return null;
  const { takes, long } = OPTIONS[program];
  const out = [];
  for (let at = 0; at < words.length && words[at].said !== "--"; at += 1) {
    const word = words[at];
    const { said, from } = word;
    let name = null;
    let lead = -1;
    if (said.startsWith("--")) {
      const equals = said.indexOf("=");
      const spelt = said.slice(2, equals < 0 ? undefined : equals);
      if (long.includes(spelt)) [name, lead] = [spelt, equals < 0 ? said.length : equals + 1];
    } else if (said.startsWith("-")) {
      const letter = [...said.slice(1)].findIndex((one) => takes.includes(one)) + 1;
      if (letter > 0) [name, lead] = [said[letter], letter + 1];
    }
    if (name === null) continue;
    const next = lead >= said.length && !(said.startsWith("--") && said.includes("="));
    out.push({ name, at, next, value: next ? words[at + 1] : { ...word, said: said.slice(lead), from: from + lead } });
    if (next) at += 1;
  }
  return out;
};

/** The spelling that makes a download verb a write, for the pattern `WRITES` is built from: a writing letter standing anywhere in a cluster behind letters taking no value, or a writing long name. No boundary may follow a letter — `curl -output` writes a file called `utput` — and only the long spellings keep one, which is what leaves `--outputting` the unknown option curl refuses, and `--output-dir` the directory it names, rather than a write. */
export const writingOption = (verb) => {
  const { takes, writes: writers } = OPTIONS[verb];
  const letters = writers.filter((one) => one.length === 1).join("");
  const names = writers.filter((one) => one.length > 1).join("|");
  return String.raw`(?:-(?:(?![${takes}])[\w#:@])*[${letters}]|--(?:${names})(?![\w-]))`;
};
