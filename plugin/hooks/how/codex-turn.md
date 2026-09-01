# codex-turn — the documents a turn changed, listed for one reading at the end

Why: a per-write review sees a paragraph and cannot know whether the paragraph was the plan. A reading
at the end of the turn sees the turn, with the intent attached.

How to answer it: consult once, with an intent that says what you were trying to do. Leave out what
changed — the diff carries that, and repeating it in prose is the payload paid for twice.

It asks on the first document of a turn and records the rest silently, because an instruction repeated
on every write is one that gets ignored. So an unanswered reminder does not come back later in the
turn.

Nothing here forces a consult: this is context, and ignoring it is allowed. `FORGE_CODEX_DISABLE=1`
silences it.

**Not judged:** code, and the end of a turn. A `Stop` half was tried twice — printing into a channel
nobody reads, then blocking the ending — and the first turn blocking caught had only edited these
documents, which is not what anyone wants a turn stopped for. It was removed on sight, so no turn is
ever stopped for this.
