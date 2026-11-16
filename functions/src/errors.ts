import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { ZodError } from 'zod';

/**
 * An error whose message is safe to show to the person who caused it.
 * Messages never contain a uid, an email or anything about another user.
 */
export class AppError extends Error {
  constructor(
    readonly code: FunctionsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errors = {
  signIn: () => new AppError('unauthenticated', 'Sign in first.'),
  notMember: () =>
    new AppError(
      'permission-denied',
      'Nobles Commons is for the Nobles community. Sign in with your school Google account.',
    ),
  notOnboarded: () => new AppError('failed-precondition', 'Finish setting up your account first.'),
  notAllowed: () => new AppError('permission-denied', 'You do not have permission to do that.'),
  notFound: (what = 'That') => new AppError('not-found', `${what} is not available.`),
  invalid: (message: string) => new AppError('invalid-argument', message),
  tooLarge: () => new AppError('invalid-argument', 'That is too long to send.'),
};

/** Turns anything thrown into an HttpsError with a generic, safe message. */
export function toHttpsError(error: unknown, functionName: string): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof AppError) return new HttpsError(error.code, error.message);
  if (error instanceof ZodError) {
    const first = error.issues[0];
    // Our own messages are written for people. Zod's built-in ones ("Expected string, received null") are not.
    const builtIn =
      !first || /^(Expected|Required|Invalid|Unrecognized|Unexpected|Too (small|big))/.test(first.message);
    return new HttpsError(
      'invalid-argument',
      builtIn ? 'Something in that request was missing or not valid.' : first.message,
    );
  }
  // Unknown errors are logged for the developers and hidden from the caller.
  logger.error(`${functionName} failed`, {
    name: error instanceof Error ? error.name : 'unknown',
    message: error instanceof Error ? error.message : String(error),
  });
  return new HttpsError('internal', 'Something went wrong on our side. Please try again.');
}
