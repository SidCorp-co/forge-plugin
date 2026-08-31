# codex-turn — the review that knows what you were trying to do

The gates beside it judge a write against a rule. This one judges nothing: it records which
documents a turn changed and asks for a second model to read them at the end, with the intent
attached. Splitting it that way is the point — a per-write review sees a paragraph and cannot know
whether the paragraph was the plan; a review at the end of the turn sees the turn.

**It asks once, then it insists.** The first document of a turn carries the instruction and the rest
are recorded silently, because an instruction repeated on every write is an instruction that gets
ignored. `afterTouch` in `plugin/src/codex.mjs` therefore answers `added` and `first` separately.

**There is no Stop half.** One existed briefly, twice: first printing the reminder into a channel
nobody reads, then refusing the ending with `{"decision": "block"}`. The refusal worked — and the
first turn it caught was one that had only edited the hooks' own documentation, which is not what anyone wanted a
turn stopped for. The user removed it on sight. So the asking ends at PostToolUse: it is context, the
agent can ignore it, and nothing here forces a consult. `forge codex pending` still lists what a turn
left unread, for whoever wants to look.

The logic lives in `src/codex.mjs` rather than the hook, so `forge codex` and the hook cannot drift
on what counts as a document or where the turn is written down. The turn is keyed by canonical git
root: one state file serves every checkout on this machine, and its paths are repo-relative.
`FORGE_CODEX_DISABLE=1` silences it. There was a second switch, `FORGE_CODEX_INSIDE=1`, set on the
detached child a background consult used to spawn; a consult now runs inline, so nothing sets it and
it is gone.
