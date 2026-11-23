/**
 * Neddit: Cloud Functions (2nd gen).
 *
 * Every write in the product goes through one of these. No client can write
 * to Firestore directly (see firestore.rules).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { env } from './env';

setGlobalOptions({ region: env.region, maxInstances: 20 });

// Accounts
export { onboard, setRole, listMyContent, exportMyData, deleteMyAccount } from './users';

// Posts, comments, votes, reports
export { createPost, createComment, editOwnContent, deleteOwnContent, getMyContentStatus } from './content';
export { toggleThoughtful, votePoll } from './votes';
export { reportContent, resolveReport } from './reports';

// Moderation and administration
export { modAction } from './moderation';
export { manageSpace, exportAuditLog, updateConfig, getAiUsage, exportTrainingData } from './adminFns';

// AI
export { requestSummary } from './summary';
export {
  proposeDailyQuestion,
  proposeDailyQuestionNow,
  proposeHumanQuestion,
  approveDailyQuestion,
} from './daily';

// Triggers: screening, feed counters, the hall screen
export {
  screenContent,
  screenComment,
  onCommentWritten,
  onPostVoteWritten,
  onCommentVoteWritten,
  onPostWritten,
  refreshBoardFeed,
} from './triggers';

// Scheduled jobs
export { refreshHotScores, archiveOldContent } from './scheduled';
