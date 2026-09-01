# codex-turn — the review that knows what you were trying to do

The gates beside it judge a write against a rule. This one judges nothing: it records which
documents a turn changed and asks for a second model to read them at the end, with the intent
attached. Splitting it that way is the point — a per-write review sees a paragraph and cannot know
whether the paragraph was the plan; a review at the end of the turn sees the turn.

**It asks once, then it insists.** The first document of a turn carries the instruction and the rest
are recorded silently, because an instruction repeated on every write is an instruction that gets
ignored. `afterTouch` in `plugin/src/codex.mjs` therefore answers `added` and `first` separately.

**There is no Stop half.** One was tried twice — printing into a channel nobody reads, then blocking
the ending. Blocking worked, and the first turn it caught had only edited these documents, which is
not what anyone wants a turn stopped for. So the asking ends at PostToolUse: it is context, the agent
can ignore it, and nothing here forces a consult. `forge codex pending` lists what a turn left unread.

The logic lives in `src/codex.mjs` rather than the hook, so `forge codex` and the hook cannot drift
on what counts as a document or where the turn is written down. The turn is keyed by canonical git
root: one state file serves every checkout on this machine, and its paths are repo-relative.
`FORGE_CODEX_DISABLE=1` silences it.
