# Launch plan

A suggestion for how to bring Nobles Commons to the school without surprises. Everything here is a draft to adjust.

## Before anyone outside the project sees it

- [ ] The school has reviewed `docs/PRIVACY.md` and `docs/SAFETY.md` and made the five decisions at the end of `docs/DECISIONS.md`.
- [ ] It is deployed, the smoke test passes, and a real Google sign-in has been tried with a school account and with a personal account (which must be turned away).
- [ ] At least two administrators and two moderators have their roles and have read `docs/ADMIN.md`.
- [ ] The wellbeing alert reaches a real inbox, and someone has agreed to answer it.
- [ ] The sample threads have been replaced or removed, and "Read this first" says what the school wants it to say.
- [ ] `/board` is running on the Gleason Hall screen.

## Two-week soft launch with one group

Start with one grade or one club: enough people to have a conversation, few enough to talk to afterwards. A club that already argues well (debate, the Nobleman staff) or a single advisory group is ideal.

**Week 0, the day before.** Meet the group for ten minutes. Show the "Post as" choice and say the sentence out loud: anonymous hides your name from other students; the administration can always see who wrote every post and comment. Ask them to try to break it.

**Week 1.**

- Day 1: a moderator approves a light question of the day with a poll. Members sign in from the QR code.
- Days 2 to 5: one question each morning. A moderator checks the queue twice a day.
- End of week: fifteen minutes with the group. What felt off? Did anyone hold back because of the anonymity notice, or post because of it?

**Week 2.**

- Open one more space to the group and let them start their own threads.
- Put two or three approved replies on the hall screen each day.
- Try the hard paths on purpose with made-up posts: a report, a hold, a restore, an author lookup with a reason, and reading it back in the audit log.
- End of week: decide whether to open to a division, fix first, or stop.

## How to tell whether it is working

Decide the numbers before looking at them.

| Measure | A good sign after two weeks | Where to see it |
| --- | --- | --- |
| People who came back | At least half the group signed in on three or more days | Ask; the app keeps no analytics |
| Conversation, not broadcast | Most threads have replies, and replies have replies | The feed, "No replies" tab |
| Named and anonymous both used | Neither is under about 15% of comments | The "% of comments are anonymous" line on polls |
| Kindness | Few holds and removals, and moderators agree with most automatic flags | Moderation queue, audit log |
| The check's mistakes | Moderators restore fewer than about one in three automatic flags | Audit log: `restore` after an automatic flag |
| Response time | Every report read within a school day; every wellbeing flag within the time the school set | Audit log |
| Trust | In the closing conversation, students can repeat what anonymous does and does not mean | Ask them |

If the group mostly posts anonymously and unkindly, that is the result of the trial, not a failure of it. Stop and rethink before going wider.

## Poster and QR copy

Generate the QR code for the live address with any QR tool, or screenshot the one on `/board` (it is built from `PUBLIC_URL`).

**Poster, version 1**

> **Say what you actually think.**
> Nobles Commons is where the school talks: school news, the world, whatever is on your mind.
> Your name or Anonymous. You choose every time.
> *Anonymous hides your name from other students. The school can still see.*
> Scan to join with your Nobles Google account.

**Poster, version 2 (short)**

> **Today's question is on the Gleason screen.**
> Answer it from your phone.
> [QR]

**Poster, version 3 (for the middle school)**

> **Got a question you don't want to ask out loud?**
> Ask it on Nobles Commons. Be kind. Be honest.
> Other students won't see your name if you choose Anonymous. Teachers in charge of the site still can.
> [QR]

## The Gleason Hall slide

The live screen is `/board`: today's question, the poll, the replies a moderator chose, the QR code and Nobleman headlines. Open it in a browser on the display computer, press F11 for full screen and leave it. It reconnects by itself after a network drop.

For a static slide in the morning rotation:

> **Nobles Commons**
> Today's question: *[the question]*
> Scan to answer. Your name or Anonymous, your choice.
> [QR]

## What to say at assembly (60 seconds)

> We built a place for the whole school to talk, students and faculty together. It is called Nobles Commons. There is a question every morning and spaces for clubs, teams, school news and the world outside.
>
> Every time you post, you choose your name or Anonymous. Here is exactly what Anonymous means: other students cannot see who you are. The school can, and every time an administrator looks, it is logged. We are telling you that now so that nobody is surprised later.
>
> The rule is short: be kind, be honest. Disagree about ideas, not about people. If something looks wrong, press Report.
>
> The code is on the screen in Gleason. Try it today.

## After the soft launch

- Write up what happened in a page: the numbers above, three quotes, what you changed.
- Fix what the group found before widening.
- Widen one step at a time: a division, then the school.
- Revisit the five school decisions after the first month with real experience in hand.
