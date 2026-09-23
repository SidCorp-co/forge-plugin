# the credential guard, and the edge it states

*Where does a credential stop being this CLI's problem?*

One seat rather than a list of the payload kinds that may carry a secret, because that list goes
stale the next time a verb learns to write: the guard sits at the transport's own write boundary,
so every payload with a `data` object passes it. The attachment holds the second seat on its own —
bytes ride beside the payload and never reach the boundary — and every file of a write is judged before the first
request of it goes, since there is no delete for an upload.

**The guarantee has a stated edge, and the edge is the point.** A value long enough to be a secret is
refused wherever a payload holds it. A shorter one is refused only where a field *is* it, quoting and
surrounding punctuation aside. A credential field plausibly holds a word like `admin`, and the only
mechanism that would catch that word inside a sentence is one that refuses every payload containing
it — a gate no developer gets past, which is a defect rather than strictness. A review pressed twice
for the wider guarantee; the width of the claim was wrong, not the mechanism, so the claim narrowed. A project whose credential is five characters is the project's to fix.

**A display name is not guarded, and it is let through by its key.** A project labels a login with
the role it signs in as, so the label is the product's own vocabulary: guarding it made every verdict
naming that role unpostable, and the refusal read as a leaked password (ISS-172). Naming a key here
does not reverse the shape rule [the test credentials](test-credentials.md) states, because it sits
on the other side of it: that rule refuses a list of *secrets*, which prints tomorrow's key by
default, while this names one *non-secret*, so a key nobody recognised stays guarded. And the key
alone does not decide: an address under it — any scheme, in any case — is guarded, so a URL carrying
user-info, a query or a fragment is guarded whatever it is filed under. The report still withholds the label —
what is printed is that document's rule, not this one's.

**A refusal says where in the author's own words the hit sits**, every guarded value in that text
masked before the text is cut, so a false positive is recognisable from the refusal itself and the
secret a true one found is not printed by the message about it.

The read behind all of it is soft and memoised, and **a reading that did not answer stops the
write**: there is no delete for what the tracker has taken and a held write costs a retry. ISS-487's
route out of the refusal is the reading's own reason, in the message. Which values are credentials at
all, and why the shape of the value decides rather than a list of names:
[the test credentials](test-credentials.md).
