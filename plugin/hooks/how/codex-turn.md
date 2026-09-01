# codex-turn — the documents a turn changed, listed for one reading at the end

Why: a per-write review sees a paragraph and cannot know whether the paragraph was the plan. A reading
at the end of the turn sees the turn.

How to answer it: consult once, with an intent saying what you were trying to do. Leave out what
changed — the diff carries that.

It asks on the first document of a turn and records the rest silently, so the reminder does not come
back later in the turn. Nothing here forces a consult; `FORGE_CODEX_DISABLE=1` silences it.

Not judged: code, and the end of a turn — no turn is ever stopped for this.
