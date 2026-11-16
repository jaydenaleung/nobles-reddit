import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { USE_EMULATORS, config } from './config';

/**
 * The Firebase app and Firestore. Auth and Functions live in their own
 * modules so that the hall screen (/board), which needs neither, stays small.
 *
 * Firestore is read-only from here: the rules deny every client write.
 */
export const app = initializeApp(config.firebase);
export const db = getFirestore(app);

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
