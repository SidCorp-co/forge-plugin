// Which argument of a program's own file call is the file it writes, read off the call's text, for the readings that ask what a heredoc or a `-c` body in another language writes. how/writes.md.

import { argumentsAt } from "../../checks/shapes/calls.mjs";
import { spokenIn } from "./spoken.mjs";

/** Either half of a write made by a library call, anywhere in a text: `open` with a mode that writes, and every call below by name. The cheap test, before `fileCalls` reads which argument the call writes. */
export const WRITE_CALLS = String.raw`open\([^)]*['"][wa]|\bwrite_(?:text|bytes)\b|\b(?:append|write)FileSync\b`
  + String.raw`|\bwriteFile\b|\bDeno\.write(?:TextFile|File)\b|\bBun\.write\b`
  + String.raw`|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink)\b`;

/* Each call by the positions its API writes: a destination is written and a source only read, except where the call takes the source away, which a move and a rename do. `open` writes its file only under a mode opening with `w` or `a`, the two `WRITE_CALLS` reads, and only as the builtin, node's `fs`, or a module's that opens a file by name; a path's `open` is a method, read below. */
const CALLS = [
  { name: /\bopen(?:Sync)?\s*\($/u, writes: [[0, "file"]], mode: [1, "mode"] },
  { name: /(?:FileSync|writeFile|\.write(?:TextFile|File)|\.write)\s*\($/u, writes: [[0, "path"]] },
  { name: /\bshutil\.(?:copy|copyfile|copy2)\s*\($/u, writes: [[1, "dst"]] },
  { name: /(?:\bshutil\.move|\bos\.(?:replace|rename))\s*\($/u, writes: [[0, "src"], [1, "dst"]] },
  { name: /\bos\.symlink\s*\($/u, writes: [[1, "dst"]] },
];
const OPENS = /(?:(?<![.\w])open|\b(?:io|codecs|gzip|bz2|lzma|tarfile)\.open|\b(?:fs|fsp|promises)\.open(?:Sync)?|\b(?:append|write)FileSync|\bwriteFile|\bDeno\.write(?:TextFile|File)|\bBun\.write|\bshutil\.(?:copy|copyfile|copy2|move)|\bos\.(?:replace|rename|symlink))\s*\(/gu;
/** A string literal's whole extent, with the prefix python may give one and its triple-quoted forms, as a pattern's source: the one grammar every reading of a program's literal shares, `spelling` saying which of them a reading may place. */
export const STRING = String.raw`(?:[rRbBuUfF]{1,2})?(?:"""(?:(?!""")[^\n])*"""|'''(?:(?!''')[^\n])*'''|"[^"\n]*"|'[^'\n]*')`;
/* The path pathlib writes stands before the call as a literal, a `Path` of one, a parenthesised one that is no other call's argument list, or a name. A method named and not called writes nothing. */
const RECEIVED = new RegExp(
  String.raw`(?:(?<![.\w])(?:pathlib\.)?Path\(\s*${STRING}\s*\)|(?<![\w.)\]]\s*)\(\s*${STRING}\s*\)|${STRING}|(?<![.\w])[A-Za-z_]\w*)`
    + String.raw`\s*\.(?:write_(?:text|bytes)|open)\s*\(`,
  "gu",
);
const STRING_IN = new RegExp(STRING, "u");

/* A whole string literal and nothing else: the one shape a call's argument names a file by that a reading can place without running the program. A backslash is an escape a reading does not take, and an f-string still holding a `{` is built at runtime, so neither is one. */
const WHOLE = new RegExp(String.raw`^${STRING}$`, "u");
/** What a whole string literal spells, its prefix and quotes off, or `null` where the text is no such literal. */
export const spelling = (said) => {
  if (!WHOLE.test(said)) return null;
  const prefix = /^[rRbBuUfF]*/u.exec(said)[0];
  const quote = said.startsWith(said[prefix.length].repeat(3), prefix.length) && said.length - prefix.length >= 6 ? 3 : 1;
  const inner = said.slice(prefix.length + quote, said.length - quote);
  return inner.includes("\\") || (/f/iu.test(prefix) && inner.includes("{")) ? null : inner;
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
