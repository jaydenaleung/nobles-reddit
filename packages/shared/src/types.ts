import type { Division, ModAction, ReportReason, Role, ScreenLabel } from './constants';

/** Anything with Firestore Timestamp's shape. Lets the same types serve the web app and the functions. */
export interface TimestampLike {
  seconds: number;
  toMillis(): number;
}

export type ContentStatus = 'visible' | 'held' | 'removed';
/** Where a piece of content is in moderation screening. */
export type ScreeningState = 'pending' | 'clear' | 'flagged' | 'wellbeing' | 'skipped';
export type IdentityMode = 'named' | 'anonymous';

/**
 * What other people see about an author. This is the ONLY author information
 * stored on a post or comment. It never contains a uid or an email.
 */
export type AuthorDisplay =
  | { mode: 'named'; name: string; classYear?: number; role?: Role }
  | { mode: 'anonymous'; anonLabel: string };

export interface UserProfile {
  email: string;
  displayName: string;
  firstName: string;
  lastInitial: string;
  classYear: number | null;
  role: Role;
  divisions: Division[];
  createdAt: TimestampLike;
  lastSeenAt: TimestampLike;
  deleted?: boolean;
}

export interface Space {
  name: string;
  slug: string;
  description: string;
  order: number;
  postingRoles: Role[];
  isPublic: true;
  postCount: number;
  createdAt: TimestampLike;
}

export interface PollOption {
  id: string;
  label: string;
  count: number;
}
export interface Poll {
  options: PollOption[];
  closesAt?: TimestampLike;
}

export interface PostLink {
  url: string;
  domain: string;
  title?: string;
  source?: 'nobleman' | 'other';
}

export interface ThreadSummary {
  text: string;
  bullets: string[];
  agreements: string;
  disagreements: string;
  commentCountAtGeneration: number;
  model: string;
  generatedAt: TimestampLike;
}

export type PostKind = 'text' | 'link' | 'poll';

export interface Post {
  spaceId: string;
  spaceName: string;
  kind: PostKind;
  title: string;
  body: string;
  link?: PostLink;
  poll?: Poll;
  authorDisplay: AuthorDisplay;
  thoughtfulCount: number;
  commentCount: number;
  anonCommentCount: number;
  hotScore: number;
  pinned: boolean;
  pinnedBy?: 'administration';
  status: ContentStatus;
  screening: ScreeningState;
  summary?: ThreadSummary;
  searchTokens: string[];
  questionOfTheDay?: boolean;
  sample?: boolean;
  createdAt: TimestampLike;
  editedAt?: TimestampLike;
}

export interface Comment {
  postId: string;
  parentId: string | null;
  depth: number;
  body: string;
  authorDisplay: AuthorDisplay;
  thoughtfulCount: number;
  status: ContentStatus;
  screening: ScreeningState;
  boardApproved?: boolean;
  sample?: boolean;
  createdAt: TimestampLike;
  editedAt?: TimestampLike;
}

export interface Report {
  contentKey: string;
  postId: string;
  reporterUid: string;
  reason: ReportReason;
  note?: string;
  status: 'open' | 'resolved';
  resolvedBy?: string;
  createdAt: TimestampLike;
}

export interface ModerationQueueItem {
  contentKey: string;
  postId: string;
  reason: 'reported' | 'ai-flag' | 'wellbeing';
  /** Wellbeing items sort to the top. */
  priority: number;
  score?: number;
  labels?: ScreenLabel[];
  snapshotText: string;
  status: 'open' | 'resolved';
  createdAt: TimestampLike;
}

export interface AuditLogEntry {
  actorUid: string;
  actorEmail: string;
  action: string;
  contentKey?: string;
  target?: string;
  reason: string;
  createdAt: TimestampLike;
}

export interface DailyQuestion {
  date: string;
  text: string;
  source: 'ai' | 'human';
  status: 'proposed' | 'approved' | 'rejected';
  approvedBy?: string;
  postId?: string;
  createdAt: TimestampLike;
}

export interface BoardReply {
  /** A display name for a named author, or the anonymous label. Never a uid. */
  displayName: string;
  anonymous: boolean;
  role?: Role;
  text: string;
}
export interface NoblemanItem {
  title: string;
  url: string;
  minutes?: number;
  sample: boolean;
}
export interface BoardFeed {
  questionPostId: string | null;
  questionText: string;
  spaceName: string;
  pollOptions: PollOption[];
  counts: { weighedIn: number; replies: number; anonymousPercent: number };
  approvedReplies: BoardReply[];
  nobleman: NoblemanItem[];
  updatedAt: TimestampLike;
}

export interface UsageDay {
  anthropicInputTokens: number;
  anthropicOutputTokens: number;
  calls: number;
}

export interface WellbeingResources {
  message: string;
  items: { label: string; detail: string }[];
}

/* ---------- Callable results. Only safe fields: never a uid. ---------- */

export interface OnboardResult {
  role: Role;
  displayName: string;
}
export interface CreateContentResult {
  postId: string;
  commentId?: string;
  contentKey: string;
}
export interface ContentStatusResult {
  /** 'pending' while the screening check is still running. */
  outcome: 'pending' | 'visible' | 'held' | 'wellbeing' | 'removed';
  resources?: WellbeingResources;
}
export interface MyContentItem {
  contentKey: string;
  postId: string;
  commentId?: string;
  kind: 'post' | 'comment';
  title?: string;
  body: string;
  identityMode: IdentityMode;
  status: ContentStatus;
  createdAtMs: number;
}
export interface RevealAuthorResult {
  contentKey: string;
  author: {
    displayName: string;
    email: string;
    classYear: number | null;
    role: Role;
    accountDeleted: boolean;
  };
  /** Always true. The interface shows "this view was logged". */
  logged: true;
}
export interface SummaryResult {
  available: boolean;
  reason?: 'too-few-comments' | 'unavailable-today' | 'unavailable';
  summary?: Omit<ThreadSummary, 'generatedAt'> & { generatedAtMs: number };
}
export interface AiUsageResult {
  date: string;
  budget: number;
  used: number;
  calls: number;
  provider: string;
  days: { date: string; input: number; output: number; calls: number }[];
}
export type { ModAction };
