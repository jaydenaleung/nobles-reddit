"""Step 2: TF-IDF, a way to score how much a word matters in a sentence.

What this module should do
--------------------------
`term_frequency(tokens)`           -> how often each word appears in one sentence.
`inverse_document_frequency(docs)` -> how rare each word is across all sentences.
`tfidf_vectors(docs)`              -> one sparse vector (a dict) per sentence.
`cosine_similarity(a, b)`          -> a number from 0 to 1: how alike two vectors are.

The idea
--------
A word that appears in every sentence ("school") tells you little. A word that
appears in only a few ("commute") tells you a lot about those few. TF-IDF
multiplies "how often here" by "how rare overall".

Things to try once it works
---------------------------
* Different IDF formulas (with and without smoothing). Do the summaries change?
* Print the ten highest-scoring words of a thread. Do they match your intuition?

This file is intentionally unfinished. Nothing here is implemented.
"""

from __future__ import annotations

from typing import Dict, List

Vector = Dict[str, float]


def term_frequency(tokens: List[str]) -> Vector:
    """TODO(student): count each token, then decide how to normalise the counts."""
    raise NotImplementedError("TODO(student): implement term frequency")


def inverse_document_frequency(documents: List[List[str]]) -> Vector:
    """TODO(student): for each word, log(number of documents / documents containing it)."""
    raise NotImplementedError("TODO(student): implement inverse document frequency")


def tfidf_vectors(documents: List[List[str]]) -> List[Vector]:
    """TODO(student): combine the two functions above into one vector per document."""
    raise NotImplementedError("TODO(student): implement TF-IDF vectors")


def cosine_similarity(a: Vector, b: Vector) -> float:
    """TODO(student): dot product divided by the product of the two lengths. Mind the zero vector."""
    raise NotImplementedError("TODO(student): implement cosine similarity")
