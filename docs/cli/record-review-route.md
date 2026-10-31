# `record review --head`

**A criterion routed to the review had no verb.** Core routes a criterion the design classes a code
property to the review, judged against the diff, and refuses a verdict on it
(`VERDICT_JUDGED_BY_REVIEW`). What records it is core's review of the issue, `POST
/api/issues/:id/review`, and nothing in this CLI made that call, so the owed line could only name the
raw route.

**`forge record review <ISS> --base <sha> --head <sha>` makes it.** The body is the route's schema
(`@forge/contracts/issue-review:recordReviewRequestSchema`): the diff `base..head`, then, in the order
typed, entries that each open on a flag and take the flags after it —

- `--criterion N --result pass|fail --reason R --evidence E...`, a criterion core routes to the
  review, citing what it was judged from (a path at `head`, a URL or an attachment name);
- `--line <pattern>:<n> --result pass|fail|not_applicable --note N`, a checklist line of a pattern
  the issue's design chose;

and `--run`, `--started-at` where the call needs them. Every bound the schema holds — whole shas, the
result words, a note or reason of 1 to 400 code points, 1 to 10 citations, 200 entries a list — is
refused before anything is sent, naming the flag. Core's own refusals (`REVIEW_BY_BUILDER`,
`REVIEW_LINE_MISSING`, …) are printed whole.

**`--head` selects the form.** Without it, `record review` is the thread's code-review record
(`--reviewer --commit --outcome --finding`), a different payload the ladder reads, so the name keeps
both and the flag the route cannot do without decides which is meant.
