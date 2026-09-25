/* Which property of a value holds the path, for the regex-path check: a name destructured beside a
   room is not a room, so `const { room, at } = repo()` is read against what `repo` answers with
   rather than as one pattern tainted whole (ISS-2539). Where the answer cannot be read here, the
   reading is null and the caller keeps its conservative taint. */

const NAME = /^[A-Za-z_$][\w$]*$/u;
const KEYED = /^(?:([A-Za-z_$][\w$]*)|"([^"]*)"|'([^']*)')\s*:\s*/u;

/** The offset of the bracket closing the one opened at `open`, quotes skipped; -1 where none does. */
const closing = (code, open) => {
  let depth = 0;
  let quote = "";
  for (let at = open; at < code.length; at += 1) {
    const one = code[at];
    if (one === "\\") at += 1;
    else if (quote) { if (one === quote) quote = ""; }
    else if (one === "'" || one === '"' || one === "`") quote = one;
    else if (one === "(" || one === "[" || one === "{") depth += 1;
    else if (one === ")" || one === "]" || one === "}") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
};

/** The top-level comma-separated pieces between `from` and `to`, or null where a bracket or a
 *  quote opened inside them does not close there. */
const pieces = (code, from, to) => {
  const out = [];
  let start = from;
  for (let at = from; at <= to; at += 1) {
    const one = code[at];
    if (at === to || one === ",") {
      out.push({ text: code.slice(start, at), at: start });
      start = at + 1;
    } else if ("([{'\"`".includes(one)) {
      const shut = "'\"`".includes(one) ? code.indexOf(one, at + 1) : closing(code, at);
      if (shut === -1 || shut > to) return null;
      at = shut;
    }
  }
  return out;
};

/* An object literal's entries as key and value. A spread, a computed key, a method or an accessor
   is an entry whose value is not an expression read here, so any of them leaves the literal
   unread (null) rather than read as holding no path. */
const entriesAt = (code, open) => {
  const shut = closing(code, open);
  const found = shut === -1 ? null : pieces(code, open + 1, shut);
  if (!found) return null;
  const entries = [];
  for (const piece of found) {
    const text = piece.text.trim();
    if (!text) continue;
    const lead = piece.at + piece.text.indexOf(text);
    const keyed = KEYED.exec(text);
    if (NAME.test(text)) entries.push({ key: text, value: text, at: lead });
    else if (keyed) entries.push({ key: keyed[1] ?? keyed[2] ?? keyed[3], value: text.slice(keyed[0].length), at: lead + keyed[0].length });
    else return null;
  }
  return entries;
};

/** Where a function's body opens: a block's brace, or the brace of a concise `=> ({ ... })`. */
const bodyAt = (code, from, to) => {
  if (/^\s*(?:async\s+)?function\b/u.test(code.slice(from, to))) {
    const params = code.indexOf("(", from);
    const shut = params === -1 ? -1 : closing(code, params);
    return shut === -1 ? null : { open: code.indexOf("{", shut), concise: false };
  }
  let depth = 0;
  for (let at = from; at < to; at += 1) {
    const one = code[at];
    if (one === "(" || one === "[" || one === "{") depth += 1;
    else if (one === ")" || one === "]" || one === "}") depth -= 1;
    else if (depth === 0 && code.startsWith("=>", at)) {
      const past = at + 2 + code.slice(at + 2).search(/\S/u);
      if (code[past] === "{") return { open: past, concise: false };
      const inner = past + 1 + code.slice(past + 1).search(/\S/u);
      return code[past] === "(" && code[inner] === "{" ? { open: inner, concise: true } : null;
    }
  }
  return null;
};

const CONTROL = new Set(["if", "for", "while", "switch", "catch", "with"]);

/* Where each `return` of the function whose body opens at `open` hands back its value: quoted text
   is skipped, and so is the body of every function nested in it — an arrow's block, a `function`,
   a method — whose returns are its own. Null where the body does not close. */
const ownReturns = (code, open) => {
  const shut = closing(code, open);
  if (shut === -1) return null;
  const found = [];
  const parens = [];
  const skipBlock = (from) => {
    const brace = from + code.slice(from).search(/\S/u);
    return code[brace] === "{" ? closing(code, brace) : -1;
  };
  for (let at = open + 1; at < shut; at += 1) {
    const one = code[at];
    if (one === "'" || one === '"' || one === "`") {
      let end = at + 1;
      while (end < shut && code[end] !== one) end += code[end] === "\\" ? 2 : 1;
      at = end;
    } else if (one === "(") parens.push(at);
    else if (one === ")") {
      const from = parens.pop() ?? at;
      const named = /([A-Za-z_$][\w$]*)\s*$/u.exec(code.slice(Math.max(open, from - 40), from));
      const block = named && !CONTROL.has(named[1]) ? skipBlock(at + 1) : -1;
      if (block !== -1) at = block;
    } else if (code.startsWith("=>", at)) {
      const block = skipBlock(at + 2);
      if (block !== -1) at = block;
    } else if (/[\w$]/u.test(code[at - 1] ?? "")) continue;
    else if (/^return\b/u.test(code.slice(at, at + 7))) {
      found.push(at + 6 + code.slice(at + 6).search(/\S/u));
    }
  }
  return found;
};

/* Every object literal a right-hand side answers with: itself, a concise arrow's, or each return of
   a function body. Any return that is not an object literal leaves the answer unread. */
export const shapeOf = (code, from, to) => {
  const lead = from + code.slice(from, to).search(/\S/u);
  if (code[lead] === "{") return entriesAt(code, lead);
  const body = bodyAt(code, lead, to);
  if (!body || body.open === -1) return null;
  if (body.concise) return entriesAt(code, body.open);
  const returns = ownReturns(code, body.open);
  if (!returns?.length) return null;
  const entries = [];
  for (const open of returns) {
    const found = code[open] === "{" ? entriesAt(code, open) : null;
    if (!found) return null;
    entries.push(...found);
  }
  return entries;
};

/* A destructuring pattern's keys and the names they bind — `k`, `"k": n`, `n = v`, `...rest` — or
   null where a piece is none of those, which leaves the pattern for the caller to taint whole. */
export const pairsOf = (pattern) => {
  const found = pieces(pattern, 0, pattern.length);
  if (!found) return null;
  const pairs = [];
  for (const { text } of found) {
    const one = text.trim();
    const keyed = KEYED.exec(one);
    const bound = keyed ? /^[A-Za-z_$][\w$]*/u.exec(one.slice(keyed[0].length)) : null;
    const bare = /^([A-Za-z_$][\w$]*)\s*(?:=|$)/u.exec(one);
    if (!one) continue;
    if (one.startsWith("...") && NAME.test(one.slice(3).trim())) pairs.push({ key: null, name: one.slice(3).trim() });
    else if (bound) pairs.push({ key: keyed[1] ?? keyed[2] ?? keyed[3], name: bound[0] });
    else if (bare) pairs.push({ key: bare[1], name: bare[1] });
    else return null;
  }
  return pairs;
};

/** The callee where a right-hand side is one call and nothing after it, awaited or not. */
export const calleeOf = (code, from, to) => {
  const text = code.slice(from, to);
  const call = /^\s*(?:await\s+)?([A-Za-z_$][\w$]*)\s*\(/u.exec(text);
  if (!call) return null;
  const shut = closing(code, from + call[0].length - 1);
  return shut !== -1 && !code.slice(shut + 1, to).trim() ? call[1] : null;
};
