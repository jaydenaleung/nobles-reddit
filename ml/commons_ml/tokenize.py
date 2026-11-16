"""Step 1: turn text into sentences and words.

What this module should do
--------------------------
`sentences(text)`  -> a list of sentences, in order.
`words(sentence)`  -> a list of lowercased word tokens, with punctuation gone.
`STOP_WORDS`       -> a set of very common words ("the", "and") to leave out.

Things to think about while you write it
----------------------------------------
* "Dr. Smith arrived at 8.30 a.m. Then class began." is two sentences, not five.
* What should happen to "don't", "8:30", "e-mail", emoji, and URLs?
* Students write in other languages too. Does your splitter cope with accents?
* Keep it deterministic: the same text must always give the same tokens.

This file is intentionally unfinished. Nothing here is implemented.
"""

from __future__ import annotations

from typing import List, Set

# TODO(student): fill this in. Start with about 50 words and see how it changes your results.
STOP_WORDS: Set[str] = set()


def sentences(text: str) -> List[str]:
    """Splits text into sentences.

    TODO(student): write this. A regular expression gets you surprisingly far;
    then find the cases it gets wrong and decide what to do about them.
    """
    raise NotImplementedError("TODO(student): implement sentence splitting")


def words(sentence: str) -> List[str]:
    """Splits a sentence into lowercased word tokens.

    TODO(student): write this, and decide whether to remove STOP_WORDS here
    or later (it changes what TF-IDF sees).
    """
    raise NotImplementedError("TODO(student): implement word tokenising")
