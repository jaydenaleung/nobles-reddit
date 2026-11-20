import * as logger from 'firebase-functions/logger';
import { FieldValue, db } from './admin';
import { env } from './env';

/**
 * Tells the school's wellbeing contact that something needs a caring adult.
 *
 * The message goes into the `mail` collection in the shape the official
 * Firebase "Trigger Email" extension expects, so installing that extension
 * with the school's mail server is all it takes to deliver it (docs/DEPLOY.md).
 * The email holds no student text and no author: it only says "please look at
 * the moderation queue".
 */
export async function notifyWellbeingContact(postId: string): Promise<void> {
  if (!env.wellbeingEmail) {
    logger.warn('A wellbeing flag was raised but WELLBEING_CONTACT_EMAIL is not set. Nobody was emailed.');
    return;
  }
  const link = env.publicUrl ? `${env.publicUrl}/mod` : 'the moderation page';
  await db.collection('mail').add({
    to: [env.wellbeingEmail],
    message: {
      subject: 'Neddit: a post needs a caring look',
      text:
        'Something written on Neddit may be about someone’s safety or wellbeing.\n\n' +
        'It has NOT been published. It is at the top of the moderation queue, marked "wellbeing".\n\n' +
        `Open ${link} to read it and see who wrote it.\n\n` +
        'Please follow the school’s usual steps for a student of concern.',
    },
    reason: 'wellbeing',
    postId,
    createdAt: FieldValue.serverTimestamp(),
  });
}
