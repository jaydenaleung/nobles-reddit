import { useState } from 'react';
import { GROUND_RULES, HOT_EPOCH_SECONDS, type AuthorDisplay, type IdentityMode } from '@commons/shared';
import { Icon, IconSprite, type IconName } from '../components/Icon';
import { AdminNotice, Avatar, Byline, IdentityToggle, Wordmark } from '../components/Identity';
import { PostRow, SummaryBox, type PostView } from '../components/Post';
import { SafeText } from '../components/SafeText';

const now = (HOT_EPOCH_SECONDS + 86_400 * 30) * 1000;
const ts = (hoursAgo: number) => {
  const ms = now - hoursAgo * 3_600_000;
  return { seconds: Math.floor(ms / 1000), toMillis: () => ms };
};
const base = {
  spaceId: 's',
  body: '',
  thoughtfulCount: 0,
  commentCount: 0,
  anonCommentCount: 0,
  hotScore: 0,
  pinned: false,
  status: 'visible' as const,
  screening: 'clear' as const,
  searchTokens: [],
  sample: false,
};
const student: AuthorDisplay = { mode: 'named', name: 'Sample S.', classYear: 2028, role: 'student' };
const faculty: AuthorDisplay = { mode: 'named', name: 'Sample T.', role: 'faculty' };
const anon: AuthorDisplay = { mode: 'anonymous', anonLabel: 'Anonymous B' };

const posts: PostView[] = [
  {
    ...base,
    id: 'p1',
    kind: 'text',
    spaceName: 'School news',
    title: 'Read this first: how Commons works and what we’re all agreeing to',
    body: 'Disagree freely. Be specific. Go after ideas, not people. Anonymous means other students can’t see your name. The school can.',
    authorDisplay: { mode: 'named', name: 'Administration', role: 'admin' },
    pinned: true,
    pinnedBy: 'administration',
    thoughtfulCount: 212,
    commentCount: 38,
    createdAt: ts(48),
  },
  {
    ...base,
    id: 'p2',
    kind: 'poll',
    spaceName: 'Current events',
    title: 'Should the school day start at 8:30 instead of 8:00?',
    authorDisplay: faculty,
    questionOfTheDay: true,
    poll: {
      options: [
        { id: 'a', label: 'Yes, later', count: 90 },
        { id: 'b', label: 'Not sure', count: 33 },
        { id: 'c', label: 'No, keep 8:00', count: 25 },
      ],
    },
    thoughtfulCount: 148,
    commentCount: 41,
    anonCommentCount: 14,
    createdAt: ts(6),
  },
  {
    ...base,
    id: 'p3',
    kind: 'link',
    spaceName: 'School news',
    title: 'Lacrosse opens the season with a one-goal win',
    authorDisplay: student,
    link: { url: 'https://example.org/sample', domain: 'example.org', source: 'nobleman' },
    sample: true,
    thoughtfulCount: 64,
    commentCount: 17,
    createdAt: ts(3),
  },
  {
    ...base,
    id: 'p4',
    kind: 'text',
    spaceName: 'Middle school',
    title: 'Is it okay to ask upperclassmen for help with homework?',
    body: 'I’m new this year and I don’t really know who to ask. I don’t want to bug anyone who’s busy.',
    authorDisplay: anon,
    thoughtfulCount: 31,
    commentCount: 15,
    createdAt: ts(8),
  },
  {
    ...base,
    id: 'p5',
    kind: 'text',
    spaceName: 'Athletics',
    title: 'Which home games should the whole school come to?',
    authorDisplay: { ...student, name: 'Sample M.', classYear: 2027 },
    createdAt: ts(0.6),
  },
];

const icons: IconName[] = [
  'up',
  'comment',
  'search',
  'pin',
  'flag',
  'mask',
  'shield',
  'home',
  'grid',
  'plus',
  'tv',
  'user',
  'ext',
  'check',
];
const swatches = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'masthead',
  'brand',
  'sky',
  'gold',
  'orange',
  'staff-tint',
  'kind-tint',
  'anon-tint',
  'auto-tint',
];

