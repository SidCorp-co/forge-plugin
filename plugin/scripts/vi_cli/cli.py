"""Argument parsing and command dispatch for `vi-natural`."""

import argparse
import fnmatch
import json
import os
import sys

from . import config as config_mod
from . import doc as doc_mod
from . import cta, engine, locale, placeholders, prompts
from .client import Client
from .util import CliError, chunk_items, err, parse_json_object, read_json, write_json

VERSION = "1.5.0"


def build_parser():
    parser = argparse.ArgumentParser(
        prog="vi-natural",
        description="Natural Vietnamese for i18n files and docs, via an OpenAI-compatible gateway.",
    )
    parser.add_argument("--version", action="version", version=VERSION)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--model",
                        help="model id (default %s)" % config_mod.DEFAULT_MODEL)
    common.add_argument("--effort", choices=config_mod.EFFORTS,
                        help="reasoning effort (default %s, %s for review)"
                             % (config_mod.DEFAULT_EFFORT,
                                config_mod.EFFORT_BY_VERB["review"]))
    common.add_argument("--base-url", dest="base_url", help="gateway base url")
    common.add_argument("--temperature", type=float, default=0.3)
    common.add_argument("--register", choices=["san-pham", "trang-trong", "than-mat"],
                        help="voice: san-pham = product default, trang-trong = formal "
                             "commerce/legal, than-mat = warm marketing")
    common.add_argument("--region", choices=["bac", "nam"],
                        help="regional vocabulary: bac = northern, nam = southern")
    common.add_argument("--glossary", help="path to a term glossary JSON")
    common.add_argument("--ignore",
                        help="comma-separated key globs to exempt from the placeholder "
                             "check (also settable as _ignore in .vi-glossary.json)")
    common.add_argument("--no-glossary", action="store_true",
                        help="ignore .vi-glossary.json even if one is found")
    common.add_argument("-v", "--verbose", action="store_true")

    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("translate", parents=[common], help="translate text to natural Vietnamese")
    p.add_argument("text", nargs="*", help="text to translate; omit to read stdin")
    p.add_argument("-f", "--file", help="read the text from a file")
    p.add_argument("--kind", choices=["ui", "doc", "prose"], default="ui",
                   help="ui = interface strings (default), doc = documentation prose")

    p = sub.add_parser("i18n", parents=[common], help="translate a locale JSON file")
    p.add_argument("source", help="source locale file, e.g. locales/en.json")
    p.add_argument("-o", "--out", help="target file (default: sibling vi.json)")
    p.add_argument("--overwrite", action="store_true",
                   help="retranslate every string, not just the missing ones")
    p.add_argument("--keys", help="comma-separated key paths to translate")
    p.add_argument("--prune", action="store_true", help="drop target keys the source no longer has")
    p.add_argument("--check", action="store_true",
                   help="no API calls: report missing keys and placeholder damage")
    p.add_argument("--dry-run", action="store_true", help="show what would be translated")

    p = sub.add_parser("doc", parents=[common], help="translate a Markdown document")
    p.add_argument("source", help="source Markdown file")
    p.add_argument("-o", "--out", help="target file (default: <name>.vi.md)")
    p.add_argument("--dry-run", action="store_true", help="show what would be translated")

    p = sub.add_parser("review", parents=[common],
                       help="flag translationese in an existing Vietnamese file")
    p.add_argument("source", help="Vietnamese .json or .md file to review")
    p.add_argument("--json", dest="as_json", action="store_true", help="machine-readable output")
    p.add_argument("--fix", action="store_true",
                   help="apply the suggested rewrites (JSON locale files only)")

    p = sub.add_parser("login", help="store the gateway key and defaults (chmod 600)")
    p.add_argument("--key", help="API key")
    p.add_argument("--base-url", dest="base_url")
    p.add_argument("--model")
    p.add_argument("--effort", choices=config_mod.EFFORTS)
    p.add_argument("--register", choices=["san-pham", "trang-trong", "than-mat"])
    p.add_argument("--region", choices=["bac", "nam"])

    sub.add_parser("models", parents=[common], help="list models the gateway offers")
    sub.add_parser("doctor", parents=[common], help="check config, reachability and one round trip")
    return parser


