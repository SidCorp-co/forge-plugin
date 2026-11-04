/* Which reader each park kind speaks to, and so which side status it lands in; the names one
   landing is held under, what proves them one, and the write order that follows from it:
   docs/cli/advance-what-it-sends.md. */
/* `needs_info` is the side status every park on a person lands in: a park that waits on a person,
   resumed through the question row core transitions on when the park is answered, never by reading a
   posted comment as the reply (ISS-26, ISS-51). The kind of wait is carried as `waitingKind`
   (`../park/compose.mjs:waitsFor`). */
export const NEEDS_INFO = "needs_info";

export const PARK_STATUS = {
  question: NEEDS_INFO,
  "screen-review": NEEDS_INFO,
  "destructive-migration": NEEDS_INFO,
  "release-decision": NEEDS_INFO,
  "code-review": NEEDS_INFO,
  "rolled-back": "on_hold",
  "no-way-back": "on_hold",
  unshippable: "on_hold",
  blocked: "on_hold",
  paused: "on_hold",
  crashed: "on_hold",
  dropped: "dropped",
};

export const SIDE = [NEEDS_INFO, "on_hold"];

/* The two statuses an issue owes nothing further from. Named beside the park kind that reaches one
   of them, because both readers of the pair ask the same question of it: the plan scope a tree no
   longer holds, and the escapes whose promise ended when the owing did (ISS-2111). */
export const NO_LONGER_OWES = ["closed", "dropped"];

/* One landing is one status, now that core holds no second name for any of them. */
export const sameLanding = (one, other) => one === other;

export const onNeedsInfo = (status) => sameLanding(status, NEEDS_INFO);