function Sheet({ theme }: { theme: 'paper' | 'night' | 'board' }) {
  const [mode, setMode] = useState<IdentityMode | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({ p2: true });
  return (
    <section className="nb" data-theme={theme} aria-label={`${theme} theme`}>
      <h2>Theme: {theme}</h2>

      <h3 className="sg-h">Masthead</h3>
      <header className="nb-top" style={{ position: 'static' }}>
        <Wordmark asText />
        <label className="nb-top__search">
          <Icon name="search" /> Search threads and spaces
        </label>
        <div className="nb-top__right">
          <span className="nb-btn nb-btn--primary nb-btn--sm">Start a thread</span>
          <Avatar author={student} />
        </div>
      </header>

      <h3 className="sg-h">Colour roles</h3>
      <div className="sw">
        {swatches.map((name) => (
          <div
            key={name}
            style={{
              background: `var(--${name})`,
              color:
                name === 'masthead'
                  ? 'var(--on-masthead)'
                  : name === 'brand'
                    ? 'var(--on-brand)'
                    : 'var(--ink)',
            }}
          >
            {name}
          </div>
        ))}
      </div>

      <h3 className="sg-h">Type</h3>
      <div className="stack">
        <div className="display-l">Lora for titles and the wordmark</div>
        <div className="headline">A headline in Lora 600</div>
        <div className="read-l">Libre Baskerville for posts and comments, set for reading.</div>
        <div className="body">Inter for small interface text, counts and buttons.</div>
        <div className="nb-meta">Meta · 148 votes · 6 hours ago</div>
        <div>
          The question of the day gets a <span className="nb-hl">yellow highlighter swipe</span>.
        </div>
      </div>

      <h3 className="sg-h">Buttons and badges</h3>
      <div className="row">
        <button className="nb-btn nb-btn--primary" type="button">
          Start a thread
        </button>
        <button className="nb-btn" type="button">
          Post
        </button>
        <button className="nb-btn nb-btn--quiet" type="button">
          Cancel
        </button>
        <button className="nb-btn nb-btn--sm" type="button">
          Small
        </button>
        <button className="nb-btn" type="button" disabled>
          Disabled
        </button>
      </div>
      <div className="row">
        <span className="nb-badge nb-badge--staff">
          <Icon name="shield" /> Faculty
        </span>
        <span className="nb-badge nb-badge--anon">
          <Icon name="mask" /> Anonymous
        </span>
        <span className="nb-badge nb-badge--live">
          <Icon name="tv" /> Live now
        </span>
        <span className="nb-badge nb-badge--kind">Kind</span>
        <span className="nb-badge nb-badge--ai">Auto-summary</span>
      </div>

      <h3 className="sg-h">Icons</h3>
      <div className="row">
        {icons.map((name) => (
          <span key={name} className="row" title={name}>
            <Icon name={name} />
          </span>
        ))}
      </div>

      <h3 className="sg-h">Bylines</h3>
      <div className="stack">
        <Byline author={student} when="2 hours ago" />
        <Byline author={faculty} when="1 hour ago" />
        <Byline author={anon} when="8 hours ago" />
      </div>

      <h3 className="sg-h">Identity toggle (nothing preselected) and the notice</h3>
      <IdentityToggle value={mode} onChange={setMode} firstName="Sample" displayName="Sample S." />

      <h3 className="sg-h">Notices</h3>
      <div className="stack">
        <AdminNotice />
        <div className="nb-notice nb-notice--kind">
          <Icon name="check" />
          <div>
            <b>Be kind. Be honest.</b>
          </div>
        </div>
        <div className="nb-notice nb-notice--anon">
          <Icon name="mask" />
          <div>You are posting as Anonymous B in this thread.</div>
        </div>
        <div className="nb-notice">
          <div>A plain notice.</div>
        </div>
      </div>

      <h3 className="sg-h">Sort tabs (wavy underline on the active one)</h3>
      <nav className="nb-sort" aria-label={`Sort example, ${theme}`}>
        <a href="#styleguide" aria-current="true">
          Hot
        </a>
        <a href="#styleguide">New</a>
        <a href="#styleguide">Top this week</a>
        <a href="#styleguide">No replies yet</a>
        <span className="end">All spaces</span>
      </nav>

      <h3 className="sg-h">Feed rows</h3>
      <div className="nb-feed">
        {posts.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            nowMs={now}
            voted={!!voted[post.id]}
            onVote={() => setVoted((v) => ({ ...v, [post.id]: !v[post.id] }))}
            read={post.id === 'p4'}
            onSave={() => undefined}
            onShare={() => undefined}
          />
        ))}
      </div>

      <h3 className="sg-h">Auto-summary</h3>
      <SummaryBox
        text="Most agree on the sleep. The disagreement is about practice schedules and commute times."
        bullets={['Later starts help only if bedtimes move too.', 'Commute times vary a lot.']}
        basedOn={40}
      />

      <h3 className="sg-h">Comment</h3>
      <div className="nb-comment">
        <Avatar author={student} />
        <div>
          <Byline author={student} when="2 hours ago" avatar={false} />
          <SafeText
            className="nb-comment__body"
            text={'Later starts help, but *only* if bedtimes move too. **Really.** https://example.org/sleep'}
          />
          <div className="nb-comment__actions">
            <button type="button" aria-pressed="false">
              <Icon name="up" /> Thoughtful · 18
            </button>
            <button type="button">
              <Icon name="comment" /> Reply
            </button>
            <button type="button">
              <Icon name="flag" /> Report
            </button>
          </div>
          <div className="nb-comment__replies">
            <div className="nb-comment">
              <Avatar author={anon} />
              <div>
                <Byline author={anon} when="1 hour ago" avatar={false} />
                <SafeText
                  className="nb-comment__body"
                  text="I commute 50 minutes. Thirty extra minutes is real for me."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <h3 className="sg-h">Sidebar boxes</h3>
      <div className="field-row">
        <section className="nb-box">
          <div className="nb-box__head">Ground rules</div>
          <div className="nb-box__body">
            <ol className="fp-rules">
              {GROUND_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
        </section>
        <section className="nb-box">
          <div className="nb-box__head">From the Nobleman</div>
          <div className="nb-box__body fp-src">
            <span className="nb-source">
              <div className="nb-source__title">Lacrosse opens the season with a one-goal win</div>
              <div className="nb-source__meta">Sample headline · 4 min read</div>
            </span>
          </div>
        </section>
      </div>

      <h3 className="sg-h">Fields</h3>
      <div className="nb-composer">
        <div>
          <label className="nb-label" htmlFor={`sg-title-${theme}`}>
            Title
          </label>
          <input
            className="nb-input"
            id={`sg-title-${theme}`}
            defaultValue="Is it okay to ask upperclassmen for help?"
          />
        </div>
        <div>
          <label className="nb-label" htmlFor={`sg-body-${theme}`}>
            Your thoughts
          </label>
          <textarea
            className="nb-textarea"
            id={`sg-body-${theme}`}
            defaultValue="I’m new this year and don’t know who to ask."
          />
          <p className="nb-help">Plain text. *italic*, **bold** and https links work.</p>
        </div>
        <div className="nb-composer__foot">
          <button className="nb-btn nb-btn--quiet" type="button">
            Cancel
          </button>
          <button className="nb-btn nb-btn--primary" type="button">
            Post
          </button>
        </div>
      </div>
    </section>
  );
}

/** Development only: every component in all three themes. */
export default function Styleguide() {
  return (
    <main className="sg" id="styleguide">
      <IconSprite />
      <h1 className="page-h">Styleguide</h1>
      <Sheet theme="paper" />
      <Sheet theme="night" />
      <Sheet theme="board" />
    </main>
  );
}