def make_client(args):
    opts = {
        "model": getattr(args, "model", None),
        "base_url": getattr(args, "base_url", None),
        "effort": getattr(args, "effort", None),
        # Which verb is running decides how hard the model should think when
        # nothing overrides it: see EFFORT_BY_VERB.
        "verb": getattr(args, "command", None),
        "glossary": getattr(args, "glossary", None),
        "no_glossary": getattr(args, "no_glossary", False),
        "ignore": getattr(args, "ignore", None),
        "register": getattr(args, "register", None),
        "region": getattr(args, "region", None),
    }
    cfg = config_mod.Config(opts)
    return cfg, Client(cfg, verbose=getattr(args, "verbose", False))


def cmd_translate(args):
    if args.file:
        with open(args.file, encoding="utf-8") as handle:
            text = handle.read()
    elif args.text:
        text = " ".join(args.text)
    else:
        text = sys.stdin.read()
    text = text.strip()
    if not text:
        raise CliError("nothing to translate")

    cfg, client = make_client(args)
    kind = args.kind if args.kind != "prose" else None
    glossary = cfg.glossary()
    results, problems = engine.translate_items(
        client, [("1", text)], kind=kind, glossary=glossary,
        temperature=args.temperature, verbose=args.verbose,
        register=cfg.register(), region=cfg.region(),
    )
    if problems:
        for problem in problems:
            err("! " + problem.reason)
        return 1
    print(results["1"])
    if args.verbose:
        err(client.usage_note())
    return 0


def default_locale_target(source):
    directory, name = os.path.split(source)
    stem, ext = os.path.splitext(name)
    for pattern, replacement in (("en", "vi"), ("en-US", "vi-VN"), ("en_US", "vi_VN")):
        if stem == pattern:
            return os.path.join(directory, "vi" + ext)
        if stem.startswith(pattern + "."):
            return os.path.join(directory, stem.replace(pattern, replacement, 1) + ext)
    if os.sep + "en" + os.sep in source:
        return source.replace(os.sep + "en" + os.sep, os.sep + "vi" + os.sep, 1)
    return os.path.join(directory, stem + ".vi" + ext)


def reorder(source, target):
    """Give the target the source's key order; keep anything extra at the end."""
    if isinstance(source, dict) and isinstance(target, dict):
        out = {}
        for key, value in source.items():
            if key in target:
                out[key] = reorder(value, target[key])
        for key, value in target.items():
            if key not in out:
                out[key] = value
        return out
    return target


def cmd_i18n(args):
    source = locale.load_tree(args.source, read_json(args.source))
    if source is None:
        raise CliError("cannot read %s" % args.source)
    out_path = args.out or default_locale_target(args.source)
    target = read_json(out_path, {}) or {}

    if args.check:
        cfg = config_mod.Config({"glossary": args.glossary,
                                 "no_glossary": args.no_glossary,
                                 "ignore": args.ignore})
        cfg.glossary()
        return check_locale(source, target, args.source, out_path, cfg.ignore_patterns())

    keys = [k.strip() for k in args.keys.split(",")] if args.keys else None
    todo = locale.pending(source, target, overwrite=args.overwrite, keys=keys)
    if not todo:
        print("%s is already complete (%d strings)." % (out_path, len(locale.flatten(source))))
        return 0

    if args.dry_run:
        print("%d string(s) would be translated into %s:" % (len(todo), out_path))
        for path, text in todo[:40]:
            print("  %s = %s" % (locale.label(path), text))
        if len(todo) > 40:
            print("  ... and %d more" % (len(todo) - 40))
        return 0

    cfg, client = make_client(args)
    ids = {str(index): path for index, (path, _) in enumerate(todo)}
    items = [(str(index), text) for index, (_, text) in enumerate(todo)]
    contexts = {str(index): locale.label(path) for index, (path, _) in enumerate(todo)}
    glossary = cfg.glossary()
    ignore = cfg.ignore_patterns()
    ignored = {index for index, name in contexts.items() if matches_any(name, ignore)}
    bare = bare_cta_keys(todo, contexts, ignore)
    cta_index = cta.generic_index(cta_pairs(source, target))
    err("translating %d string(s) with %s (%s)" % (len(items), cfg.model, cfg.register()))
    results, problems = engine.translate_items(
        client, items, kind="ui", glossary=glossary,
        temperature=args.temperature, verbose=args.verbose,
        register=cfg.register(), region=cfg.region(), contexts=contexts,
        skip_verify=ignored, bare_cta=bare, cta_index=cta_index,
    )

    translations = {ids[index]: text for index, text in results.items()}
    merged = locale.merge(target, translations)
    if args.prune:
        merged = locale.prune(merged, source)
    merged = reorder(source, merged)
    write_json(out_path, merged)

    print("%s: %d translated, %d skipped (%s)"
          % (out_path, len(translations), len(problems), client.usage_note()))
    if problems:
        err("\nleft untranslated — fix by hand or rerun:")
        for problem in problems:
            err(problem_line(problem, ids))
        return 2
    return 0


