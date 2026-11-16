# Training and evaluation data

**No real student writing is stored in this folder, and none may be added without the process below.**

`sample.jsonl` holds three made-up examples so the evaluation harness has something to run. Everything else you put here is git-ignored (`ml/data/*.jsonl`), so data files never end up in the repository by accident.

## The format

One JSON object per line:

```json
{"thread": {"title": "...", "body": "...", "comments": [{"n": 1, "replyTo": null, "text": "..."}]}, "reference": "The summary to compare against."}
```

`thread` is the shape in `commons_ml/schema.py`. It has no author fields, on purpose. `reference` is usually the summary Claude wrote for that thread.

## Using real threads: the rules

Posts on Nobles Commons were written by students, many of them minors, to talk to each other. They were not written to train a model. A thread may be used only when **all** of these are true:

1. **Consent.** Every person who wrote in the thread (the post and every comment) has agreed, knowing what it is for. For students under 18 the school decides whether a parent or guardian must agree as well. One person saying no means the thread is not used.
2. **Moderator approval.** A moderator has read the thread and approved it for this use. Threads that were ever held, removed or flagged for wellbeing are never used.
3. **Anonymised first.** Before the text leaves the site: no names, no anonymous letters, no class years, no roles, no ids, no timestamps finer than a month. Names and personal details that appear *inside* the text are removed or replaced by hand. If that cannot be done reliably for a thread, it is not used.
4. **Kept small and kept safe.** The export stays on school-approved storage, is not shared, is not uploaded to outside services, and is deleted when the project ends.
5. **Reversible.** If someone withdraws consent, their thread is removed from the data and the model is retrained without it.

## How export works today: it does not

There is an admin-only function on the site called `exportTrainingData` (`functions/src/adminFns.ts`). **It refuses to run.** It returns an error saying that training-data export is switched off, and writes that refusal to the audit log.

It is a stub on purpose. Turning it on is a school decision, not a technical one. Before anyone implements it, the school needs to have agreed:

- how consent is asked for and recorded (a `consents` collection, written only by a function, is the obvious design);
- who approves threads, and where that approval is stored;
- the anonymisation steps and who checks them;
- where the export may be stored and for how long.

When that exists, the function should: check the caller is an admin; select only threads where every author has a recorded consent and a moderator has approved; build the `thread` shape above (which already has no author fields); run the text through the anonymisation step; write an audit-log entry listing how many threads were exported; and return the JSONL.

## Until then

- Write your own example threads and summaries. Twenty good ones teach you more than you would think.
- Use a public summarisation dataset to learn the mechanics.
- Use the Claude summaries of the **seeded sample threads** on the emulator as references: that content is made up.
