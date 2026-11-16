"""Tests for the parts of the skeleton that are meant to work already.

    python -m unittest discover -s tests        (run from the ml/ folder)

When you implement a TODO(student), add your own tests next to these.
"""

from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from commons_ml import baseline_extractive, evaluate, textrank, tfidf, tokenize  # noqa: E402
from commons_ml.schema import validate_summary, validate_thread  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(os.path.dirname(HERE), "data", "sample.jsonl")

THREAD = {
    "title": "Later start?",
    "body": "A later start means more sleep. It may push practice later. What do you think?",
    "comments": [
        {"n": 1, "replyTo": None, "text": "I commute a long way. It would help."},
        {"n": 2, "replyTo": 1, "text": "Practice would end later though."},
    ],
}


class BaselineTest(unittest.TestCase):
    def test_placeholder_returns_a_valid_summary(self) -> None:
        summary = validate_summary(baseline_extractive.summarise(THREAD))
        self.assertEqual(summary["text"], "A later start means more sleep. It may push practice later.")
        self.assertEqual(summary["bullets"], ["I commute a long way.", "Practice would end later though."])
        self.assertLessEqual(len(summary["text"].split()), 60)
        self.assertLessEqual(len(summary["bullets"]), 3)

    def test_placeholder_copes_with_an_empty_thread(self) -> None:
        summary = baseline_extractive.summarise({"title": "Just a title", "body": "", "comments": []})
        self.assertEqual(summary["text"], "Just a title")
        self.assertEqual(summary["bullets"], [])

    def test_the_thread_shape_has_no_author_fields(self) -> None:
        self.assertEqual(sorted(THREAD), ["body", "comments", "title"])
        self.assertEqual(sorted(THREAD["comments"][0]), ["n", "replyTo", "text"])
        validate_thread(THREAD)


class EvaluateTest(unittest.TestCase):
    def test_identical_text_scores_one(self) -> None:
        scores = evaluate.score("more sleep helps everyone", "more sleep helps everyone")
        self.assertEqual(scores, {"rouge1": 1.0, "rouge2": 1.0, "rougeL": 1.0})

    def test_unrelated_text_scores_zero(self) -> None:
        scores = evaluate.score("apples and pears", "trains run late")
        self.assertEqual(scores, {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0})

    def test_partial_overlap_is_between(self) -> None:
        scores = evaluate.score("the cat sat on the mat", "the cat lay on the mat")
        self.assertAlmostEqual(scores["rouge1"], 5 / 6, places=6)
        self.assertAlmostEqual(scores["rouge2"], 3 / 5, places=6)
        self.assertAlmostEqual(scores["rougeL"], 5 / 6, places=6)

    def test_the_sample_file_runs_end_to_end(self) -> None:
        results = evaluate.evaluate(baseline_extractive.summarise, evaluate.load_examples(SAMPLE))
        self.assertEqual(results["examples"], 3.0)
        for name in ("rouge1", "rouge2", "rougeL"):
            self.assertGreater(results[name], 0.0)
            self.assertLess(results[name], 1.0)


class NotWrittenYetTest(unittest.TestCase):
    """The learning project is unwritten on purpose. These fail loudly, not silently."""

    def test_student_modules_say_they_are_unfinished(self) -> None:
        with self.assertRaises(NotImplementedError):
            tokenize.sentences("One. Two.")
        with self.assertRaises(NotImplementedError):
            tfidf.term_frequency(["a", "b"])
        with self.assertRaises(NotImplementedError):
            textrank.summarise(THREAD)


if __name__ == "__main__":
    unittest.main()
