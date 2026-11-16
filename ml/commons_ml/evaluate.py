"""Step 4: score a summariser against reference summaries.

    python -m commons_ml.evaluate data/sample.jsonl
    python -m commons_ml.evaluate data/sample.jsonl --summariser commons_ml.textrank:summarise

Each line of the JSONL file is one example:

    {"thread": {...a Thread...}, "reference": "the summary to compare against"}

The reference is usually the summary Claude wrote for the same thread, so the
scores tell you how close your summariser gets to it.

The metric is ROUGE-style overlap, written out here so you can read it:

* ROUGE-1: overlap of single words.
* ROUGE-2: overlap of pairs of neighbouring words.
* ROUGE-L: the longest sequence of words that appears in both, in order.

Each is reported as an F1 score between 0 and 1. Higher means more overlap.
Overlap is not the same as quality: a summary can score well and still be
unfair or wrong, and a good summary in different words scores badly. Read some
of the outputs yourself as well.

This harness works as it is and uses only the standard library. The tokeniser
below is intentionally simple; swapping in your own from tokenize.py is a good
first experiment.
"""

from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
from collections import Counter
from typing import Callable, Dict, Iterable, List, Sequence, Tuple

from .schema import Summary, Thread, validate_summary, validate_thread

Summariser = Callable[[Thread], Summary]

_WORD = re.compile(r"[a-z0-9']+")


def simple_tokens(text: str) -> List[str]:
    """Lowercased words. Deliberately basic."""
    return _WORD.findall(text.lower())


def _ngrams(tokens: Sequence[str], n: int) -> Counter:
    return Counter(tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def _f1(overlap: int, candidate_total: int, reference_total: int) -> float:
    if overlap == 0 or candidate_total == 0 or reference_total == 0:
        return 0.0
    precision = overlap / candidate_total
    recall = overlap / reference_total
    return 2 * precision * recall / (precision + recall)


def rouge_n(candidate: Sequence[str], reference: Sequence[str], n: int) -> float:
    """F1 overlap of n-grams between a candidate and a reference."""
    cand, ref = _ngrams(candidate, n), _ngrams(reference, n)
    overlap = sum((cand & ref).values())
    return _f1(overlap, sum(cand.values()), sum(ref.values()))


def _lcs_length(a: Sequence[str], b: Sequence[str]) -> int:
    """Length of the longest common subsequence, by dynamic programming."""
    previous = [0] * (len(b) + 1)
    for x in a:
        current = [0]
        for j, y in enumerate(b, start=1):
            current.append(previous[j - 1] + 1 if x == y else max(previous[j], current[j - 1]))
        previous = current
    return previous[-1]


def rouge_l(candidate: Sequence[str], reference: Sequence[str]) -> float:
    """F1 of the longest common subsequence."""
    return _f1(_lcs_length(candidate, reference), len(candidate), len(reference))


def summary_as_text(summary: Summary) -> str:
    """The words a reader sees: the text and the bullets."""
    return " ".join([summary["text"], *summary["bullets"]])


def score(candidate: str, reference: str) -> Dict[str, float]:
    cand, ref = simple_tokens(candidate), simple_tokens(reference)
    return {
        "rouge1": rouge_n(cand, ref, 1),
        "rouge2": rouge_n(cand, ref, 2),
        "rougeL": rouge_l(cand, ref),
    }


def load_examples(path: str) -> List[Tuple[Thread, str]]:
    examples: List[Tuple[Thread, str]] = []
    with open(path, encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            if "thread" not in record or "reference" not in record:
                raise ValueError(f"Line {line_number}: each example needs 'thread' and 'reference'.")
            examples.append((validate_thread(record["thread"]), str(record["reference"])))
    return examples


def evaluate(summariser: Summariser, examples: Iterable[Tuple[Thread, str]]) -> Dict[str, float]:
    """Runs a summariser over every example and returns the average of each score."""
    totals: Dict[str, float] = {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0}
    count = 0
    for thread, reference in examples:
        summary = validate_summary(summariser(thread))
        for name, value in score(summary_as_text(summary), reference).items():
            totals[name] += value
        count += 1
    if count == 0:
        raise ValueError("There are no examples to score.")
    return {name: value / count for name, value in totals.items()} | {"examples": float(count)}


def load_summariser(spec: str) -> Summariser:
    """Loads 'package.module:function'."""
    module_name, _, function_name = spec.partition(":")
    if not function_name:
        raise ValueError("Give the summariser as module:function, for example commons_ml.textrank:summarise")
    return getattr(importlib.import_module(module_name), function_name)


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Score a summariser with ROUGE-style overlap.")
    parser.add_argument("data", help="A JSONL file of {thread, reference} examples")
    parser.add_argument(
        "--summariser",
        default="commons_ml.baseline_extractive:summarise",
        help="module:function to score (default: the placeholder baseline)",
    )
    args = parser.parse_args(argv)
    results = evaluate(load_summariser(args.summariser), load_examples(args.data))
    print(f"Summariser: {args.summariser}")
    print(f"Examples:   {int(results['examples'])}")
    for name in ("rouge1", "rouge2", "rougeL"):
        print(f"{name:<8}    {results[name]:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