def problem_line(problem, ids):
    key = locale.label(ids[problem.key]) if problem.key in ids else problem.key
    return "  %s: %s\n      source: %s" % (key, problem.reason, problem.source)


def matches_any(name, patterns):
    return any(fnmatch.fnmatch(name, pattern) for pattern in patterns)


def check_locale(source, target, source_path, target_path, ignore=()):
    """Offline audit: what is missing, and what has broken placeholders."""
    missing, damaged, skipped = [], [], 0
    for path, text in locale.flatten(source):
        existing = locale.get_path(target, path)
        if not isinstance(existing, str) or not existing.strip():
            missing.append(locale.label(path))
            continue
        if matches_any(locale.label(path), ignore):
            skipped += 1
            continue
        problem = placeholders.diff(text, existing)
        if problem:
            damaged.append((locale.label(path), problem, text, existing))
    extra = [locale.label(path) for path, _ in locale.flatten(target)
             if locale.get_path(source, path) is None]

    pairs = cta_pairs(source, target)
    index = cta.generic_index(pairs)
    inflated = [f for f in cta.inflated(pairs, index) if not matches_any(f["key"], ignore)]
    groups = cta.collapse_groups(pairs, index)

    total = len(locale.flatten(source))
    print("%s vs %s: %d source strings, %d missing, %d with placeholder damage, %d stale%s"
          % (source_path, target_path, total, len(missing), len(damaged), len(extra),
             ", %d ignored" % skipped if skipped else ""))
    for name in missing[:50]:
        print("  missing: %s" % name)
    for name, problem, want, got in damaged:
        print("  damaged: %s — %s\n      en: %s\n      vi: %s" % (name, problem, want, got))
    for name in extra[:50]:
        print("  stale:   %s" % name)
    report_cta(inflated, groups, index)
    return 1 if (missing or damaged) else 0


def cta_pairs(source, target):
    """(key label, english, vietnamese) for every string that has both sides."""
    pairs = []
    for path, text in locale.flatten(source):
        existing = locale.get_path(target, path)
        if isinstance(existing, str) and existing.strip():
            pairs.append((locale.label(path), text, existing))
    return pairs


def report_cta(inflated, groups, index):
    """Style findings: reported, never a failure. A verbose button is not a bug."""
    if not inflated and not groups:
        return
    print("\ncall-to-action: %d inflated label(s), %d verb group(s) a shared key would cover"
          % (len(inflated), len(groups)))
    for finding in inflated:
        owner = " — %s already says it" % finding["existing"] if finding["existing"] else ""
        print("  inflated: %s\n      en: %s\n      vi: %s → %s%s"
              % (finding["key"], finding["en"], finding["vi"], finding["suggested"], owner))
    for group in groups:
        owner = group["existing"] or "no generic key yet"
        print("  collapse: %d keys say \"%s <object>\" — %s"
              % (len(group["members"]), group["bare"], owner))
        for member in group["members"][:4]:
            print("      %-44s %s" % (member["key"], member["vi"]))
        if len(group["members"]) > 4:
            print("      … and %d more" % (len(group["members"]) - 4))


