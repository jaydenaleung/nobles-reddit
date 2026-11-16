"""The shapes a summariser takes and returns.

They mirror `functions/src/ai/provider.ts` exactly, so that a summariser
written here can be dropped into the site. Note what is not here: no author,
no name, no id. A summariser is never told who wrote anything.
"""

from __future__ import annotations

from typing import List, Optional, TypedDict


class Comment(TypedDict):
    n: int  # position in the thread, starting at 1
    replyTo: Optional[int]  # the position this comment answers, or None
    text: str


class Thread(TypedDict):
    title: str
    body: str
    comments: List[Comment]


class Summary(TypedDict):
    text: str  # at most 60 words
    bullets: List[str]  # at most 3
    agreements: str  # one sentence, or ""
    disagreements: str  # one sentence, or ""


MAX_WORDS = 60
MAX_BULLETS = 3


def clamp_words(text: str, max_words: int = MAX_WORDS) -> str:
    """Cuts text to at most `max_words` words."""
    words = text.split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]).rstrip(",;:") + "…"


def validate_thread(value: object) -> Thread:
    """Checks that `value` looks like a Thread and returns it. Raises ValueError if not."""
    if not isinstance(value, dict):
        raise ValueError("A thread must be an object.")
    if not isinstance(value.get("title"), str) or not isinstance(value.get("body"), str):
        raise ValueError("A thread needs a string title and body.")
    comments = value.get("comments")
    if not isinstance(comments, list):
        raise ValueError("A thread needs a list of comments.")
    for comment in comments:
        if not isinstance(comment, dict) or not isinstance(comment.get("text"), str):
            raise ValueError("Every comment needs a string text.")
    return value  # type: ignore[return-value]


def validate_summary(value: object) -> Summary:
    """Checks that `value` looks like a Summary, trims it to the limits and returns it."""
    if not isinstance(value, dict):
        raise ValueError("A summary must be an object.")
    text = value.get("text")
    bullets = value.get("bullets")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("A summary needs some text.")
    if not isinstance(bullets, list) or not all(isinstance(b, str) for b in bullets):
        raise ValueError("Bullets must be a list of strings.")
    return {
        "text": clamp_words(text),
        "bullets": [clamp_words(b, 24) for b in bullets if b.strip()][:MAX_BULLETS],
        "agreements": str(value.get("agreements") or ""),
        "disagreements": str(value.get("disagreements") or ""),
    }
