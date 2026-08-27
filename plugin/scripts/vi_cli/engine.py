"""Batch translation with a verification gate on every string."""

import json

from . import cta, placeholders, prompts
from .util import chunk_items, err, parse_json_object

MAX_CHARS = 6000
MAX_ITEMS = 40


class Problem:
    def __init__(self, key, reason, source, candidate=None):
        self.key = key
        self.reason = reason
        self.source = source
        self.candidate = candidate

    def line(self):
        text = "  %s: %s" % (self.key, self.reason)
        if self.candidate is not None:
            text += "\n      source: %s\n      model:  %s" % (self.source, self.candidate)
        return text


def _ask(client, system, task, payload, temperature):
    user = "%s\n\n%s" % (task, json.dumps(payload, ensure_ascii=False, indent=2))
    return parse_json_object(client.chat(system, user, temperature=temperature))


def _payload(batch, contexts):
    """What the model sees. With contexts, each string carries its i18n key path.

    The key disambiguates strings a translator cannot read out of context: "save"
    under `common.buttons` is a Lưu button, under `billing` it may be a discount.
    """
    if not contexts:
        return {str(key): text for key, text in batch}
    return {str(key): {"k": contexts.get(key, ""), "s": text} for key, text in batch}


def translate_items(client, items, kind="ui", task=None, glossary=None,
                    temperature=0.3, verbose=False, verify=placeholders.diff,
                    register=None, region=None, contexts=None, skip_verify=(),
                    bare_cta=(), cta_index=None):
    """Translate (key, text) pairs. Returns (results, problems).

    A key only reaches `results` if its translation carries exactly the
    placeholders of its source. Anything that fails twice is left out and
    reported, so a broken string never silently lands in a locale file.
    """
    system = prompts.system_prompt(kind, glossary, register, region,
                                   key_context=bool(contexts))
    task = task or prompts.BATCH_TASK
    results, problems, retries = {}, [], []

    batches = list(chunk_items(items, MAX_CHARS, MAX_ITEMS))
    for index, batch in enumerate(batches, 1):
        if verbose:
            err("  batch %d/%d (%d strings)" % (index, len(batches), len(batch)))
        payload = _payload(batch, contexts)
        try:
            answer = _ask(client, system, task, payload, temperature)
        except Exception as exc:  # one bad batch must not lose the rest of the file
            err("  batch %d failed (%s) — retrying strings one by one" % (index, exc))
            retries.extend(batch)
            continue
        for key, source in batch:
            candidate = answer.get(str(key))
            if not isinstance(candidate, str) or not candidate.strip():
                retries.append((key, source))
                continue
            if _rejected(key, source, candidate, verify, skip_verify, bare_cta, cta_index):
                retries.append((key, source))
                continue
            results[key] = candidate

    for key, source in retries:
        gate = None if key in skip_verify else verify
        candidate, reason = _translate_one(client, system, task, key, source,
                                           temperature, gate, contexts,
                                           key in bare_cta, cta_index)
        if candidate is None:
            problems.append(Problem(key, reason, source))
        else:
            results[key] = candidate

    return results, problems


def _rejected(key, source, candidate, verify, skip_verify, bare_cta, cta_index):
    """Every gate a candidate has to clear before it may be written."""
    if key not in skip_verify and verify(source, candidate):
        return True
    if key in bare_cta and not cta.is_bare(candidate, cta_index):
        return True
    return False


def _translate_one(client, system, task, key, source, temperature, verify, contexts=None,
                   bare=False, cta_index=None):
    """Second chance for one string, with the rule it broke restated."""
    required = sorted(placeholders.extract(source))
    hint = ""
    if required:
        hint = ("\nBản dịch BẮT BUỘC chứa đúng những placeholder này, nguyên văn: %s"
                % ", ".join(required))
    if bare:
        hint += ("\nĐây là nhãn nút. Trả về ĐỘNG TỪ TRẦN, không kèm tân ngữ: "
                 '"Lưu", không phải "Lưu khách hàng".')
    payload = _payload([(key, source)], contexts)
    try:
        answer = _ask(client, system, task + hint, payload, temperature)
    except Exception as exc:
        return None, "gateway error: %s" % exc
    candidate = answer.get(str(key))
    if not isinstance(candidate, str) or not candidate.strip():
        return None, "model returned nothing for this key"
    problem = verify(source, candidate) if verify else None
    if problem:
        return None, "rejected after retry: %s" % problem
    if bare and not cta.is_bare(candidate, cta_index):
        return None, 'CTA still carries an object after retry ("%s")' % candidate
    return candidate, None