def bare_cta_keys(todo, contexts, ignore):
    """Ids whose English source is a bare CTA, so the translation must be one too."""
    keys = set()
    for index, (_, text) in enumerate(todo):
        name = contexts[str(index)]
        if matches_any(name, ignore) or not cta.is_action_key(name):
            continue
        if cta.normalize(text) in cta.GENERIC:
            keys.add(str(index))
    return keys


def cmd_doc(args):
    with open(args.source, encoding="utf-8") as handle:
        original = handle.read()
    pieces = doc_mod.segment(original)
    trails = doc_mod.heading_trails(pieces, root=os.path.basename(args.source))
    slots = []
    items, index_map, contexts = [], {}, {}
    for index, (kind, block) in enumerate(pieces):
        if kind != "text":
            continue
        key = str(len(items))
        index_map[key] = index
        # Where the block sits, so a paragraph is not translated out of its section.
        contexts[key] = trails.get(index, "")
        items.append((key, doc_mod.protect_inline(block, slots)))

    if not items:
        raise CliError("no translatable prose found in %s" % args.source)

    stem, ext = os.path.splitext(args.source)
    out_path = args.out or stem + ".vi" + (ext or ".md")

    if args.dry_run:
        print("%d block(s) would be translated into %s" % (len(items), out_path))
        for _, block in items[:10]:
            print("  ---\n  " + block.replace("\n", "\n  "))
        return 0

    cfg, client = make_client(args)
    glossary = cfg.glossary()
    err("translating %d block(s) with %s (%s)" % (len(items), cfg.model, cfg.register()))
    results, problems = engine.translate_items(
        client, items, kind="doc", task=prompts.DOC_TASK, glossary=glossary,
        temperature=args.temperature, verbose=args.verbose, verify=doc_mod.verify,
        register=cfg.register(), region=cfg.region(), contexts=contexts,
    )

    # Blocks that failed verification keep their English original, which is already
    # sitting in `pieces` — only the successful ones get replaced.
    out = list(pieces)
    for key, translated in results.items():
        out[index_map[key]] = ("text", doc_mod.restore_inline(translated, slots))

    with open(out_path, "w", encoding="utf-8") as handle:
        handle.write("".join(block for _, block in out))
    print("%s: %d block(s) translated, %d left in English (%s)"
          % (out_path, len(results), len(problems), client.usage_note()))
    for problem in problems:
        err("  block %s: %s" % (problem.key, problem.reason))
    return 2 if problems else 0


def cmd_review(args):
    cfg, client = make_client(args)
    is_json = args.source.endswith(".json")
    if is_json:
        tree = read_json(args.source, {}) or {}
        entries = {locale.label(path): text for path, text in locale.flatten(tree) if text.strip()}
    else:
        with open(args.source, encoding="utf-8") as handle:
            pieces = doc_mod.segment(handle.read())
        entries = {str(i): block for i, (kind, block) in enumerate(pieces) if kind == "text"}
        # The heading above a paragraph is the key path a document never had.
        contexts = {str(i): t for i, t in doc_mod.heading_trails(
            pieces, root=os.path.basename(args.source)).items()}
    if not entries:
        raise CliError("nothing to review in %s" % args.source)

    glossary = cfg.glossary()
    system = prompts.system_prompt("ui" if is_json else "doc", glossary,
                                   cfg.register(), cfg.region(),
                                   key_context=not is_json)
    findings = []
    for batch in chunk_items(list(entries.items()), engine.MAX_CHARS, engine.MAX_ITEMS):
        if is_json:
            body = dict(batch)
        else:
            body = {k: {"k": contexts.get(k, ""), "s": v} for k, v in batch}
        payload = json.dumps(body, ensure_ascii=False, indent=2)
        answer = parse_json_object(
            client.chat(system, "%s\n\n%s" % (prompts.REVIEW_TASK, payload),
                        temperature=0.2)
        )
        findings.extend(answer.get("findings") or [])

    findings = [f for f in findings if isinstance(f, dict) and f.get("key") in entries]
    if args.as_json:
        print(json.dumps({"file": args.source, "findings": findings},
                         ensure_ascii=False, indent=2))
    elif not findings:
        print("%s: reads naturally, nothing to flag." % args.source)
    else:
        print("%s: %d finding(s)\n" % (args.source, len(findings)))
        for finding in findings:
            print("  %s — %s" % (finding.get("key"), finding.get("issue", "")))
            print("      now: %s" % finding.get("current", ""))
            print("      →    %s\n" % finding.get("suggested", ""))

    if args.fix and findings:
        if not is_json:
            raise CliError("--fix only supports JSON locale files")
        return apply_fixes(args.source, findings)
    if args.verbose:
        err(client.usage_note())
    return 1 if findings and not args.fix else 0


