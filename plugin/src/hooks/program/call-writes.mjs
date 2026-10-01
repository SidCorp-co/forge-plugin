// Which argument of a program's own file call is the file it writes, read off the call's text, for the readings that ask what a heredoc or a `-c` body in another language writes. how/writes.md.

import { argumentsAt } from "../../checks/shapes/calls.mjs";

/** Either half of a write made by a library call, anywhere in a text: `open` with a mode that writes, and every call below by name. The cheap test, before `fileCalls` reads which argument the call writes. */
export const WRITE_CALLS = String.raw`open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
  + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
  + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`;

/** The language each runner speaks, for the readings that tell its code from its strings. */
export const SPEAKS = { python: "python", python3: "python", node: "node", deno: "node", bun: "node" };

/** Where a language's strings and comments stand, a comment captured, and a JS regular expression read as a string: one opens where a value may, which a division never does. A binding is discovered in code and nowhere else, and so is a call: one inside a comment or a string a program prints is neither. A runner none of these name is read as python. */
export const SPOKEN_IN = {
  python: /"""(?:[^\\]|\\[\s\S])*?"""|'''(?:[^\\]|\\[\s\S])*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(#[^\n]*)/gu,
  node: new RegExp(
    String.raw`\x60(?:[^\x60\\]|\\[\s\S])*\x60|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`
      + String.raw`|(?<=(?:^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof)\s*)\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*`
      + String.raw`|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    "gu",
  ),
};

/* Each call by the positions its API writes: a destination is written and a source only read, except where the call takes the source away, which a move and a rename do. `open` writes its file only under a mode opening with `w` or `a`, the two `WRITE_CALLS` reads, and only as the builtin, node's `fs`, or a module's that opens a file by name; a path's `open` is a method, read below. */
const CALLS = [
  { name: /\bopen(?:Sync)?\s*\($/u, writes: [[0, "file"]], mode: [1, "mode"] },
  { name: /(?:FileSync|writeFile|\.write(?:TextFile|File)|\.write)\s*\($/u, writes: [[0, "path"]] },
  { name: /\bshutil\.(?:copy|copyfile|copy2)\s*\($/u, writes: [[1, "dst"]] },
  { name: /(?:\bshutil\.move|\bos\.(?:replace|rename))\s*\($/u, writes: [[0, "src"], [1, "dst"]] },
  { name: /\bos\.symlink\s*\($/u, writes: [[1, "dst"]] },
];
const OPENS = /(?:(?<![.\w])open|\b(?:io|codecs|gzip|bz2|lzma|tarfile)\.open|\b(?:fs|fsp|promises)\.open(?:Sync)?|\b(?:append|write)FileSync|\bwriteFile|\bDeno\.write(?:TextFile|File)|\bBun\.write|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink))\s*\(/gu;
/* A string literal, with the prefix python may give one. */
const STRING = String.raw`(?:[rRbBuUfF]{1,2})?(?:"[^"\n]*"|'[^'\n]*')`;
/* The path pathlib writes stands before the call as a literal, a `Path` of one, a parenthesised one that is no other call's argument list, or a name. A method named and not called writes nothing. */
const RECEIVED = new RegExp(
  String.raw`(?:(?<![.\w])(?:pathlib\.)?Path\(\s*${STRING}\s*\)|(?<![\w.)\]]\s*)\(\s*${STRING}\s*\)|${STRING}|(?<![.\w])[A-Za-z_]\w*)`
    + String.raw`\s*\.(?:write_(?:text|bytes)|open)\s*\(`,
  "gu",
);
const STRING_IN = new RegExp(STRING, "u");

/* A whole string literal and nothing else: the one shape a call's argument names a file by that a reading can place without running the program. An f-string still holding a `{` is built at runtime, so it is none. */
const LITERAL = /^([rRbBuUfF]{0,2})(?:"([^"\\\n]*)"|'([^'\\\n]*)')$/u;
/** What a whole string literal spells, its prefix and quotes off, or `null` where the text is no such literal. */
export const spelling = (said) => {
  const hit = LITERAL.exec(said);
  const inner = hit && (hit[2] ?? hit[3]);
  return hit && !(/f/iu.test(hit[1]) && inner.includes("{")) ? inner : null;
};

const NAME = /^[A-Za-z_]\w*$/u;
const KEYWORD = /^([A-Za-z_]\w*)\s*=(?!=)\s*/u;

/* The arguments of the call whose `(` ends at `from`, read off `bare`, where every string and comment is blanked so nothing in one splits or closes the call, and each trimmed against `code`, which still spells them. `null` where the text ends before the call closes. */
const argsFrom = (code, bare, from) => {
  const { args, close } = argumentsAt(bare, from - 1);
  if (close >= bare.length) return null;
  return {
    args: args.map((one) => {
      const text = code.slice(one.from, one.to);
      return { from: one.from + text.length - text.trimStart().length, to: one.from + text.trimEnd().length };
    }).filter((one) => one.to > one.from),
    end: close + 1,
  };
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

/* Each field a string runs, `{ from, to }` within it, from its opening brace to the one closing it: a brace nested in it, a string's aside, is counted. An f-string's doubled brace is a literal one, and so is a template's opener behind an odd run of backslashes; python escapes no brace that way. */
const fields = (text, opens) => {
  const out = [];
  for (let at = text.indexOf(opens); at >= 0; at = text.indexOf(opens, at + 1)) {
    if (opens === "{" && text[at + 1] === "{") {
      at += 1;
      continue;
    }
    if (opens === "${" && /(?:^|[^\\])(?:\\\\)*\\$/u.test(text.slice(0, at))) continue;
    let depth = 0;
    let quote = null;
    let end = at + opens.length - 1;
    for (; end < text.length; end += 1) {
      const one = text[end];
      if (quote) quote = one === quote ? null : quote;
      else if (one === "'" || one === '"') quote = one;
      else if (one === "{") depth += 1;
      else if (one === "}") depth -= 1;
      if (depth === 0 && !quote) break;
    }
    out.push({ from: at, to: end + 1 });
    at = end;
  }
  return out;
};

/* What a string still runs, whose calls are code: a template's `${…}`, and an f-string's `{…}`. */
const F_PREFIX = /(?:^|[^\w])(?:[fF][rR]?|[rR][fF])$/u;
const holes = (code, one) => {
  if (one[0][0] === "`") return fields(one[0], "${");
  return F_PREFIX.test(code.slice(Math.max(0, one.index - 3), one.index)) ? fields(one[0], "{") : [];
};

/* The stretches of `text` a program does not run, `[from, to)` past `base`: each string and comment, its opening quote aside so a literal a call stands on is not inside itself, less each field the string runs, which is read the same way again. */
const unrun = (text, base, pattern) => [...text.matchAll(pattern)].flatMap((one) => {
  const runs = holes(text, one);
  const pieces = [];
  let from = one.index + 1;
  for (const hole of runs) {
    pieces.push({ from: base + from, to: base + one.index + hole.from });
    from = one.index + hole.to;
  }
  pieces.push({ from: base + from, to: base + one.index + one[0].length });
  const within = runs.flatMap((hole) => unrun(one[0].slice(hole.from, hole.to), base + one.index + hole.from, pattern));
  return [...pieces, ...within];
});

/* A program's text with its comments blanked, offset for offset, so a comment between a call's arguments splits and closes nothing; the same with its strings blanked too, for the walk that splits arguments; and whether an offset stands where the program runs nothing, inside a string or a comment, where a call is none. */
const spokenIn = (given, runner) => {
  const pattern = SPOKEN_IN[SPEAKS[runner]] ?? SPOKEN_IN.python;
  const code = [...given.matchAll(pattern)].filter((one) => one[1] !== undefined)
    .reduce((text, one) => `${text.slice(0, one.index)}${" ".repeat(one[0].length)}${text.slice(one.index + one[0].length)}`, given);
  const pieces = unrun(given, 0, pattern);
  const bare = pieces.reduce((text, one) => `${text.slice(0, one.from)}${" ".repeat(one.to - one.from)}${text.slice(one.to)}`, code);
  return { code, bare, inside: (at) => pieces.some((one) => at >= one.from && at < one.to) };
};

/* pathlib's writes, on the path they are called on, where a module's call above has not already read the same parenthesis: `write_text` and `write_bytes` always, and `open` under a mode its first argument or `mode=` spells with `w` or `a` — an archive's `open('member', 'w')` names a member there, and writes no file, so an `open` taking its mode second is some object's own, placed nowhere and kept for the reading that keeps every candidate. A receiver `RECEIVED` cannot read is computed, and its line is the call. */
const METHOD = /\.(write_(?:text|bytes)|open)\s*\(/gu;
const receivedCalls = ({ code, bare, inside }, taken) => {
  const received = [...code.matchAll(RECEIVED)].filter((one) => !inside(one.index));
  return [...code.matchAll(METHOD)].filter((one) => !inside(one.index)).flatMap((hit) => {
    const to = hit.index + hit[0].length;
    if (taken.has(to)) return [];
    if (hit[1] === "open") {
      const read = argsFrom(code, bare, to);
      const writes = (at) => {
        const mode = read && literalAt(code, argument(code, read.args, [at, "mode"]));
        return mode && /^[wa]/u.test(spelling(code.slice(mode.from, mode.to)));
      };
      if (!writes(0)) {
        const text = read && code.slice(hit.index, read.end);
        return read && writes(1) ? [{ from: hit.index, to: read.end, text, targets: [], names: [], computed: true }] : [];
      }
    }
    const by = received.find((one) => one.index + one[0].length === to);
    if (!by) {
      const from = code.lastIndexOf("\n", hit.index) + 1;
      return [{ from, to, text: code.slice(from, to), targets: [], names: [], computed: true }];
    }
    const said = STRING_IN.exec(by[0]);
    const name = said ? null : /^[A-Za-z_]\w*/u.exec(by[0]);
    const from = by.index + (said ?? name).index;
    const one = { from, to: from + (said ?? name)[0].length };
    const targets = said && spelling(said[0]) !== null ? [one] : [];
    return [{ from: by.index, to, text: by[0], targets, names: name ? [one] : [], computed: !targets.length }];
  });
};

/** Each file call in `given`, the program a `runner` reads: `{ from, to }` is where it stands, `text` what it says, `targets` are the whole literals it writes, each `{ from, to }`. `names` are the written arguments spelled as a bare name, for a reader holding the program's bindings. A written argument that is anything else is no target, and `computed` says the call has one: what a program computes is not placed here. */
export const fileCalls = (given, runner) => {
  const { code, bare, inside } = spokenIn(given, runner);
  const out = [];
  for (const hit of [...code.matchAll(OPENS)].filter((one) => !inside(one.index))) {
    const opened = hit.index + hit[0].length;
    const call = CALLS.find((one) => one.name.test(hit[0]));
    const read = argsFrom(code, bare, opened);
    if (!call || !read) continue;
    const mode = call.mode && literalAt(code, argument(code, read.args, call.mode));
    if (call.mode && !(mode && /^[wa]/u.test(spelling(code.slice(mode.from, mode.to))))) continue;
    const written = call.writes.map((one) => argument(code, read.args, one));
    const targets = written.filter((one) => literalAt(code, one));
    const names = written.filter((one) => one && NAME.test(code.slice(one.from, one.to)));
    const computed = targets.length < written.filter(Boolean).length;
    out.push({ from: hit.index, to: read.end, opened, text: code.slice(hit.index, read.end), targets, names, computed });
  }
  return [...out, ...receivedCalls({ code, bare, inside }, new Set(out.map((one) => one.opened)))];
};
