"""OpenAI-compatible chat client over urllib. No third-party dependencies.

Every completion is streamed. Not for the typing effect — nothing here renders
a token as it arrives — but because the gateway sits behind Cloudflare, and
Cloudflare closes a connection whose origin has said nothing for ~100 seconds.
A non-streamed batch of 120 strings at `--effort high` takes longer than that
to think, so it came back 524 every time, at 125 seconds, having burned the
tokens. Streamed, the same batch answers in 184 seconds with never more than
14 seconds between chunks.

That changes what `timeout` means: it is the socket read timeout, so once the
stream is open it is an *idle* timeout — the longest silence tolerated between
chunks — not a budget for the whole call. A slow answer no longer looks like a
dead one.
"""

import json
import time
import urllib.error
import urllib.request

from .util import CliError, err

# 520/522/524 are Cloudflare's own: the origin misbehaved or went quiet. They
# are worth retrying and are not in any OpenAI error table, which is exactly
# why they were missing here and a 524 aborted the run instead of retrying.
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504, 520, 522, 524}
# Cloudflare in front of the gateway rejects the default urllib agent with 1010.
USER_AGENT = "vi-natural/1.4"


class StreamBroken(Exception):
    """The stream opened and then died before `[DONE]`. Retryable."""


class Client:
    def __init__(self, config, timeout=120, retries=3, verbose=False):
        self.config = config
        self.timeout = timeout
        self.retries = retries
        self.verbose = verbose
        self.calls = 0
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.reasoning_tokens = 0

    def _open(self, path, payload):
        url = self.config.base_url + path
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, data=body, method="POST")
        request.add_header("Authorization", "Bearer " + self.config.api_key)
        request.add_header("Content-Type", "application/json")
        request.add_header("User-Agent", USER_AGENT)
        request.add_header("Accept", "text/event-stream")
        return urllib.request.urlopen(request, timeout=self.timeout)

    def chat(self, system, user, temperature=0.3, max_tokens=None, json_mode=True):
        """One completion. Returns the assistant text with reasoning stripped out."""
        payload = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "stream": True,
            # Usage arrives in a final chunk that carries no choices. Without
            # this the streamed call reports nothing and `usage_note` lies.
            "stream_options": {"include_usage": True},
        }
        effort = getattr(self.config, "effort", None)
        if effort:
            payload["reasoning_effort"] = effort
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        if max_tokens:
            payload["max_tokens"] = max_tokens

        last = None
        for attempt in range(self.retries):
            try:
                with self._open("/chat/completions", payload) as response:
                    return self._consume(response)
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:400]
                last = CliError("gateway returned %s: %s" % (exc.code, detail))
                if exc.code not in RETRY_STATUS:
                    raise last
            except (urllib.error.URLError, TimeoutError, OSError,
                    json.JSONDecodeError, StreamBroken) as exc:
                last = CliError("gateway request failed: %s" % exc)
            if attempt < self.retries - 1:
                time.sleep(2 ** attempt)
        raise last

    def _consume(self, response):
        """Read the SSE body and return the assistant text.

        Only `delta.content` is kept. The gateway also streams
        `delta.reasoning_content` — the model thinking out loud, in English —
        and at `--effort high` there is a lot of it. Concatenating the two
        would ship chain-of-thought into a locale file.
        """
        pieces, usage, done = [], None, False
        # A batch at `--effort high` can stream for minutes. Without a sign of
        # life a long call is indistinguishable from a hung one, so -v says so.
        started = last_note = time.time()
        for raw in response:
            if self.verbose and time.time() - last_note > 30:
                last_note = time.time()
                err("    …%ds, %d chars" % (last_note - started,
                                            sum(len(p) for p in pieces)))
            line = raw.decode("utf-8", "replace").strip()
            if not line or not line.startswith("data:"):
                continue
            body = line[5:].strip()
            if body == "[DONE]":
                done = True
                break
            try:
                event = json.loads(body)
            except json.JSONDecodeError:
                continue  # a keep-alive or a comment, not a chunk
            if event.get("error"):
                raise CliError("gateway error: %s"
                               % json.dumps(event["error"])[:300])
            if event.get("usage"):
                usage = event["usage"]
            for choice in event.get("choices") or []:
                delta = choice.get("delta") or choice.get("message") or {}
                text = delta.get("content")
                if text:
                    pieces.append(text)

        content = "".join(pieces)
        if not done and not content:
            raise StreamBroken("stream ended before any content arrived")
        if not content.strip():
            raise CliError("model returned empty content")
        if not done:
            # Truncated mid-answer: the JSON will not parse and a half-written
            # batch is worse than a retried one.
            raise StreamBroken("stream ended after %d chars, before [DONE]"
                               % len(content))
        self._record(usage or {})
        return content

    def _record(self, usage):
        self.calls += 1
        self.prompt_tokens += usage.get("prompt_tokens") or 0
        self.completion_tokens += usage.get("completion_tokens") or 0
        self.reasoning_tokens += (usage.get("completion_tokens_details")
                                  or {}).get("reasoning_tokens") or 0

    def models(self):
        url = self.config.base_url + "/models"
        request = urllib.request.Request(url)
        request.add_header("Authorization", "Bearer " + self.config.api_key)
        request.add_header("User-Agent", USER_AGENT)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8")).get("data", [])
        except urllib.error.HTTPError as exc:
            raise CliError("gateway returned %s listing models" % exc.code)
        except urllib.error.URLError as exc:
            raise CliError("cannot reach %s: %s" % (url, exc))

    def usage_note(self):
        # Reasoning tokens are already inside `completion_tokens`; naming them
        # separately is how you see what raising the effort actually costs.
        note = "%d call(s), %d in / %d out tokens" % (
            self.calls, self.prompt_tokens, self.completion_tokens)
        if self.reasoning_tokens:
            note += " (%d reasoning)" % self.reasoning_tokens
        return note
