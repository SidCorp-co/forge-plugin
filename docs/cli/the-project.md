# the project

The verb printed a uuid for six releases. What it withheld was measured, 2026-09-04: a run in
another project reached Phase 7 with eight rendered-state criteria it could not judge, because the
account it needed to sign in with sat in a field the tracker exposes and no verb named. It fell back
to routing evidence. The credential was one call away the whole time, under a key the flow's own
vocabulary does not use — so the cost was not access, it was a name an agent had to translate, and a
name an agent has to translate is a round.

**Being a URL is not being safe to print.** What is a host and what is a secret is decided by the
shape of the value and never by a list of field names, because that schema grows and a rule printing
everything not *named* as a secret prints tomorrow's secret by default. The inverse can only ever
withhold something nobody recognised, which costs a `forge call`; the other direction costs a leak.
Two versions of this got it wrong before the rule was stated that way, each caught by a review and
each verified before it was changed:

- A string sitting beside a host became that host's label — which reads sensible until
  `testCredentials` holds a login URL, the tracker's own documented shape, and the password beside it
  prints unasked *and* is classified as a label rather than a secret, so nothing guards it either.
- A host went out verbatim, so a password in a URL's user-info and a signed token in its query did
  the same. A host is now trimmed to origin and path wherever any of those rides on it, and the whole
  value stays a credential candidate.

Trimming rather than withholding is what keeps the refusal escapable: the printed form is what a
verdict cites, so the payload passes, and `--credentials` answers for the rest. **And the trim stops
at the path deliberately.** User-info, a query and a fragment are riders — a token conventionally
lives in one of them and none of them says where a thing is. A path is part of an address, and so is
a hostname, so trimming past the path has no stopping point short of printing nothing, which is the
round this verb exists to remove. A secret placed inside a path or a hostname is indistinguishable
from an address and prints.

## What the guard covers, and the edge it states

*Where does a credential stop being this CLI's problem?*

One seat rather than a list of the payload kinds that may carry a secret, because that list goes
stale the next time a verb learns to write: the guard sits at the write boundary, so every payload
with a `data` object passes it. The attachment holds the second seat on its own — bytes go to a
presigned URL and never reach the boundary — and they are judged before the upload slot is minted,
since there is no delete for an upload.

**The guarantee has a stated edge, and the edge is the point.** A value long enough to be a secret is
refused wherever a payload holds it. A shorter one is refused only where a field *is* it, quoting and
surrounding punctuation aside. A credential field plausibly holds a word like `admin`, and the only
mechanism that would catch that word inside a sentence is one that refuses every payload containing
it — a gate no developer gets past, which is a defect rather than strictness. A review pressed twice
for the wider guarantee; what was wrong was the width of the claim, not the mechanism, so the claim
narrowed. A project whose credential is five characters is the project's to fix.

The read behind all of it is soft and memoised: one call per process that writes, and a read that
fails lets the write through. A payload refused because of a read this CLI could not make would be a
refusal with no route out.

## Why the vocabulary has a checker

*What stops the tracker's names leaking back in?*

Because they leaked once already, and a name in a printed string is invisible to every other gate.
`plugin/src/checks/tracker-names.mjs` refuses either of the tracker's two column names inside a
string literal under `plugin/src` or `plugin/hooks`. It states them as patterns and its own reader
reaches them by property access, so neither the rule nor the code it guards is a quoted span and no
exemption is needed — an exemption list is where a rule like this goes to die. `forge schema` and
`forge call` are outside it on purpose: they pass the server's own text and JSON through, and masking
the tracker's words in the tracker's own answer would be a different and worse thing.
