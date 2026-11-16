"""A PLACEHOLDER summariser. It is not a real algorithm.

It returns the first sentences of the post and the first comments, and nothing
more. It exists for two reasons:

1. so that the evaluation harness and the server have something to run before
   you have written anything, and
2. to give you a number to beat. "Take the first few sentences" is a famously
   stubborn baseline in summarisation. If TextRank does not beat it on your
   data, that is worth understanding, not hiding.

Only the Python standard library is used.
"""

from __future__ import annotations

import re
from typing import List

from .schema import MAX_BULLETS, MAX_WORDS, Summary, Thread, clamp_words

# A deliberately naive sentence splitter. Writing a better one is step 1 (tokenize.py).
_NAIVE_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def _first_sentences(text: str, count: int) -> List[str]:
    parts = [part.strip() for part in _NAIVE_SENTENCE_END.split(text.strip()) if part.strip()]
    return parts[:count]


def summarise(thread: Thread) -> Summary:
    """PLACEHOLDER: the first two sentences of the post, then the first sentence of the first three comments."""
    lead = _first_sentences(thread.get("body", "") or thread.get("title", ""), 2)
    if not lead:
        lead = [thread.get("title", "")]
    bullets: List[str] = []
    for comment in thread.get("comments", [])[:MAX_BULLETS]:
        first = _first_sentences(comment.get("text", ""), 1)
        if first:
            bullets.append(clamp_words(first[0], 24))
    return {
        "text": clamp_words(" ".join(lead), MAX_WORDS),
        "bullets": bullets,
        # A first-sentences baseline has no idea what people agree or disagree about.
        "agreements": "",
        "disagreements": "",
    }
