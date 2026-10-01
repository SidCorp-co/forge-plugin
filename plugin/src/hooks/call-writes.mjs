// Which argument of a program's own file call is the file it writes, read off the call's text: what a program body another language reads, a heredoc's or a `-c` one's, is read for, since a write that reaches no shell is no shell word. how/writes.md.

/** Either half of a write made by a library call, anywhere in a text: `open` with a mode that writes, and every call below by name. The cheap test, before `fileCalls` reads which argument the call writes. */
export const WRITE_CALLS = String.raw`open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
  + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
  + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`;

/** The language each runner speaks, for the readings that tell its code from its strings. */
export const SPEAKS = { python: "python", python3: "python", node: "node", deno: "node", bun: "node" };

/** Where a language's strings and comments stand, a comment captured. A binding is discovered in code and nowhere else, and so is a call: one inside a comment or a string a program prints is neither. A runner none of these name is read as python. */
export const SPOKEN_IN = {
  python: /"""(?:[^\\]|\\[\s\S])*?"""|'''(?:[^\\]|\\[\s\S])*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(#[^\n]*)/gu,
  node: /`(?:[^`\\]|\\[\s\S])*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/gu,
};

/* Each call by the positions its API writes: a destination is written and a source only read, except where the call takes the source away, which a move and a rename do. `open` writes its file only under a mode opening with `w` or `a`, the two `WRITE_CALLS` reads. */
const CALLS = [
  { name: /\bopen\s*\($/u, writes: [[0, "file"]], mode: [1, "mode"] },
  { name: /(?:FileSync|writeFile|\.write(?:TextFile|File)|\.write)\s*\($/u, writes: [[0, "path"]] },
  { name: /\bshutil\.(?:copy|copyfile|copy2)\s*\($/u, writes: [[1, "dst"]] },
  { name: /(?:\bshutil\.move|\bos\.(?:replace|rename))\s*\($/u, writes: [[0, "src"], [1, "dst"]] },
  { name: /\bos\.symlink\s*\($/u, writes: [[1, "dst"]] },
];
const OPENS = /(?:\bopen|\b(?:append|write)FileSync|\bwriteFile|\bDeno\.write(?:TextFile|File)|\bBun\.write|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink))\s*\(/gu;
/* A string literal, with the prefix python may give one. */
const STRING = String.raw`(?:[rRbBuUfF]{1,2})?(?:"[^"\n]*"|'[^'\n]*')`;
/* pathlib writes the path it is called on, which stands before the call as a literal, a `Path` of one, a parenthesised one, or a name. */
const RECEIVED = new RegExp(
  String.raw`(?:(?:\b(?:pathlib\.)?Path)?\(\s*${STRING}\s*\)|${STRING}|(?<![.\w])[A-Za-z_]\w*)\s*\.write_(?:text|bytes)\b`,
  "gu",
);
const STRING_IN = new RegExp(STRING, "u");

/* A whole string literal and nothing else: the one shape a call's argument names a file by that a reading can place without running the program. An f-string still holding a `{` is built at runtime, so it is none. */
const LITERAL = /^([rRbBuUfF]{0,2})(['"])([^'"\n]*)\2$/u;
/** What a whole string literal spells, its prefix and quotes off, or `null` where the text is no such literal. */
export const spelling = (said) => {
  const hit = LITERAL.exec(said);
  return hit && !(/f/iu.test(hit[1]) && hit[3].includes("{")) ? hit[3] : null;
};

const NAME = /^[A-Za-z_]\w*$/u;
const KEYWORD = /^([A-Za-z_]\w*)\s*=(?!=)\s*/u;
const CLOSE = { "(": ")", "[": "]", "{": "}" };

/* The arguments of the call whose `(` ends at `from`, each `{ from, to }` trimmed, and where its `)` stands: a quote and a bracket are walked so a comma or a parenthesis inside either splits nothing. `null` where the text ends before the call closes. */
const argsFrom = (code, from) => {
  const args = [];
  const open = [];
  let quote = null;
  let start = from;
  const push = (end) => {
    const text = code.slice(start, end);
    const lead = text.length - text.trimStart().length;
    if (text.trim()) args.push({ from: start + lead, to: start + text.trimEnd().length });
  };
  for (let at = from; at < code.length; at += 1) {
    const one = code[at];
    if (quote) {
      if (one === "\\") at += 1;
      else if (one === quote) quote = null;
    } else if (one === "'" || one === '"' || one === "`") quote = one;
    else if (CLOSE[one]) open.push(CLOSE[one]);
    else if (open.length && one === open.at(-1)) open.pop();
    else if (!open.length && one === ",") {
      push(at);
      start = at + 1;
    } else if (!open.length && one === ")") {
      push(at);
      return { args, end: at + 1 };
    }
  }
  return null;
};

/* The argument a call takes at a position or under a keyword, its keyword taken off. */
const argument = (code, args, [at, key]) => {
  const named = args.find((one) => KEYWORD.exec(code.slice(one.from, one.to))?.[1] === key);
  const one = named ?? args.filter((each) => !KEYWORD.test(code.slice(each.from, each.to)))[at];
  if (!one) return null;
  const skip = named ? KEYWORD.exec(code.slice(one.from, one.to))[0].length : 0;
  return { from: one.from + skip, to: one.to };
};

const literalAt = (code, one) => (one && spelling(code.slice(one.from, one.to)) !== null ? one : null);

/* What a string still runs, whose calls are code: a template's `${…}`, and an f-string's `{…}`. */
const F_PREFIX = /(?:^|[^\w])(?:[fF][rR]?|[rR][fF])$/u;
const holes = (code, one) => {
  if (one[0][0] === "`") return [...one[0].matchAll(/\$\{[^}]*\}/gu)];
  return F_PREFIX.test(code.slice(Math.max(0, one.index - 3), one.index)) ? [...one[0].matchAll(/\{[^{}]*\}/gu)] : [];
};

/** Each file call in `code`, the program a `runner` reads, `{ from, to }` its whole text; one spelt inside a string or a comment is none: `targets` are the whole literals it writes, each `{ from, to }`. `names` are the written arguments spelled as a bare name, for a reader holding the program's bindings. A call whose written argument is anything else has no target: what a program computes is not placed here. */
export const fileCalls = (code, runner) => {
  const said = [...code.matchAll(SPOKEN_IN[SPEAKS[runner]] ?? SPOKEN_IN.python)].map((one) => ({
    from: one.index,
    to: one.index + one[0].length,
    runs: holes(code, one).map((hole) => ({ from: one.index + hole.index, to: one.index + hole.index + hole[0].length })),
  }));
  const inside = (at) => said.some((one) => at > one.from && at < one.to && !one.runs.some((hole) => at > hole.from && at < hole.to));
  const out = [];
  for (const hit of [...code.matchAll(OPENS)].filter((one) => !inside(one.index))) {
    const opened = hit.index + hit[0].length;
    const call = CALLS.find((one) => one.name.test(hit[0]));
    const read = argsFrom(code, opened);
    if (!call || !read) continue;
    const mode = call.mode && literalAt(code, argument(code, read.args, call.mode));
    if (call.mode && !(mode && /^['"][wa]/u.test(code.slice(mode.from, mode.to)))) continue;
    const written = call.writes.map((one) => argument(code, read.args, one));
    const targets = written.filter((one) => literalAt(code, one));
    const names = written.filter((one) => one && NAME.test(code.slice(one.from, one.to)));
    out.push({ from: hit.index, to: read.end, targets, names });
  }
  for (const hit of [...code.matchAll(RECEIVED)].filter((one) => !inside(one.index))) {
    const said = STRING_IN.exec(hit[0]);
    const name = said ? null : /^[A-Za-z_]\w*/u.exec(hit[0]);
    const from = hit.index + (said ?? name).index;
    const one = { from, to: from + (said ?? name)[0].length };
    out.push({ from: hit.index, to: hit.index + hit[0].length, targets: said && spelling(said[0]) !== null ? [one] : [], names: name ? [one] : [] });
  }
  return out;
};
