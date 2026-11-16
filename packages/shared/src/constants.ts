/** The product name lives here and only here, so it can change. */
export const APP_NAME = 'Nobles Commons';
/** The wordmark is plain type: "Nobles" then an italic "Commons". */
export const APP_NAME_PARTS = { first: 'Nobles', second: 'Commons' } as const;
export const SCHOOL_NAME = 'Noble and Greenough School';

export const ROLES = ['student', 'faculty', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export const ASSIGNABLE_ROLES = ['student', 'faculty', 'moderator', 'admin'] as const;

export const DIVISIONS = ['upper', 'middle'] as const;
export type Division = (typeof DIVISIONS)[number];
export const DIVISION_LABELS: Record<Division, string> = {
  upper: 'Upper school',
  middle: 'Middle school',
};

export const DEFAULT_ALLOWED_DOMAINS = ['nobles.edu'];
export const DEFAULT_CLASS_YEAR_MIN = 2027;
export const DEFAULT_CLASS_YEAR_MAX = 2033;

export const LIMITS = {
  titleMin: 5,
  titleMax: 140,
  bodyMax: 10_000,
  commentMax: 4_000,
  maxDepth: 4,
  pollMinOptions: 2,
  pollMaxOptions: 6,
  pollOptionMax: 80,
  reportNoteMax: 500,
  revealReasonMin: 10,
  reasonMax: 500,
  nameMax: 40,
  /** Largest request body a callable accepts, in characters of JSON. */
  payloadMax: 24_000,
  summaryMinComments: 10,
  summaryBucket: 10,
  summaryMaxComments: 60,
  summaryMaxWords: 60,
  summaryMaxBullets: 3,
  searchMaxTokens: 10,
  boardReplies: 3,
  boardReplyMax: 220,
} as const;

/** Per-user limits, per hour. Enforced by a token bucket in the functions. */
export const RATE_LIMITS = {
  posts: { capacity: 5, perHour: 5 },
  comments: { capacity: 40, perHour: 40 },
  votes: { capacity: 200, perHour: 200 },
  reports: { capacity: 10, perHour: 10 },
  summaries: { capacity: 10, perHour: 10 },
  reads: { capacity: 120, perHour: 600 },
  admin: { capacity: 120, perHour: 600 },
} as const;
export type RateLimitAction = keyof typeof RATE_LIMITS;

export const EDIT_WINDOW_MS = 10 * 60 * 1000;
export const PAGE_SIZE = 20;

export const SORTS = ['hot', 'new', 'top', 'unanswered'] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  hot: 'Hot',
  new: 'New',
  top: 'Top this week',
  unanswered: 'No replies yet',
};

export interface SpaceSeed {
  slug: string;
  name: string;
  description: string;
  order: number;
  postingRoles: Role[];
}

/** The spaces every installation starts with. Admins can add more. */
export const DEFAULT_SPACES: SpaceSeed[] = [
  {
    slug: 'school-news',
    name: 'School news',
    description: 'What is happening at school this week, and what you think about it.',
    order: 1,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'current-events',
    name: 'Current events',
    description: 'The world outside campus. Disagree freely, and bring your reasons.',
    order: 2,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'middle-school',
    name: 'Middle school',
    description: 'A space for middle schoolers and the people who remember being one.',
    order: 3,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'clubs',
    name: 'Clubs',
    description: 'Meetings, ideas, and looking for people who like what you like.',
    order: 4,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'athletics',
    name: 'Athletics',
    description: 'Games, teams and everything around them.',
    order: 5,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'ask-the-office',
    name: 'Ask the office',
    description: 'Questions for the administration, answered in the open.',
    order: 6,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
];
export const DAILY_QUESTION_SPACE = 'current-events';

export const GROUND_RULES = [
  'Be kind. Be honest. You can say hard things plainly.',
  'Talk about ideas, not people.',
  'Say what you actually think, and why.',
  'If something looks wrong, report it.',
] as const;

/** Shown on the composer every time. Do not soften this. */
export const ANONYMITY_NOTICE =
  'Anonymous hides your name from other students. The administration can always see who wrote every post and comment.';
export const ANONYMITY_SHORT = 'Anonymous means other students can’t see your name. The school can.';
export const AI_SUMMARY_LABEL = 'Auto-summary. Written by our model, not by a person.';

export const REPORT_REASONS = [
  { id: 'unkind', label: 'It is unkind or goes after a person' },
  { id: 'hate', label: 'It is hateful' },
  { id: 'personal', label: 'It shares private or personal information' },
  { id: 'safety', label: 'I am worried about someone’s safety' },
  { id: 'spam', label: 'It is spam or off topic' },
  { id: 'other', label: 'Something else' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

export const MOD_ACTIONS = [
  'hold',
  'remove',
  'restore',
  'pin',
  'unpin',
  'approveForBoard',
  'removeFromBoard',
] as const;
export type ModAction = (typeof MOD_ACTIONS)[number];

/** Moderation screening: the labels the classifier can return. */
export const SCREEN_LABELS = [
  'harassment',
  'hate',
  'sexual',
  'personal_info',
  'self_harm',
  'harm_to_others',
] as const;
export type ScreenLabel = (typeof SCREEN_LABELS)[number];
export const WELLBEING_LABELS: ScreenLabel[] = ['self_harm', 'harm_to_others'];
/** At or above this confidence a label counts. Below it the content publishes. */
export const SCREEN_HOLD_THRESHOLD = 0.5;

export const DEFAULT_AI_DAILY_TOKEN_BUDGET = 400_000;
export const DEFAULT_RETENTION_MONTHS = 24;

/** Shown to an author whose post raised a wellbeing flag, until the school sets its own in config/resources. */
export const DEFAULT_WELLBEING_RESOURCES = {
  message:
    'Thank you for writing this. It has not been posted, and it has gone to an adult at school who will read it and follow up with care. You are not in trouble.',
  items: [
    {
      label: 'Talk to someone at school',
      detail: 'Your advisor, the counseling office or the health office.',
    },
    {
      label: '988 Suicide and Crisis Lifeline',
      detail: 'Call or text 988, any time, free and confidential.',
    },
    { label: 'If anyone is in immediate danger', detail: 'Call 911.' },
  ],
};

/** Small words left out of the search index. */
export const STOP_WORDS = new Set(
  (
    'a an and are as at be but by for from had has have he her his i if in into is it its me my of on or our she so ' +
    'than that the their them then there these they this to was we were what when where which who why will with you your ' +
    'do does did not no yes can could should would about just really very also too any all some more most'
  ).split(' '),
);

/** Seconds since the Unix epoch at 2026-01-01T00:00:00Z. Hot scores count from here. */
export const HOT_EPOCH_SECONDS = 1767225600;
export const HOT_TIME_DIVISOR = 45_000;

export const ADMIN_DISPLAY_NAME = 'Administration';
export const FORMER_MEMBER_LABEL = 'Former member';
export const SCHOOL_TIME_ZONE = 'America/New_York';
