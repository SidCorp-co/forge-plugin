const HISTORICAL_NARRATION = [
  /\b(?:used to|formerly|previously)\b/i,
  /\b(?:before|after) (?:the )?(?:change|refactor|rewrite|migration)\b/i,
  /\b(?:old|previous) (?:logic|flow|implementation|behavior|behaviour|code path|version|approach|design|default|setting|limit|cap|field|endpoint|surface|retry policy|tail tap)\b/i,
  /\b(?:changed|updated|rewritten) (?:logic|implementation|flow|behavior|behaviour)\b/i,
  /\b(?:retained|kept|left) for (?:historical )?reference only\b/i,
  /\b(?:ported|migrated|copied) from\b/i,
  /\bno longer (?:uses?|calls?|accepts?|rejects?|refuses?|requires?|supports?|owns?|handles?)\b/i,
  /\b(?:was|were) (?:REST|API|CLI|frontend|backend|server|client|provider)-only\b/i,
  /\b(?:M\d+[a-z]?\s+(?:service\s+)?agents?|Slice \d+)\b/i,
  /\b(?:sibling|parallel|later|service) agents?\b/i,
  /\bteam lead (?:merges?|merged|will merge)\b/i,
  /\b(?:see above|ditto)\b/i,
  /\b(?:git (?:history|log)|commit history)\b/i,
];

function isIgnoredComment(comment) {
  const text = comment.value.trim();
  return /^(?:eslint-(?:disable|enable)|@ts-(?:ignore|expect-error))/i.test(text);
}

function normaliseComment(comment) {
  return comment.value.replace(/^\s*\*\s?/gm, "").replace(/\s+/g, " ").trim();
}

export function isHistoricalNarration(text) {
  return HISTORICAL_NARRATION.some((pattern) => pattern.test(text));
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Reject stale historical narration and redundant cross-references in comments",
      recommended: true,
    },
    schema: [],
    messages: {
      historicalNarration:
        "Comment narrates historical implementation details. Explain the current invariant or constraint instead.",
    },
  },
  create(context) {
    return {
      "Program:exit"() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === "Shebang" || isIgnoredComment(comment)) continue;
          if (!isHistoricalNarration(normaliseComment(comment))) continue;
          context.report({ loc: comment.loc, messageId: "historicalNarration" });
        }
      },
    };
  },
};
