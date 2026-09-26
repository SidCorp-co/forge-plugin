# ask-precedent — the owner's answer, kept as precedent

Why: the ask-decide gate decides only from what the owner has already answered, so every answer the
owner gives in a project that opted in is added to that project's precedent layer the moment it is
given, rather than waiting for a transcript to be read.

What it keeps: each question of the call with the owner's answer, their own words where they wrote
some, and whether the answer took the session's recommendation.

What it never keeps: a question the ask-decide gate answered itself, since a layer that learned from
its own decisions would only ever agree with itself. A project with `asks.mode` unset or `off` keeps
nothing at all.

Nothing to clear: this gate refuses nothing and says nothing.

Not judged: whether the owner's answer was a good one. It is kept as given.
