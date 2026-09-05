---
name: vi-natural
description: Use whenever Vietnamese text has to be produced or judged — translating an i18n locale file (en.json → vi.json), localizing UI strings, writing or translating Vietnamese documentation and README files, adding a vi locale to a project, or reviewing existing tiếng Việt that reads like machine translation. Triggers on Vietnamese, tiếng Việt, vi.json, vi-VN, locale, i18n, l10n, dịch, bản địa hóa, "translate to Vietnamese". Provides the `vi-natural` CLI.
version: 1.7.0
---

## Rules

- Do not write the Vietnamese yourself. Every string goes through `vi-natural`, whose style
  contract and placeholder check a hand edit gets none of. A frontmatter title is no exception, and
  Vietnamese you wrote earlier in the session goes through `vi-natural review`.
- `vi-natural -h` and `vi-natural <verb> -h` own the flags. Nothing about them is repeated here.
- The voice is the project's, pinned once in `.vi-glossary.json`, never chosen per command. The
  default register is `san-pham`.
- Exit `2` means the file was written and some strings were refused. Read the refused keys out to
  the user; do not patch them by hand.
- Source text is English; a source that is not is the project's decision to state.

## Route

| you want | run |
|---|---|
| is the gateway set up | `vi-natural doctor`; anything MISSING: `forge guide vi-natural setup` |
| a locale file, missing keys only | `vi-natural i18n locales/en.json` |
| an offline audit, no API call | `vi-natural i18n locales/en.json --check`; reading the report: `forge guide vi-natural checks` |
| a Markdown document | `vi-natural doc README.md` |
| one string, or stdin | `vi-natural translate "..."`, with `--kind doc` or `--kind prose` |
| review Vietnamese that already exists | `vi-natural review <file>`, `--fix` for JSON |
| another voice, region or the project's own terms | `forge guide vi-natural voice` |
| a string that will not translate | `forge guide vi-natural checks` |
