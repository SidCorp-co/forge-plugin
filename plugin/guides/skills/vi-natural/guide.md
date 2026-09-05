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

If that reports anything MISSING, or the first call refuses, the gateway is not set
up on this machine: `forge guide vi-natural setup`.

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
which keys are missing, which translations have damaged placeholders, and which
labels drifted. What it reports and what to do about each: `forge guide vi-natural checks`.

## Documentation

```bash
vi-natural doc README.md                # → README.vi.md
vi-natural doc docs/guide.md -o docs/vi/guide.md
```

Fenced code, frontmatter, inline code spans, link targets and blank-line structure
pass through untouched; only prose is translated. YAML frontmatter *values* are not
translated: a title that needs Vietnamese goes through `vi-natural translate` and
the output is pasted in, because the rule at the top of this file has no exception
for a short string.

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

## Voice is pinned per project, not per command

Getting the pronoun pair wrong is the single most visible localization mistake in
Vietnamese — `bạn` in an invoice reads careless, `quý khách` in a dev tool reads
stiff. Default `san-pham` is right for almost every app; a project that needs
another voice, or that has product terms of its own, pins both in one file:
`forge guide vi-natural voice`. Mention that file to the user when a term keeps coming out
inconsistently.

## Exit codes

`0` clean · `1` error, or `review` found something · `2` the file was written but
some strings were refused. On `2`, the refused keys are printed with their reason
and left in English — read them out to the user rather than patching the file with
hand-written Vietnamese.

## Reference material

| file | when |
| ---- | ---- |
| `forge guide vi-natural setup` | `doctor` reports MISSING, or a call refuses on configuration |
| `forge guide vi-natural voice` | a project needs a register, a region, or its own vocabulary |
| `forge guide vi-natural checks` | reading a `--check` report, or a string that will not translate |
