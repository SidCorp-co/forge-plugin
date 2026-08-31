---
name: vi-natural
description: Use whenever Vietnamese text has to be produced or judged — translating an i18n locale file (en.json → vi.json), localizing UI strings, writing or translating Vietnamese documentation and README files, adding a vi locale to a project, or reviewing existing tiếng Việt that reads like machine translation. Triggers on Vietnamese, tiếng Việt, vi.json, vi-VN, locale, i18n, l10n, dịch, bản địa hóa, "translate to Vietnamese". Provides the `vi-natural` CLI.
version: 1.5.0
---

# vi-natural

Do not write the Vietnamese yourself. Route it through `vi-natural`.

The CLI carries a written Vietnamese style contract — xưng hô, UI verb forms, the
list of calques to avoid, which technical terms stay in English — and it verifies
every placeholder before a string is allowed into a file. Vietnamese typed straight
into an edit gets none of that, and its failure mode is invisible to a reviewer who
does not read Vietnamese: it parses fine, it just reads like it was translated.

```bash
vi-natural doctor          # config, gateway reachability, one live round trip
```

## Locale files

```bash
vi-natural i18n locales/en.json                     # → locales/vi.json, missing keys only
vi-natural i18n locales/en.json -o locales/vi-VN.json
vi-natural i18n locales/en.json --overwrite         # retranslate everything
vi-natural i18n locales/en.json --keys billing,common.save
vi-natural i18n locales/en.json --dry-run           # list what would be sent
vi-natural i18n locales/en.json --check             # offline audit, no API calls
vi-natural i18n locales/en.json --prune             # also drop keys the source dropped
```

Default is incremental: a key already translated in the target is left alone, so
running it again after adding three English strings costs three strings. The target
comes out in the source's key order, with nested objects and arrays intact.

`--check` is free and offline — use it in CI or before touching anything, to see
which keys are missing and which translations have damaged placeholders.

`--check` also audits call-to-action discipline, free and offline. Two findings:
**inflated** — the English is a bare CTA (`Remove`) and the Vietnamese grew an object
(`Xoá tỷ giá`), so a reusable button became a one-screen button; and **collapse** —
N keys all say `Tạo <object>` where one shared `common.create` = `Tạo` would serve.
Both are reported, neither fails the check: a verbose label is a style call, not a bug.

Translation enforces the same rule going forward. When the English source is a bare
CTA, a translation that adds an object is retried once and then refused, so `Save`
never lands as `Lưu khách hàng`. One `Lưu` works on every form; a per-entity label
needs its own key and drifts from its siblings the first time someone edits one.

A string that talks *about* brace syntax ("A `{` is never closed by a `}`") parses as
an interpolation and gets refused. Exempt those keys rather than hand-editing around
them: `--ignore 'codePatterns.*'`, or `"_ignore": ["codePatterns.*"]` in the glossary.

## Documentation

```bash
vi-natural doc README.md                # → README.vi.md
vi-natural doc docs/guide.md -o docs/vi/guide.md
```

Fenced code, frontmatter, inline code spans, link targets and blank-line structure
pass through untouched; only prose is translated. YAML frontmatter *values* are not
translated — edit a title by hand if it needs one.

## Loose strings

```bash
vi-natural translate "Delete this item permanently?"        # UI tone (default)
vi-natural translate --kind doc "..." # documentation tone
cat notes.txt | vi-natural translate --kind prose
git log -1 --format=%s | vi-natural translate
```

## Reviewing Vietnamese that already exists

```bash
vi-natural review locales/vi.json          # flags translationese, suggests rewrites
vi-natural review locales/vi.json --fix    # applies them (JSON only, placeholder-checked)
vi-natural review docs/guide.vi.md --json
```

Run this on any Vietnamese file that was written without this tool — including
Vietnamese you wrote earlier in the session.

## Voice

One flag, three voices. Default `san-pham` is right for almost every app.

```bash
vi-natural i18n locales/en.json --register trang-trong   # quý khách: commerce, invoices, legal, transactional email
vi-natural i18n locales/en.json --register than-mat      # warm: marketing, onboarding
vi-natural translate --region nam "Yes, your order is confirmed"   # southern vocabulary
```

Getting the pronoun pair wrong is the single most visible localization mistake in
Vietnamese — `bạn` in an invoice reads careless, `quý khách` in a dev tool reads
stiff. Pick once per project and pin it (below) rather than per command.

## Project terminology

Drop a `.vi-glossary.json` anywhere above the working directory and every command
picks it up:

```json
{
  "_register": "trang-trong",
  "_region": "nam",
  "_ignore": ["codePatterns.*"],
  "workspace": null,
  "repository": "kho mã",
  "Billing": "Thanh toán"
}
```

`null` means "leave this word in English". The underscore keys pin the project's
voice so nobody has to remember the flag. Glossary entries outrank the built-in
style rules — this is how a project pins its own product vocabulary. Mention the
glossary to the user when a term keeps coming out inconsistently.

## Exit codes

`0` clean · `1` error, or `review` found something · `2` the file was written but
some strings were refused. On `2`, the refused keys are printed with their reason
and left in English — read them out to the user rather than patching the file with
hand-written Vietnamese.

## Configuration

Key and defaults live in `~/.config/vi-natural/config.json` (chmod 600), or in
`MUSETOOLS_API_KEY` / `VI_NATURAL_MODEL` / `VI_NATURAL_BASE_URL` /
`VI_NATURAL_REGISTER`. Precedence: flag → env → `.vi-glossary.json` → config file.

```bash
vi-natural login --base-url <url> --key <key> --model <id> --register san-pham
vi-natural models                            # what the gateway offers
vi-natural i18n en.json --model gm/gemini-3.1-pro-preview   # per-run override
```

Gateway, key and model are required and have no default — a host and a model id
belong to whoever runs the gateway. `review` runs at `--effort high` — judging
whether a sentence is ambiguous is what reasoning is for — and the producing verbs
run at `low`, where they follow the style contract instead of arguing with it.
`--effort` overrides either way.
