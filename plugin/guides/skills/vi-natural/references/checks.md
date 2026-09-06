# Reading a `--check` report, and the string that will not translate

Read this when `--check` reports something, or when a key is refused.

## Call-to-action findings

`--check` audits call-to-action discipline, free and offline. Two findings:
**inflated** — the English is a bare CTA (`Remove`) and the Vietnamese grew an object
(`Xoá tỷ giá`), so a reusable button became a one-screen button; and **collapse** —
N keys all say `Tạo <object>` where one shared `common.create` = `Tạo` would serve.
Both are reported, neither fails the check: a verbose label is a style call, not a bug.

Translation enforces the same rule going forward. When the English source is a bare
CTA, a translation that adds an object is retried once and then refused, so `Save`
never lands as `Lưu khách hàng`. One `Lưu` works on every form; a per-entity label
needs its own key and drifts from its siblings the first time someone edits one.

## A string that came back as it went in

`translate` exits `3` when the gateway returned the string exactly as it was sent,
and names that string on stderr. Stdout still carries it: handing it back is the
right answer for a command, an identifier, or a word that is the same in both
languages. What the code is worth is telling that answer from a translation. Read
it out to the user and do not pass the string on as translated — a caller that
pushes whatever it got back pushes the English on, and nobody sees it.

## A string about brace syntax

A string that talks *about* brace syntax ("A `{` is never closed by a `}`") parses as
an interpolation and gets refused. Exempt those keys rather than hand-editing around
them: `--ignore 'codePatterns.*'`, or `"_ignore": ["codePatterns.*"]` in the glossary.
