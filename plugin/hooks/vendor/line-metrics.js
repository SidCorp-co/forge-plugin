// VENDORED — do not edit. Upstream: eslint-plugin-code-quality v0.16.0, commit fa3b292,
//   src/line-metrics.js
//
// A copy of packages/code-quality/src/line-metrics.js, for its waiver vocabulary: skill-dup.mjs
// honours `restated: deliberate — <reason>` so a contrast comment is waived once, in the words
// the duplicate-comment ESLint rule already reads. Copied rather than imported for the reason
// text-overlap.js is, and plugin/scripts/check-vendor.mjs compares the copies on every check.
//

export function isIgnoredComment(comment) {
  const text = comment.value.trim();
  return /^(?:eslint-(?:disable|enable)|@ts-(?:ignore|expect-error))/i.test(text);
}

/**
 * How a project says "I know, and here is why" to a rule: one marker, the escape word, and a
 * mandatory reason, since a waiver nobody had to justify is an exemption with better syntax.
 * Enumerating them is the point — the plugin's own vocabulary, not the cases met so far.
 */
export function waiverPattern(marker, escape) {
  return new RegExp(`${marker}:\\s*${escape}\\s*[—-]\\s*(\\S[^\\n]*)`);
}

export const PASS_THROUGH_WAIVER = waiverPattern("pass-through", "keep");
export const RAW_ELEMENT_WAIVER = waiverPattern("primitive", "none");
export const RESTATEMENT_WAIVER = waiverPattern("restated", "deliberate");
const WAIVERS = [PASS_THROUGH_WAIVER, RAW_ELEMENT_WAIVER, RESTATEMENT_WAIVER];

const waives = (text) => WAIVERS.some((waiver) => waiver.test(text));

export const isWaiver = (comment) => waives(comment.value);

function blockLineContent(line, lineNumber, comment) {
  let content = line;
  if (lineNumber === comment.loc.start.line) {
    content = content.slice(comment.loc.start.column + 2);
  }
  if (lineNumber === comment.loc.end.line) {
    const endColumn = comment.loc.end.column - 2;
    const startColumn = lineNumber === comment.loc.start.line ? comment.loc.start.column + 2 : 0;
    content = content.slice(0, Math.max(0, endColumn - startColumn));
  }
  return content.replace(/^\s*\*?\s?/, "").trim();
}

function isDecorative(content) {
  return content === "" || /^[\s*\-=~_#]+$/.test(content);
}

function commentContentOnLine(comment, line, lineNumber) {
  if (comment.type === "Line") return comment.value.trim();
  if (comment.type !== "Block") return "";
  return blockLineContent(line, lineNumber, comment);
}

function lineHasCode(sourceCode, lineNumber, commentsOnLine) {
  const lineStart = sourceCode.getIndexFromLoc({ line: lineNumber, column: 0 });
  const line = sourceCode.lines[lineNumber - 1] ?? "";
  const segments = [];
  let cursor = lineStart;

  for (const comment of commentsOnLine.sort((a, b) => a.range[0] - b.range[0])) {
    const start = Math.max(comment.range[0], lineStart);
    const end = Math.min(comment.range[1], lineStart + line.length);
    if (start > cursor) segments.push(sourceCode.text.slice(cursor, start));
    cursor = Math.max(cursor, end);
  }
  if (cursor < lineStart + line.length) {
    segments.push(sourceCode.text.slice(cursor, lineStart + line.length));
  }
  return segments.some((segment) => segment.trim() !== "");
}

/* Where each waiver of a run begins and ends, measured over the run read as one text so that a
   reason on the next line is the same waiver. A reason ends with its own line, which is what
   keeps a waiver from making the block of prose beneath it free: the escape is the answer to a
   rule and not prose about the code, and charged it would cost a file at its budget the very
   line it needs to say why. */
function waivedRanges(said) {
  const joined = said.join("\n");
  const ranges = [];
  for (const waiver of WAIVERS) {
    const scan = new RegExp(waiver.source, "g");
    let found = scan.exec(joined);
    while (found !== null) {
      ranges.push([found.index, found.index + found[0].length]);
      found = scan.exec(joined);
    }
  }
  return ranges;
}

/* A run is what a waiver is read over, its reason being prose that wraps like prose: a marker on
   one line and its reason on the next is one waiver. A comment sharing its line with code heads
   no run, and a blank line or a line of code ends one. */
function lineCommentRuns(sourceCode, comments) {
  const runs = [];
  for (const comment of comments) {
    const alone =
      comment.type === "Line" &&
      sourceCode.lines[comment.loc.start.line - 1].slice(0, comment.loc.start.column).trim() === "";
    const open = runs.at(-1);
    const continues =
      alone && open?.alone === true && comment.loc.start.line === open.comments.at(-1).loc.end.line + 1;
    if (continues) open.comments.push(comment);
    else runs.push({ alone, comments: [comment] });
  }
  return runs;
}

// Both comment rules ask for the same metrics on the same file, and the walk
// below touches every line twice.
const metricsCache = new WeakMap();

export function getLineMetrics(sourceCode) {
  const cached = metricsCache.get(sourceCode);
  if (cached) return cached;

  const commentsByLine = new Map();
  const counted = [];
  for (const comment of sourceCode.getAllComments()) {
    for (let line = comment.loc.start.line; line <= comment.loc.end.line; line += 1) {
      const comments = commentsByLine.get(line) ?? [];
      comments.push(comment);
      commentsByLine.set(line, comments);
    }
    if (comment.type !== "Shebang" && !isIgnoredComment(comment)) counted.push(comment);
  }

  // Re-wrapping a comment adds and takes away two things and no others: blank space, and the
  // asterisk a continuation line is given. So those two are what a character does not count.
  let commentChars = 0;
  for (const { comments } of lineCommentRuns(sourceCode, counted)) {
    const said = comments.map((comment) => comment.value);
    const waived = waivedRanges(said);
    let at = 0;
    for (const text of said) {
      const escape = waived.some(([from, to]) => from < at + text.length && to > at);
      if (!escape) commentChars += text.replace(/[\s*]+/gu, "").length;
      at += text.length + 1;
    }
  }

  const codeLines = new Set();
  const commentLines = new Set();
  for (let lineNumber = 1; lineNumber <= sourceCode.lines.length; lineNumber += 1) {
    const line = sourceCode.lines[lineNumber - 1];
    const comments = commentsByLine.get(lineNumber) ?? [];
    if (
      comments.some(
        (comment) =>
          comment.type !== "Shebang" &&
          !isIgnoredComment(comment) &&
          !isWaiver(comment) &&
          !isDecorative(commentContentOnLine(comment, line, lineNumber)),
      )
    ) {
      commentLines.add(lineNumber);
    }
    if (lineHasCode(sourceCode, lineNumber, comments)) codeLines.add(lineNumber);
  }

  const metrics = { codeLines, commentLines, commentChars };
  metricsCache.set(sourceCode, metrics);
  return metrics;
}

export function longestConsecutiveRun(lines) {
  const sorted = [...lines].sort((a, b) => a - b);
  let longest = [];
  let current = [];
  for (const line of sorted) {
    if (current.length === 0 || line === current.at(-1) + 1) current.push(line);
    else current = [line];
    if (current.length > longest.length) longest = [...current];
  }
  return longest;
}
