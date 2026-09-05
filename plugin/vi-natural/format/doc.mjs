// Markdown segmentation: translate the prose, leave the machinery alone.

import { CODE_SPAN_NONEMPTY_PATTERN, LINK_TARGET_OPEN_PATTERN } from "../../src/markdown.mjs";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const SPLIT = /(\n[ \t]*\n)/;
const INLINE_CODE = new RegExp(CODE_SPAN_NONEMPTY_PATTERN, "g");
const LINK_TARGET = new RegExp(LINK_TARGET_OPEN_PATTERN, "g");
const SENTINEL = /⟦VI\d+⟧/g;
const NOTHING_TO_SAY = /^[\s\W\d]*$/;
const COMMENT_ONLY = /^\s*<!--[\s\S]*-->\s*$/;
const LINK_DEF = /^\s*\[[^\]]+\]:\s*\S+\s*$/;
const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;

// Line endings ride on the lines, so concatenating every piece reproduces the file byte for byte —
// the property the whole command rests on.
function keepLines(text) {
  return text.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function untranslatable(block) {
  const stripped = block.trim();
  if (!stripped) return true;
  return NOTHING_TO_SAY.test(stripped) || COMMENT_ONLY.test(stripped) || LINK_DEF.test(stripped);
}

function flush(pieces, buffer) {
  if (!buffer.length) return;
  const body = buffer.join("");
  buffer.length = 0;
  for (const part of body.split(SPLIT)) {
    if (!part) continue;
    if (new RegExp(`^${SPLIT.source}$`).test(part) || untranslatable(part)) {
      pieces.push(["keep", part]);
      continue;
    }
    // Surrounding whitespace rides along as "keep": the model would not give it back, and losing a
    // trailing newline silently reflows the document.
    const text = part.replace(/^\n+/, "").replace(/\n+$/, "");
    const at = part.indexOf(text);
    const head = part.slice(0, at);
    const tail = part.slice(at + text.length);
    if (head) pieces.push(["keep", head]);
    pieces.push(["text", text]);
    if (tail) pieces.push(["keep", tail]);
  }
}

/** Split into ["text", block] pieces to translate and ["keep", block] pieces to copy.
 *
 *  Fenced code, frontmatter, link definitions, HTML comments and the blank lines between blocks are
 *  all "keep" — they pass through byte for byte. */
export function segment(text) {
  const pieces = [];
  const lines = keepLines(text);
  let index = 0;

  if (lines.length && lines[0].trim() === "---") {
    for (let end = 1; end < lines.length; end += 1) {
      if (["---", "..."].includes(lines[end].trim())) {
        pieces.push(["keep", lines.slice(0, end + 1).join("")]);
        index = end + 1;
        break;
      }
    }
  }

  const buffer = [];
  while (index < lines.length) {
    const match = FENCE.exec(lines[index]);
    if (!match) {
      buffer.push(lines[index]);
      index += 1;
      continue;
    }
    const marker = match[1];
    const block = [lines[index]];
    index += 1;
    while (index < lines.length) {
      block.push(lines[index]);
      const closed = lines[index].trim().startsWith(marker[0].repeat(marker.length));
      index += 1;
      if (closed) break;
    }
    flush(pieces, buffer);
    pieces.push(["keep", block.join("")]);
  }
  flush(pieces, buffer);
  return pieces;
}

/** Where each prose block sits in the document, keyed by index in `pieces`.
 *
 *  A paragraph has the ambiguity a locale string's key path resolves — gateway/engine.mjs — and no
 *  key of its own: lifted out of its section it can mean several things. The heading above it is
 *  the key path it already has.
 *
 *  Keyed by index in `pieces`, not by position among the prose blocks: the two callers number their
 *  items differently and only this index is common to both. */
export function headingTrails(pieces, root) {
  const trails = {};
  const stack = [];
  pieces.forEach(([kind, block], index) => {
    if (kind !== "text") return;
    let own = stack.map(([, title]) => title);
    for (const line of block.split("\n")) {
      const match = HEADING.exec(line);
      if (!match) continue;
      const level = match[1].length;
      // A new heading closes every deeper one; its own trail is its parent's.
      while (stack.length && stack[stack.length - 1][0] >= level) stack.pop();
      own = stack.map(([, title]) => title);
      stack.push([level, match[2]]);
    }
    trails[index] = [...(root ? [root] : []), ...own.filter(Boolean)].join(" › ");
  });
  return trails;
}

/** Swap inline code spans for sentinels so the model cannot reword an identifier. */
export function protectInline(block, slots) {
  return block.replace(INLINE_CODE, (match) => {
    const token = `⟦VI${slots.length}⟧`;
    slots.push(match);
    return token;
  });
}

export function restoreInline(block, slots) {
  return block.replace(SENTINEL, (match) => {
    const index = Number(match.slice(3, -1));
    return index < slots.length ? slots[index] : match;
  });
}

const found = (text, pattern) => (text.match(pattern) ?? []).sort();
const hashes = (text) => text.trimStart().length - text.trimStart().replace(/^#+/, "").length;

/** What a Markdown block must keep: its sentinels, and every target a `](` opens — a titled link is one the closed form reads nothing from. */
export function verify(source, translated) {
  if (String(found(source, SENTINEL)) !== String(found(translated, SENTINEL))) {
    return "code span or placeholder token lost";
  }
  const links = (text) => [...text.matchAll(LINK_TARGET)].map((m) => m[1]).sort();
  if (String(links(source)) !== String(links(translated))) return "link target changed";
  if (source.trimStart().startsWith("#") && hashes(source) !== hashes(translated)) {
    return "heading level changed";
  }
  return null;
}
