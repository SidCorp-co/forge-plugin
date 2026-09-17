/* Which reader each park kind speaks to, and so which side status it lands in; the names one
   landing is held under, what proves them one, and the write order that follows from it:
   docs/cli/advance-what-it-sends.md. */
export const ANSWERED_BY_COMMENT = "needs_info";

export const PARK_STATUS = {
  question: ANSWERED_BY_COMMENT,
  "screen-review": "waiting",
  "destructive-migration": "waiting",
  "release-decision": "waiting",
  "code-review": "waiting",
  "rolled-back": "on_hold",
  "no-way-back": "on_hold",
  unshippable: "on_hold",
  blocked: "on_hold",
  paused: "on_hold",
  crashed: "on_hold",
  dropped: "dropped",
};

export const SIDE = [ANSWERED_BY_COMMENT, "waiting", "on_hold"];

const ONE_LANDING = [["waiting", ANSWERED_BY_COMMENT]];

export const sameLanding = (one, other) =>
  one === other || ONE_LANDING.some((pair) => pair.includes(one) && pair.includes(other));

export const answersByComment = (status) => sameLanding(status, ANSWERED_BY_COMMENT);
