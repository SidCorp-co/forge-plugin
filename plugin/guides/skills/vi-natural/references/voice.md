# Voice, region and the project's own vocabulary

Read this when a project needs a voice other than the default, or when a term keeps coming out
inconsistently.

## One flag, three voices

```bash
vi-natural i18n locales/en.json --register trang-trong   # quý khách: commerce, invoices, legal, transactional email
vi-natural i18n locales/en.json --register than-mat      # warm: marketing, onboarding
vi-natural translate --region nam "Yes, your order is confirmed"   # southern vocabulary
```

## Pinning both, and the terms with them

Drop a `.vi-glossary.json` anywhere above the working directory and every command picks it up:

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

`null` means "leave this word in English". The underscore keys pin the project's voice so nobody has
to remember the flag, which is what makes this a per-project decision rather than a per-command one.
Glossary entries outrank the built-in style rules — this is how a project pins its own product
vocabulary.
