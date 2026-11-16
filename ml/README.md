# The hand-built model (your learning project)

This folder is a **skeleton**. It is here so that you can build the AI part of Nobles Commons yourself and plug it into the real site when it is ready.

The site already works without it: thread summaries come from Claude through `functions/src/ai/claudeProvider.ts`. Your goal is to write a summariser of your own, measure it against those summaries, and then switch the site over to it.

**What is deliberately not written.** Tokenising, TF-IDF, TextRank, training loops and fine-tuning are left for you. Every place you need to write code is marked `TODO(student)`. Nothing in here is a finished algorithm, and the one summariser that runs (`baseline_extractive.py`) is a clearly labelled placeholder that just returns the first sentences.

## The path

Each step builds on the one before. Do them in order and keep the evaluation numbers from every step: the comparison is the interesting part.

| Step | What you build | File | You will learn |
| --- | --- | --- | --- |
| 1 | Split text into sentences and words | `commons_ml/tokenize.py` | Why "split on spaces" is not enough; what a token is |
| 2 | TF-IDF: score how much each word matters | `commons_ml/tfidf.py` | Bag-of-words, sparse vectors, cosine similarity |
| 3 | Extractive summary with TextRank | `commons_ml/textrank.py` | Graphs, PageRank, picking sentences instead of writing them |
| 4 | Evaluate against the Claude summaries | `commons_ml/evaluate.py` (works already) | ROUGE, what a metric can and cannot tell you |
| 5 | Fine-tune a small open-weight model with LoRA | `commons_ml/finetune.py` | Tokenisers for real, training loops, overfitting, adapters |
| 6 | Serve it and switch the site over | `serve/app.py` (works already) | APIs, schemas, latency, failing safely |

Suggested reading order for the ideas: TF-IDF (any information-retrieval textbook chapter), the TextRank paper (Mihalcea and Tarau, 2004), the ROUGE paper (Lin, 2004), the LoRA paper (Hu et al., 2021).

## Run what exists

Only the Python standard library is needed for steps 1 to 4.

```bash
cd ml
python -m commons_ml.evaluate data/sample.jsonl
```

That scores the placeholder baseline against the three made-up examples in `data/sample.jsonl` and prints ROUGE-1, ROUGE-2 and ROUGE-L. Those are the numbers to beat.

```bash
python -m unittest discover -s tests
```

To score your own summariser, write a function that takes a thread (a `dict` in the shape below) and returns a summary `dict`, then:

```bash
python -m commons_ml.evaluate data/sample.jsonl --summariser commons_ml.textrank:summarise
```

## The shapes (do not change these)

They are the same shapes the site uses (`functions/src/ai/provider.ts`). Notice what is missing: **there is no author anywhere.** A summariser is never told who wrote anything, so it cannot reveal it.

Input, a thread:

```json
{
  "title": "Should the school day start at 8:30?",
  "body": "The text of the post.",
  "comments": [
    { "n": 1, "replyTo": null, "text": "First comment." },
    { "n": 2, "replyTo": 1, "text": "A reply to the first comment." }
  ]
}
```

Output, a summary:

```json
{
  "text": "At most 60 words.",
  "bullets": ["At most 3 short points."],
  "agreements": "One sentence, or an empty string.",
  "disagreements": "One sentence, or an empty string."
}
```

The site checks the output again on its side (`validateSummary`): it trims to 60 words and 3 bullets, strips markup, and refuses anything containing an email address or an id. A home-made model is trusted no more than any other.

## Serve it

```bash
cd ml
python -m venv .venv
.venv/Scripts/activate        # macOS or Linux: source .venv/bin/activate
pip install -r serve/requirements.txt
uvicorn serve.app:app --port 8000
```

`POST http://127.0.0.1:8000/summarize` takes a thread and returns a summary. It uses the placeholder until you point `SUMMARISER` in `serve/app.py` at your own function.

## Switch the site over

1. Start your server (above).
2. In `.env.emulator` (for local testing) set `AI_PROVIDER=local` and `LOCAL_AI_URL=http://127.0.0.1:8000`.
3. `npm run dev`, open a thread with ten or more comments and press "Summarise this thread".

With `AI_PROVIDER=local`, summaries come from your model. Screening new posts and suggesting the question of the day stay with Claude, because they are not part of this project. For production you would host `serve/app.py` somewhere the Cloud Functions can reach (Cloud Run is the natural choice) and set `LOCAL_AI_URL` to that address. See `docs/AI.md`.

If your server is down or returns something malformed, the site says "A summary is not available right now" and everything else carries on.

## Training data: read this before step 5

You may not train on students' posts just because you can read them. `data/README.md` explains the rules: only threads where **every author consented**, that **a moderator approved**, and that were **anonymised first**. The export function on the site (`exportTrainingData`) refuses to run until the school has agreed a process. Until then, write your own examples or use a public dataset.
