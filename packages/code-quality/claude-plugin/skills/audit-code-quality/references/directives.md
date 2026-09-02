# What each directive asks for

The gate prints one directive per rule that fired. This is what each one means in practice.

- `max-lines` — split by responsibility, never at the line count. Backend: a folder per feature (routes, service, repository). Frontend: `components/`, `hooks/`, `lib/`. Move whole exports and re-export them from the original path so importers keep working.
- `max-lines-per-function` — extract each independently testable step into a named function; split the file only if it then exceeds `max-lines`.
- crowded directory — the same backend/frontend shape, applied to whole files. Split by responsibility, never alphabetically, and update the importers.
- `comment-density` and `max-consecutive-comment-lines` — the report points at the densest block, not the file. Quote it; it is usually a few narrated runs rather than uniform noise.
- `no-historical-narration` — the message quotes the phrase that matched. Replace it with the current constraint if that constraint is real; otherwise the comment goes.
- inline error on a form control — wire the error into the control, or spread unknown props so a field wrapper can. Fixing is the default; the waiver rule in SKILL.md step 7 is the only alternative.
