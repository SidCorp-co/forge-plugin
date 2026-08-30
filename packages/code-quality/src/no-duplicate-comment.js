import { isIgnoredComment, isWaiver } from "./line-metrics.js";
import {
  DEFAULT_MIN_SENTENCE_LENGTH,
  DEFAULT_OVERLAP_FLOOR,
  DEFAULT_OVERLAP_THRESHOLD,
  findOverlaps,
  splitSentences,
} from "./text-overlap.js";

/**
 * A constraint stated in two comments has two authorities, and the pair diverges the first time
 * someone corrects the one they happened to be reading — silently, because each copy still reads
 * as correct. The other two comment rules cannot see it: density counts lines without reading
 * them, and narration matches phrases inside one comment at a time.
 *
 * A waiver is skipped rather than counted: every one in a file says the same thing by
 * construction, so reporting them would set two rules against each other.
 *
 * Two limits, both deliberate. ESLint is handed one file, so this is what a file repeats to
 * itself. And a pair is only ever two DIFFERENT blocks: adjacent sentences inside one share a
 * topic and therefore a vocabulary, which scores high on nothing.
 */

const isDirective = (comment) => isIgnoredComment(comment) || isWaiver(comment);

/** A run of `//` lines is one comment to a reader, N nodes to ESLint, and a sentence spans two of
 *  them often enough that grouping first is what makes the compared text the written text. */
function blocksOf(sourceCode) {
  const blocks = [];
  let open = null;
  for (const comment of sourceCode.getAllComments()) {
    if (comment.type === "Shebang" || isDirective(comment)) {
      open = null;
      continue;
    }
    const joins =
      open !== null &&
      comment.type === "Line" &&
      open.type === "Line" &&
      comment.loc.start.line === open.loc.end.line + 1;
    if (joins) {
      open.comments.push(comment);
      open.loc = { start: open.loc.start, end: comment.loc.end };
      continue;
    }
    open = {
      type: comment.type,
      comments: [comment],
      loc: { start: comment.loc.start, end: comment.loc.end },
      start: comment.range[0],
    };
    blocks.push(open);
  }
  return blocks;
}

function textOf(block) {
  return block.comments
    .map((comment) => comment.value.replace(/^\s*\*\s?/gm, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const quote = (text) => (text.length > 80 ? `${text.slice(0, 80)}…` : text);

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Reject a comment restating what another comment in the file already says",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          threshold: { type: "number", minimum: 0, maximum: 1 },
          floor: { type: "integer", minimum: 1 },
          minLength: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      duplicateComment:
        'This repeats what the comment on line {{line}} already says ("{{other}}"). Keep the statement in one place; two authorities for one constraint diverge the first time someone corrects only the copy they found.',
    },
  },
  create(context) {
    const {
      threshold = DEFAULT_OVERLAP_THRESHOLD,
      floor = DEFAULT_OVERLAP_FLOOR,
      minLength = DEFAULT_MIN_SENTENCE_LENGTH,
    } = context.options[0] ?? {};

    return {
      "Program:exit"() {
        const units = [];
        for (const block of blocksOf(context.sourceCode)) {
          for (const sentence of splitSentences(textOf(block), minLength)) {
            units.push([block, sentence]);
          }
        }

        const reported = new Set();
        for (const [, a, b] of findOverlaps(units, { threshold, floor })) {
          if (a[0] === b[0]) continue;
          // The later block is the one to delete: the earlier is where the constraint was first
          // recorded, and reporting upwards would ask for the wrong edit.
          const [first, second] = a[0].start <= b[0].start ? [a, b] : [b, a];
          if (reported.has(second[0])) continue;
          reported.add(second[0]);
          context.report({
            loc: second[0].loc,
            messageId: "duplicateComment",
            data: { line: String(first[0].loc.start.line), other: quote(first[1]) },
          });
        }
      },
    };
  },
};
