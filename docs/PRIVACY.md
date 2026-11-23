# Privacy

> **Draft for the school to review before launch.** This describes what the software collects and does. It is not a privacy policy and it is not legal advice. Many users will be minors. The school should review this with whoever is responsible for student data and privacy law before any student signs in, and decide what families need to be told.

## What is collected

| What | Where it comes from | Who can see it |
| --- | --- | --- |
| Name, shown as first name and last initial | Google sign-in, editable at onboarding | You, administrators, and other members only on posts you make under your name |
| School email address | Google sign-in | You and administrators |
| Class year | You tell us | You, administrators, and other members only on posts under your name |
| Role (student, faculty, moderator, administrator) | Set by the administration | You, administrators, and others as a badge on named posts |
| Which part of the school (optional) | You tell us | You and administrators |
| What you write | You | Other members, as you chose to sign it. Moderators see hidden posts too |
| Who wrote each post and comment | Recorded automatically | Nobody through the website; it is stored privately |
| Your upvotes and poll votes | You | Only you. Others see totals |
| Reports you make | You | Moderators and administrators |
| When you last signed in | Recorded automatically | You and administrators |

## What is not collected

- No profile photo. Google offers one; the app does not store or show it.
- No full last name on posts.
- No location, no contacts, no device identifiers.
- No advertising, no trackers, no outside analytics.
- No images or files. This version has no uploads.
- Fonts are served from the site itself, so no request goes to Google Fonts.

## Kept on your device only

Your theme, your unsent draft, which threads you opened and which you saved are stored in your browser and never sent anywhere.

## Who else handles the data

| Service | What it does | What it receives |
| --- | --- | --- |
| Google Firebase (Authentication, Firestore, Cloud Functions, Hosting) | Runs the site and stores everything | Everything in the table above |
| Anthropic (the Claude API) | The automatic safety check on new posts, thread summaries and question suggestions | The **text** of posts and comments, with no names, emails, ids or roles attached. For question suggestions, thread titles only |

The school should review both companies' terms for education and for data about minors, including how long each keeps request data, before launch. The functions call the Claude API with the school's own key; nothing is sent from students' browsers to Anthropic.

If the school would rather that student text never leaves its own project, set `AI_PROVIDER=mock` to turn the models off (posts are then published without the automatic check), or serve a model of its own (see `docs/AI.md`).

## How long things are kept

- **Posts and comments:** until removed by their author or a moderator.
- **Removed posts and comments:** kept hidden for `RETENTION_MONTHS` (default 24), then moved to an archive no client can read. They are not automatically destroyed. **The school should decide whether and when the archive is deleted.**
- **The record of who wrote what:** kept as long as the post exists, and after it is removed.
- **The audit log:** kept. It records moderation actions and role changes.
- **AI usage counts:** one small total per day, no content.

## Your choices

- **Everything you post goes up under your name** (first name and last initial, plus your class year if you are a student). There is no anonymous posting.
- **Download your data** from the You page: your profile, everything you wrote, your marks and votes, and your reports.
- **Delete your account** from the You page. What happens, exactly:
  - your profile and sign-in are removed;
  - posts and comments under your name stay, showing "Former member" in place of your name;
  - **the school keeps its record of who wrote each of your posts**, and a small record of your name and school email so that the record still means something. This is so that the school can still act on something that was posted. The page says this before you confirm;
  - it cannot be undone.
- **Delete a post or comment** at any time. It disappears for everyone except moderators. The record of who wrote it is kept.

## Things the school needs to decide

1. Whether families are told, or asked, before students use this, and how that differs for the middle school.
2. Whether the retention periods above are right, and who can delete from the archive.
3. Whether keeping the authorship record after an account is deleted matches school policy. The software assumes it does.
4. Who the administrators are, since they are the only people who can connect a post to a person.
5. Whether student text may be sent to an outside model at all.

## Contact

The school should name a person here whom students and families can ask about their data.
