"""Step 5: fine-tune a small open-weight model with LoRA.

By this point you have an extractive summariser and numbers for it. This step
is about an *abstractive* one: a model that writes the summary in new words.

What this module should do
--------------------------
`load_base_model(name)`      -> a small open-weight model and its tokeniser.
`build_dataset(path)`        -> training and validation examples from a JSONL file.
`train(model, dataset, ...)` -> LoRA adapters trained on your examples.
`summarise(thread)`          -> a Summary, written by the fine-tuned model.

Decisions you will have to make (and should write down)
-------------------------------------------------------
* Which base model? Pick one small enough to train on the hardware you have.
  Check its licence allows this use.
* What does one training example look like as text? The prompt format matters
  more than you would expect.
* LoRA rank, learning rate, number of epochs. Change one at a time and keep the
  evaluation numbers for each run.
* How will you know it is overfitting? (Hint: you need a validation split the
  model never trains on. Three examples are not enough.)
* How do you keep it from naming people or repeating slurs? The site checks the
  output too, but a check is not a substitute for a model that behaves.

Where the data comes from
-------------------------
Read ../data/README.md first. You may not train on students' posts without
consent, moderator approval and anonymisation. Until that process exists, use
examples you wrote yourself or a public summarisation dataset.

This file is intentionally unfinished. Nothing here is implemented, and no
machine-learning libraries are listed as dependencies: choosing them is part
of the project.
"""

from __future__ import annotations

from typing import Any

from .schema import Summary, Thread


def load_base_model(name: str) -> Any:
    """TODO(student): load a small open-weight model and its tokeniser."""
    raise NotImplementedError("TODO(student): choose and load a base model")


def build_dataset(path: str) -> Any:
    """TODO(student): read JSONL, format each example as text, split into train and validation."""
    raise NotImplementedError("TODO(student): build the training dataset")


def train(model: Any, dataset: Any) -> Any:
    """TODO(student): the training loop, with LoRA adapters. Log the loss; save the adapters."""
    raise NotImplementedError("TODO(student): write the training loop")


def summarise(thread: Thread) -> Summary:
    """TODO(student): generate a summary with the fine-tuned model and shape it as a Summary."""
    raise NotImplementedError("TODO(student): generate with the fine-tuned model")
