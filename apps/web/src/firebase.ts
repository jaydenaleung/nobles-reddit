import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { USE_EMULATORS, config } from './config';
import { EMULATOR_HOST } from './lib/emulatorHost';

/**
 * The Firebase app and Firestore. Auth and Functions live in their own
 * modules so that the hall screen (/board), which needs neither, stays small.
 *
 * Firestore is read-only from here: the rules deny every client write.
 */
export const app = initializeApp(config.firebase);
export const db = getFirestore(app);

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
}
