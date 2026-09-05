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

## A string about brace syntax

A string that talks *about* brace syntax ("A `{` is never closed by a `}`") parses as
an interpolation and gets refused. Exempt those keys rather than hand-editing around
them: `--ignore 'codePatterns.*'`, or `"_ignore": ["codePatterns.*"]` in the glossary.
