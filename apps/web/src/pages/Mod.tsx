import {
  APP_NAME,
  REPORT_REASONS,
  parseContentKey,
  relativeTime,
  type DailyQuestion,
  type ModerationQueueItem,
  type Report,
} from '@commons/shared';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { ModDialog, type ModTarget } from '../components/Dialogs';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { Empty, ErrorState, Loading, useToast } from '../components/Ui';
import type { Load } from '../data/hooks';
import { db } from '../firebase';

type WithId<T> = T & { id: string };

/** A live list of documents from one query. */
function useLive<T>(
  build: () => ReturnType<typeof query>,
  deps: unknown[] = [],
): { items: WithId<T>[]; load: Load } {
  const [items, setItems] = useState<WithId<T>[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  useEffect(() => {
    return onSnapshot(
      build(),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as T) })));
        setLoad('ready');
      },
      () => setLoad('error'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { items, load };
}

const QUEUE_WORDS = {
  wellbeing: 'Wellbeing',
  'ai-flag': 'Flagged by the automatic check',
  reported: 'Reported',
} as const;

function QueueTab() {
  const toast = useToast();
  const [target, setTarget] = useState<ModTarget | null>(null);
  const [now] = useState(() => Date.now());
  const { items, load } = useLive<ModerationQueueItem & { reportReasons?: string[] }>(() =>
    query(
      collection(db, 'moderationQueue'),
      where('status', '==', 'open'),
      orderBy('priority', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(100),
    ),
  );
  const resolve = async (id: string) => {
    try {
      await api.resolveReport({ id, kind: 'queue' });
      toast('Marked as dealt with.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  if (load === 'loading') return <Loading label="Loading the queue" />;
  if (load === 'error') return <ErrorState title="The queue did not load" />;
  if (items.length === 0) {
    return (
      <Empty title="Queue’s empty">
        <p>Reports and held posts show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <div className="nb-feed" style={{ display: 'block' }}>
        {items.map((item) => {
          const parsed = parseContentKey(item.contentKey);
          const wellbeing = item.reason === 'wellbeing';
          return (
            <article className="q-item" key={item.id}>
              <div className="row">
                <span className={`nb-badge ${wellbeing ? 'nb-badge--live' : 'nb-badge--staff'}`}>
                  {wellbeing && <Icon name="shield" />} {QUEUE_WORDS[item.reason]}
                </span>
                <span className="nb-meta">
                  {parsed?.kind === 'comment' ? 'Comment' : 'Thread'},{' '}
                  {relativeTime(item.createdAt?.toMillis?.() ?? now, now)}
                  {item.labels?.length ? `, ${item.labels.join(', ').replace(/_/g, ' ')}` : ''}
                  {item.reportReasons?.length
                    ? `, ${item.reportReasons.map((r) => REPORT_REASONS.find((x) => x.id === r)?.label ?? r).join('; ')}`
                    : ''}
                </span>
              </div>
              {wellbeing && (
                <div className="nb-notice nb-notice--kind">
                  <Icon name="check" />
                  <div>
                    <b>Someone might need an adult to check in.</b> This didn’t go up, and don’t delete it.
                    Follow the school’s steps for a student of concern. An admin can find out who wrote it,
                    and that lookup is logged.
                  </div>
                </div>
              )}
              <blockquote>{item.snapshotText}</blockquote>
              <div className="row">
                {parsed && (
                  <Link className="nb-btn nb-btn--sm" to={`/t/${parsed.postId}`}>
                    Open the thread
                  </Link>
                )}
                <button
                  className="nb-btn nb-btn--sm"
                  type="button"
                  onClick={() =>
                    setTarget({
                      contentKey: item.contentKey,
                      kind: parsed?.kind ?? 'post',
                      status: item.reason === 'reported' ? 'visible' : 'held',
                    })
                  }
                >
                  <Icon name="shield" /> Moderate
                </button>
                <button
                  className="nb-btn nb-btn--quiet nb-btn--sm"
                  type="button"
                  onClick={() => void resolve(item.id)}
                >
                  Mark as dealt with
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <ModDialog target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function ReportsTab() {
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const { items, load } = useLive<Report>(() =>
    query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'), limit(100)),
  );
  const resolve = async (id: string) => {
    try {
      await api.resolveReport({ id, kind: 'report' });
      toast('Report closed.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  if (load === 'loading') return <Loading label="Loading reports" />;
  if (load === 'error') return <ErrorState title="Reports did not load" />;
  if (items.length === 0) {
    return (
      <Empty title="No open reports">
        <p>Reports show up here.</p>
      </Empty>
    );
  }
  return (
    <div
      className="tbl-wrap"
      tabIndex={0}
      role="group"
      aria-label="Table. Scroll sideways to see every column."
    >
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Reason</th>
            <th scope="col">Note</th>
            <th scope="col">When</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((report) => (
            <tr key={report.id}>
              <td>{REPORT_REASONS.find((r) => r.id === report.reason)?.label ?? report.reason}</td>
              <td>{report.note || <span className="muted">None</span>}</td>
              <td className="num">{relativeTime(report.createdAt?.toMillis?.() ?? now, now)}</td>
              <td>
                <div className="row">
                  <Link className="nb-btn nb-btn--sm" to={`/t/${report.postId}`}>
                    Open the thread
                  </Link>
                  <button
                    className="nb-btn nb-btn--quiet nb-btn--sm"
                    type="button"
                    onClick={() => void resolve(report.id)}
                  >
                    Close
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Proposed questions of the day. A person always decides; nothing is published automatically. */
export function QuestionApprovals() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [own, setOwn] = useState('');
  const [poll, setPoll] = useState<Record<string, string>>({});
  const { items, load } = useLive<DailyQuestion>(() =>
    query(
      collection(db, 'dailyQuestions'),
      where('status', '==', 'proposed'),
      orderBy('createdAt', 'desc'),
      limit(20),
    ),
  );

  const suggest = async () => {
    setBusy(true);
    try {
      const result = await api.proposeDailyQuestionNow({});
      toast(
        result.proposed > 0
          ? `${result.proposed} suggestions added.`
          : result.reason === 'already-proposed'
            ? 'Today’s suggestions were already made.'
            : result.reason === 'budget'
              ? 'No more suggestions today. You can write your own.'
              : 'Couldn’t get suggestions right now. You can write your own.',
      );
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const decide = async (id: string, action: 'approve' | 'reject') => {
    const options = (poll[id] ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    try {
      await api.approveDailyQuestion({
        id,
        action,
        pollOptions: action === 'approve' && options.length >= 2 ? options : undefined,
      });
      toast(
        action === 'approve'
          ? 'Published, pinned in Current events and sent to the hall screen.'
          : 'Rejected.',
      );
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const addOwn = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.proposeHumanQuestion({ text: own });
      setOwn('');
      toast('Added. Approve it below when you’re ready.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  return (
    <div className="stack">
      <div className="nb-notice">
        <div>
          A computer model suggests three questions every school morning. Nothing goes up until a mod approves
          one. The approved question becomes a pinned thread in Current events, posted by “Administration”,
          and goes on the hall screen.
        </div>
      </div>
      <div className="row">
        <button className="nb-btn" type="button" onClick={() => void suggest()} disabled={busy}>
          {busy ? 'Asking' : 'Suggest today’s questions'}
        </button>
      </div>
      <form className="panel" onSubmit={(event) => void addOwn(event)}>
        <div className="field">
          <label className="nb-label" htmlFor="own-question">
            Write your own
          </label>
          <input
            className="nb-input"
            id="own-question"
            value={own}
            maxLength={140}
            onChange={(e) => setOwn(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="nb-btn" type="submit" disabled={own.trim().length < 5}>
            Add
          </button>
        </div>
      </form>
      {load === 'loading' ? (
        <Loading label="Loading questions" />
      ) : load === 'error' ? (
        <ErrorState title="Questions did not load" />
      ) : items.length === 0 ? (
        <Empty title="No questions are waiting">
          <p>Ask for suggestions or write your own.</p>
        </Empty>
      ) : (
        <div className="nb-feed" style={{ display: 'block' }}>
          {items.map((question) => (
            <article className="q-item" key={question.id}>
              <div className="row">
                <span className="nb-badge nb-badge--ai">
                  {question.source === 'ai' ? 'Suggested by the model' : 'Written by a moderator'}
                </span>
                <span className="nb-meta">{question.date}</span>
              </div>
              <p className="nb-starter__q" style={{ margin: 0 }}>
                {question.text}
              </p>
              <div className="field">
                <label className="nb-label" htmlFor={`poll-${question.id}`}>
                  Poll options, separated by commas (optional)
                </label>
                <input
                  className="nb-input"
                  id={`poll-${question.id}`}
                  placeholder="Yes, Not sure, No"
                  value={poll[question.id] ?? ''}
                  onChange={(e) => setPoll((current) => ({ ...current, [question.id]: e.target.value }))}
                />
              </div>
              <div className="row">
                <button
                  className="nb-btn nb-btn--primary nb-btn--sm"
                  type="button"
                  onClick={() => void decide(question.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  className="nb-btn nb-btn--quiet nb-btn--sm"
                  type="button"
                  onClick={() => void decide(question.id, 'reject')}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'queue' | 'reports' | 'question';

export default function Mod() {
  const [tab, setTab] = useState<Tab>('queue');
  useEffect(() => {
    document.title = `Moderation  | ${APP_NAME}`;
  }, []);
  return (
    <Page>
      <div className="page">
        <h1 className="page-h">Moderation</h1>
        <p className="page-lede">
          Wellbeing flags are at the top. You can’t see who wrote anything here. If you need to know, ask an
          admin.
        </p>
        <div className="tabs" role="tablist" aria-label="Moderation sections">
          {(
            [
              ['queue', 'Queue'],
              ['reports', 'Reports'],
              ['question', 'Question of the day'],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'queue' && <QueueTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'question' && <QuestionApprovals />}
      </div>
    </Page>
  );
}
