# Safety

> **Draft for the school to review before launch.** This describes what the software does. It is not a school policy, and it has not been reviewed by the administration, the counseling office or legal counsel. Nothing here should be promised to students until the school has agreed it.

## What the design is trying to do

Give students and faculty a place to disagree honestly and kindly, where a student can ask something without their name attached, and where the adults responsible for them can still act when someone is at risk or being hurt.

## Anonymity: exactly what it means here

- **Other students and faculty cannot see who wrote an anonymous post.** Not on the page, not in the data the page loads, not through search, not from ids or timestamps, and not from error messages. This is tested (see `docs/ARCHITECTURE.md`).
- **The administration can always see.** Every post and comment has a private record of its author. Administrators can look it up by giving a reason, and each lookup is logged with their name, the time and the reason. The log cannot be edited.
- **Moderators cannot see.** They can remove a post without knowing whose it is.
- **The composer says so every time,** in these words: "Anonymous hides your name from other students. The administration can always see who wrote every post and comment." Anonymous is never preselected.

### Honest limits

Students should hear these before they post, and the About page tells them:

- **A small community can guess.** Writing style, the topic, or "the only person who would know that" can identify someone even with no name attached.
- **Anonymous to students is not anonymous to the school.** If a student needs to tell someone something the school should not know, this is the wrong place, and the school should make sure students know where the right places are.
- **Screenshots exist.** Deleting a post does not delete a picture of it.
- **Within a thread, an anonymous author keeps one letter** ("Anonymous B") so the conversation can be followed. Everything one person says anonymously in a thread is therefore linked together. Across threads the letters are not linked.
- **Poll results and counts can reveal things in a tiny group.** "1 vote" in a space with three people is not very private.

## What happens to a new post

1. It is held, unseen, for a few seconds while an automatic check reads it.
2. If nothing worries the check, it is published.
3. If the check thinks it may be harassment, hate, sexual content or someone's personal information, it stays hidden and a moderator decides.
4. If the check thinks it may be about self-harm or harm to others, it is **never deleted and never published**. It goes to the top of the moderation queue, the school's wellbeing contact is emailed, and the author sees a caring message and a list of people to talk to.
5. Anyone can report anything, at any time. Reports go to moderators. "I am worried about someone's safety" is treated as urgent.

### The automatic check is a helper, not a judge

- It is a language model (Claude). It makes mistakes in both directions: it will hold harmless posts and miss harmful ones, especially sarcasm, in-jokes, coded language and anything that depends on knowing the people involved.
- It never deletes anything and never punishes anyone. A person makes every decision.
- If it is unavailable (the service is down, or the day's budget is spent), a small list of very clear phrases about self-harm and violence is still checked, and everything else is published. **The school should decide whether that is the right fallback**, or whether new posts should wait for a moderator when the check is down.
- Reports and moderators are the real safety net. Moderation needs to be staffed.

## Wellbeing flags need a person

Software can notice a worrying sentence. It cannot help a student. Before launch the school needs to decide and write down:

- who receives the alert, and who covers when they are away;
- how quickly someone responds, including evenings, weekends and holidays, when students will still be posting;
- how this connects to the school's existing process for a student of concern;
- the exact words and resources a student sees (the default text is a placeholder and lists 988 and 911; edit it under Administration, Settings).

The alert email needs a mail service to be connected before it is delivered. Until then the flag appears in the queue only. See `docs/DEPLOY.md`.

## Other protections in the software

- **School accounts only.** Sign-in is Google, limited to the school's email domain, checked on the server.
- **Text is text.** Posts cannot contain HTML or scripts. Links must be https, open in a new tab and are never fetched by the server.
- **No images or uploads** in this version.
- **Rate limits:** 5 threads, 40 comments, 200 "Thoughtful" marks and 10 reports per person per hour.
- **No downvotes and no negative scores.** The only reaction is "Thoughtful".
- **Editing** is possible for 10 minutes; edited text is checked again.
- **The hall screen** shows only replies a moderator chose for it.
- **Computer-written text is always labelled** ("Auto-summary. Written by our model, not by a person."), and the model is never told who wrote anything.

## Known gaps

- Nothing here detects bullying that happens through tone, exclusion or pile-ons of individually mild comments. People have to.
- There is no blocking or muting of other members.
- There is no notification to a student when their post is removed, beyond its status on their own page.
- A student who is held for review sees only "a moderator will take a look". The school may want a way to explain decisions.
- The moderation tools have not been tested with real moderators.

## Suggested ground rules for launch

The four on the site: be kind and honest; talk about ideas, not people; say what you actually think and why; report what looks wrong. The school will want to connect these to its existing handbook and say what happens when they are broken.
