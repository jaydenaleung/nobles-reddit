"""Step 3: an extractive summary with TextRank.

"Extractive" means the summary is made of sentences picked from the thread,
not newly written ones. TextRank picks them the way PageRank ranks web pages:
a sentence is important if it is similar to many other important sentences.

What this module should do
--------------------------
`similarity_graph(vectors)` -> a matrix: how similar each sentence is to each other one.
`pagerank(graph)`           -> an importance score per sentence.
`summarise(thread)`         -> a Summary (see schema.py) built from the top sentences.

Rules the summary must keep (the site enforces them too)
-------------------------------------------------------
* At most 60 words of text and at most 3 bullets.
* Never name or describe an author. You are not given any, so do not guess.
* Do not copy a sentence that contains a slur or personal details. How will you tell?
  (This is a real, hard problem. Write down what you decided and why.)

Questions worth answering in your write-up
------------------------------------------
* Extractive summaries can only repeat what one person said. Is that fair to a
  thread where people disagree? How would you pick sentences from both sides?
* Does the first comment get picked too often? Why might that be?

This file is intentionally unfinished. Nothing here is implemented.
"""

from __future__ import annotations

from typing import List

from .schema import Summary, Thread
from .tfidf import Vector


def similarity_graph(vectors: List[Vector]) -> List[List[float]]:
    """TODO(student): cosine similarity between every pair of sentences."""
    raise NotImplementedError("TODO(student): build the similarity graph")


def pagerank(graph: List[List[float]], damping: float = 0.85, iterations: int = 50) -> List[float]:
    """TODO(student): power iteration until the scores stop changing."""
    raise NotImplementedError("TODO(student): implement PageRank")


def summarise(thread: Thread) -> Summary:
    """TODO(student): tokenise -> TF-IDF -> graph -> PageRank -> pick sentences -> Summary."""
    raise NotImplementedError("TODO(student): implement the TextRank summariser")
