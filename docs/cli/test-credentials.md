# the test credentials a project holds

The report printed a uuid for six releases. What it withheld was measured, 2026-09-04: a run in
another project reached Phase 7 with eight rendered-state criteria it could not judge, because the
account it needed to sign in with sat in a field the tracker exposes and no verb named. It fell back
to routing evidence. The credential was one call away the whole time, under a key the flow's own
vocabulary does not use — so the cost was not access, it was a name an agent had to translate, and a
name an agent has to translate is a round.

**Being a URL is not being safe to print.** What is a host and what is a secret is decided by the
shape of the value and never by a list of field names, because that schema grows and a rule printing
everything not *named* as a secret prints tomorrow's secret by default. The inverse can only ever
withhold something nobody recognised, which costs one more round trip; the other costs a leak.
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
round this reading exists to remove. A secret placed inside a path or a hostname is indistinguishable
from an address and prints.

The guard that keeps a value classified here out of every payload the CLI sends, and the edge it
states rather than claims: [one transport](one-transport.md).
