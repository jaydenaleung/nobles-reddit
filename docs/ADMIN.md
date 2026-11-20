# A guide for the school

For administrators and moderators. No technical background needed.

## Who can do what

| Role | Who | Can |
| --- | --- | --- |
| Student | Anyone with a school email, by default | Read, post, comment, upvote, vote in polls, report |
| Faculty | Set by an administrator | The same, with a "Faculty" badge when posting under their name |
| Moderator | Faculty nominated by the administration | Everything above, plus: see reports and the queue, hold, remove, restore and pin posts, approve the question of the day, choose replies for the hall screen. **Cannot see who wrote anything** |
| Administrator | The people listed at deployment, and anyone they promote | Everything a moderator can, plus: change roles, manage spaces, look up an author (logged), read the audit log, see AI usage, change settings |

Roles are changed under **Administration, Roles**. Type the person's school email, pick the role and give a reason. If they have an account it changes at once; if not, it applies the first time they sign in. You cannot change your own role: ask another administrator.

## The moderation queue

Open **Moderation** (left column, or under "You" on a phone). Three kinds of item arrive, most urgent first:

- **Wellbeing.** Something that may be about a person's safety. See the next section.
- **Flagged by the automatic check.** A program thought a new post might be harassment, hate, sexual content or personal information, and held it before anyone saw it. It is often wrong. Read it and decide.
- **Reported by a member.** Someone pressed Report. The post is still visible until you act.

For each item you see the text, never the author. Your options:

- **Restore:** it was fine. It becomes visible.
- **Hold:** hide it while you think or ask someone.
- **Remove:** it breaks the ground rules. It disappears for everyone except moderators. The record of who wrote it is kept.
- **Mark as dealt with:** close the item without changing the post.

Every action goes into the audit log with your name and your note. Write a note: future you will want it.

### Pinning and the hall screen

On any thread, **Moderate** lets you pin it to the top of its space, or make it the question on the hall screen. On a comment in that thread, "Show on the hall screen" adds it to the replies the TV shows. Only replies you approve ever appear there.

## What to do about a wellbeing flag

A wellbeing flag means a post may be about someone hurting themselves, being hurt, or hurting someone else. It comes from the automatic check, or from a member choosing "I am worried about someone's safety" when reporting.

What the system has already done:

- A post flagged by the automatic check **was not published**. Nobody but moderators has seen it.
- It was **not deleted**, and you should not remove it: it may be needed.
- It is at the top of the queue.
- The wellbeing contact was emailed (once email is set up; see `docs/DEPLOY.md`). The email says only that something needs a look.
- The student who wrote it saw a message thanking them, telling them an adult will follow up, that they are not in trouble, and listing where to get help now.

What a person needs to do:

1. **Read it promptly.** Decide with the counseling office who responds and how fast. Write that down before launch.
2. **Follow the school's existing steps for a student of concern.** This tool does not replace them.
3. **If you need to know who wrote it,** an administrator can look it up (next section). That is exactly what the lookup is for.
4. When the person is safe and the right people know, mark the item as dealt with. Leave the post held.

If a post was reported as a safety worry by another student, it is still visible. Read it and decide whether to hold it.

The program misses things and flags things that are fine. It is a helper. People reading and reporting are the real safety net.

## Looking up an author

Only administrators can do this, and only on purpose.

- On a thread or a comment, choose **Who wrote this?** Or go to Administration, Find an author, and paste a thread link.
- You must type a reason of at least ten characters.
- You see the person's name, school email, class year and role, and a notice that **this view was logged**.

The log entry records your name, the time, what you looked at and your reason. It cannot be edited or deleted by anyone.

### A suggested policy (for the school to decide)

- Look up an author only for safety, or for serious or repeated breaking of the ground rules.
- Not for curiosity, not for disagreement, not because a post is critical of the school.
- A second administrator reads the audit log every month.
- Tell students that this is the policy. The About page already tells them that lookups are possible and logged.

## The audit log

**Administration, Open the audit log.** It lists, newest first: author lookups, moderation actions, role changes, new and edited spaces, settings changes, question approvals, account deletions, and exports of the log itself. "Export" downloads it as a file for the school's records.

## The question of the day

Each school morning at 6:00 a program suggests three questions. **Nothing is published until a moderator approves one.** Under Moderation, Question of the day you can approve a suggestion (optionally with poll options), reject it, ask for suggestions by hand, or write your own. Approving one posts it as "Administration", pins it in Current events and puts it on the hall screen.

Under Administration, Settings you can list topics the suggestions must avoid and add short calendar notes ("Spirit week starts Monday") to make them timely.

## Spaces

**Administration, Spaces.** Add a space for a team or club, change a description, or limit who can start threads in one (for example, only staff in an announcements space). Spaces are not deleted, so old threads keep their home.

## AI budget

**Administration, AI budget and usage** shows how much of the day's allowance has been used. When it runs out, summaries and suggestions say "unavailable today" and everything else carries on. See `docs/AI.md`.

## When someone deletes their account

Their profile and sign-in are removed. Posts under their name stay but show "Former member". **The record of who wrote each post is kept**, so an administrator can still look up the author of something that remains. The page tells the student this before they confirm.

## If something goes badly wrong

- A thread is out of hand: **hold** it. That hides the thread and its comments from members in one step.
- The whole site needs to stop: ask whoever deployed it to disable Google sign-in in the Firebase console (see `docs/DEPLOY.md`, "Rolling back").
- You think a key or password leaked: tell whoever deployed it. Keys can be replaced in minutes.
