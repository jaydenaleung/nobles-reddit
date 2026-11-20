/** The product name lives here and only here, so it can change. */
export const APP_NAME = 'Neddit';
/** One line that says what the site is. */
export const APP_TAGLINE = 'The Nobles Discussion Board';
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
  unanswered: 'No replies',
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
    description: 'What’s going on around campus this week.',
    order: 1,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'current-events',
    name: 'Current events',
    description: 'Stuff happening outside Dedham. Bring your reasons.',
    order: 2,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'middle-school',
    name: 'Middle school',
    description: 'For seventh and eighth graders.',
    order: 3,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'clubs',
    name: 'Clubs',
    description: 'Meeting times and sign-ups.',
    order: 4,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'athletics',
    name: 'Athletics',
    description: 'Scores, and which home games people should actually go to.',
    order: 5,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
  {
    slug: 'ask-the-office',
    name: 'Ask the office',
    description: 'Ask the school something. The answer goes here so everyone sees it.',
    order: 6,
    postingRoles: ['student', 'faculty', 'moderator', 'admin'],
  },
];
export const DAILY_QUESTION_SPACE = 'current-events';

export const MISSION =
  'At Nobles, we forge human connections to inspire a lifelong process of discovery and unlock the potential to do good.';

/** The school's core values. The left column shows the names; the values page has the rest. */
export const CORE_VALUES = [
  {
    name: 'Curiosity',
    text: 'Curiosity inspires intellectual inquiry. By questioning, reasoning, and thinking critically, we embrace complex ideas and value the exchange of diverse perspectives.',
  },
  {
    name: 'Respect',
    text: 'Respect for self and others is the bedrock of our community, guiding us to act with honesty, humility, kindness, empathy, and trust.',
  },
  {
    name: 'Playfulness',
    text: 'Playfulness sparks creativity, energizes us to give our best, and fortifies resilience to face challenges. We balance hard work with humor.',
  },
  {
    name: 'Generosity',
    text: 'We show up for each other. We practice generosity in all its forms—sharing our knowledge, time, resources, and passions. Giving deepens our understanding of each other and ourselves.',
  },
  {
    name: 'Belonging',
    text: 'Community means everyone. When we are known and valued, we flourish. Together, we create an environment where everyone feels respected and empowered to be their best selves.',
  },
] as const;

export const DEI_COMMITMENT =
  'Nobles commits itself to building a community in which every member feels a sense of belonging, respect, recognition, value, and confidence. We hope all members are willing to learn, value the differences in our community, and self-reflect so they know how to participate in the world around them to effect positive change.';

export const NEDDIT_TIPS = [
  'Neddit is about learning to disagree respectfully. Focus on the ideas, not the people who wrote them.',
  'Just like Reddit, Neddit is a space to discuss all kinds of ideas. Post often – the success of this platform depends on you!',
  'Remember that what you say here maintains a permanent digital footprint!',
] as const;

export const NEDDIT_QUOTE = {
  text: 'Great minds discuss ideas; average minds discuss events; small minds discuss people.',
  by: 'Eleanor Roosevelt',
} as const;

export const AI_SUMMARY_LABEL = 'Summary. Written by a computer model, not a person.';

export const REPORT_REASONS = [
  { id: 'unkind', label: 'It’s mean or goes after someone' },
  { id: 'hate', label: 'It’s hateful' },
  { id: 'personal', label: 'It shares someone’s private info' },
  { id: 'safety', label: 'I’m worried someone isn’t safe' },
  { id: 'spam', label: 'Spam or off topic' },
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
    'Thanks for writing this. It didn’t go up on the site. An adult at school will read it and check in with you. You’re not in trouble.',
  items: [
    {
      label: 'Talk to someone at school',
      detail: 'Your advisor, or anyone in the counseling or health office.',
    },
    {
      label: 'Call or text 988',
      detail: 'Any time, free. If someone is in danger right now, call 911.',
    },
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
