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
  'ai-flag': 'Held by the computer check',
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
      toast('Done.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  if (load === 'loading') return <Loading label="Loading" />;
  if (load === 'error') return <ErrorState title="The queue didn’t load" />;
  if (items.length === 0) {
    return (
      <Empty title="Queue’s empty">
        <p>Reports and held posts show up here.</p>
      </Empty>
    );
  }
  return (
    <>
      <div className="q-list">
        {items.map((item) => {
          const parsed = parseContentKey(item.contentKey);
          const wellbeing = item.reason === 'wellbeing';
          return (
            <article className="q-item" key={item.id}>
              <div className="row">
                <span className={wellbeing ? 'flag' : 'role'}>{QUEUE_WORDS[item.reason]}</span>
                <span className="muted">{parsed?.kind === 'comment' ? 'Reply' : 'Post'}</span>
                <span className="muted">{relativeTime(item.createdAt?.toMillis?.() ?? now, now)}</span>
                {item.labels?.length ? (
                  <span className="muted">{item.labels.join(', ').replace(/_/g, ' ')}</span>
                ) : null}
                {item.reportReasons?.length ? (
                  <span className="muted">
                    {item.reportReasons
                      .map((r) => REPORT_REASONS.find((x) => x.id === r)?.label ?? r)
                      .join('; ')}
                  </span>
                ) : null}
              </div>
              {wellbeing && (
                <p className="notice">
                  Someone might need an adult to check in. This didn’t go up, and don’t delete it. Follow the
                  school’s steps for a student of concern. An admin can look up who wrote it (that gets
                  logged).
                </p>
              )}
              <blockquote>{item.snapshotText}</blockquote>
              <div className="row">
                {parsed && (
                  <Link className="btn btn--sm" to={`/t/${parsed.postId}`}>
                    Open
                  </Link>
                )}
                <button
                  className="btn btn--sm"
                  type="button"
                  onClick={() =>
                    setTarget({
                      contentKey: item.contentKey,
                      kind: parsed?.kind ?? 'post',
                      status: item.reason === 'reported' ? 'visible' : 'held',
                    })
                  }
                >
                  <Icon name="shield" />
                  Moderate
                </button>
                <button
                  className="btn btn--quiet btn--sm"
                  type="button"
                  onClick={() => void resolve(item.id)}
                >
                  Done
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
      toast('Closed.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  if (load === 'loading') return <Loading label="Loading" />;
  if (load === 'error') return <ErrorState title="Reports didn’t load" />;
  if (items.length === 0) {
    return (
      <Empty title="No open reports">
        <p>When someone reports a post or reply, it shows up here.</p>
      </Empty>
    );
  }
  return (
    <div
      className="tbl-wrap"
      tabIndex={0}
      role="group"
      aria-label="Open reports. Scroll sideways for more columns."
    >
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">Reason</th>
            <th scope="col">Note</th>
            <th scope="col">When</th>
            <th scope="col">
              <span className="nb-sr">Actions</span>
            </th>
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
                  <Link className="btn btn--sm" to={`/t/${report.postId}`}>
                    Open
                  </Link>
                  <button
                    className="btn btn--quiet btn--sm"
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
            ? 'Already got today’s suggestions.'
            : result.reason === 'budget'
              ? 'Suggestions are off for the rest of today. Write your own.'
              : 'Couldn’t get suggestions. Write your own.',
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
      toast(action === 'approve' ? 'Posted to Current events and put on the Gleason TV.' : 'Rejected.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const addOwn = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.proposeHumanQuestion({ text: own });
      setOwn('');
      toast('Added to the list below.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  return (
    <div className="stack">
      <p className="notice">
        Each school morning a computer model suggests a few questions. Nothing goes up until a mod approves
        one. The one you approve gets pinned in Current events and shows on the Gleason TV.
      </p>
      <div className="row">
        <button className="btn" type="button" onClick={() => void suggest()} disabled={busy}>
          {busy ? 'Asking' : 'Get suggestions'}
        </button>
      </div>
      <form className="panel" onSubmit={(event) => void addOwn(event)}>
        <div className="field">
          <label className="label" htmlFor="own-question">
            Write your own
          </label>
          <input
            className="input"
            id="own-question"
            value={own}
            maxLength={140}
            onChange={(e) => setOwn(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={own.trim().length < 5}>
            Add
          </button>
        </div>
      </form>
      {load === 'loading' ? (
        <Loading label="Loading" />
      ) : load === 'error' ? (
        <ErrorState title="Questions didn’t load" />
      ) : items.length === 0 ? (
        <Empty title="No questions waiting">
          <p>Get suggestions or write one.</p>
        </Empty>
      ) : (
        <div className="q-list">
          {items.map((question) => (
            <article className="q-item" key={question.id}>
              <div className="row">
                <span className="role">{question.source === 'ai' ? 'From the model' : 'From a mod'}</span>
                <span className="muted">{question.date}</span>
              </div>
              <p className="q-item__text">{question.text}</p>
              <div className="field">
                <label className="label" htmlFor={`poll-${question.id}`}>
                  Poll options, with commas between them (optional)
                </label>
                <input
                  className="input"
                  id={`poll-${question.id}`}
                  value={poll[question.id] ?? ''}
                  onChange={(e) => setPoll((current) => ({ ...current, [question.id]: e.target.value }))}
                />
              </div>
              <div className="row">
                <button
                  className="btn btn--primary btn--sm"
                  type="button"
                  onClick={() => void decide(question.id, 'approve')}
                >
                  Approve
                </button>
                <button
                  className="btn btn--quiet btn--sm"
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
    document.title = `Moderation | ${APP_NAME}`;
  }, []);
  return (
    <Page>
      <div className="page">
        <h1 className="page-h">Mod queue</h1>
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