def apply_fixes(path, findings):
    tree = read_json(path, {}) or {}
    by_label = {locale.label(p): p for p, _ in locale.flatten(tree)}
    applied, refused = 0, []
    for finding in findings:
        key, suggested = finding.get("key"), finding.get("suggested")
        if key not in by_label or not isinstance(suggested, str) or not suggested.strip():
            continue
        current = locale.get_path(tree, by_label[key])
        problem = placeholders.diff(current, suggested)
        if problem:
            refused.append("%s (%s)" % (key, problem))
            continue
        locale.set_path(tree, by_label[key], suggested)
        applied += 1
    write_json(path, tree)
    print("applied %d rewrite(s) to %s" % (applied, path))
    for name in refused:
        err("  refused, placeholders would change: %s" % name)
    return 0


def cmd_login(args):
    key = args.key
    if not key:
        key = input("API key: ").strip()
    path = config_mod.save({"api_key": key, "base_url": args.base_url, "model": args.model,
                            "effort": args.effort, "register": args.register,
                            "region": args.region})
    print("saved %s (0600)" % path)
    return 0


def cmd_models(args):
    _, client = make_client(args)
    for model in client.models():
        print("%-32s %s" % (model.get("id"), model.get("display_name", "")))
    return 0


def cmd_doctor(args):
    cfg, client = make_client(args)
    print("config file : %s%s" % (config_mod.CONFIG_PATH,
                                  "" if os.path.exists(config_mod.CONFIG_PATH) else " (absent)"))
    print("base url    : %s" % cfg.base_url)
    print("model       : %s (effort %s)" % (cfg.model, cfg.effort))
    try:
        key = cfg.api_key
        print("api key     : %s…%s" % (key[:6], key[-4:]))
    except CliError as exc:
        print("api key     : MISSING")
        raise exc
    glossary = cfg.glossary()
    print("glossary    : %s (%d term(s))"
          % (getattr(cfg, "glossary_path", None) or "none found", len(glossary)))
    print("register    : %s%s" % (cfg.register(),
                                  ", region %s" % cfg.region() if cfg.region() else ""))
    ids = [m.get("id") for m in client.models()]
    print("gateway     : reachable, %d models" % len(ids))
    if cfg.model not in ids:
        err("! model %s is not in the gateway list" % cfg.model)
    results, problems = engine.translate_items(
        client, [("1", "Delete {{count}} items permanently?")], kind="ui", glossary=glossary,
        register=cfg.register(), region=cfg.region(),
        contexts={"1": "common.dialog.confirmDelete"},
    )
    if problems:
        print("round trip  : FAILED — %s" % problems[0].reason)
        return 1
    print("round trip  : %s" % results["1"])
    print("usage       : %s" % client.usage_note())
    return 0


COMMANDS = {
    "translate": cmd_translate,
    "i18n": cmd_i18n,
    "doc": cmd_doc,
    "review": cmd_review,
    "login": cmd_login,
    "models": cmd_models,
    "doctor": cmd_doctor,
}


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return COMMANDS[args.command](args)
    except CliError as exc:
        err("vi-natural: %s" % exc)
        return 1
    except KeyboardInterrupt:
        err("interrupted")
        return 130
