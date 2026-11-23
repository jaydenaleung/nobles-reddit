import {
  APP_NAME,
  ASSIGNABLE_ROLES,
  DEFAULT_WELLBEING_RESOURCES,
  ROLES,
  type AiUsageResult,
  type AuditLogEntry,
  type Role,
} from '@commons/shared';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { Page } from '../components/Layout';
import { Empty, ErrorState, Loading, downloadJson, useToast } from '../components/Ui';
import { useSpaces, type Load } from '../data/hooks';
import { db } from '../firebase';
import { QuestionApprovals } from './Mod';

function RolesTab() {
  const toast = useToast();
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [load, setLoad] = useState<Load>('loading');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('faculty');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'roles'),
      (snap) => {
        setRoles((snap.data()?.emailToRole ?? {}) as Record<string, Role>);
        setLoad('ready');
      },
      () => setLoad('error'),
    );
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.setRole({ email, role, reason });
      toast(
        result.applied
          ? `${result.email} is now ${result.role}. That’s in the audit log.`
          : `${result.email} will be ${result.role} when they first sign in.`,
      );
      setEmail('');
      setReason('');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const entries = Object.entries(roles).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="stack">
      <p className="muted">
        Anyone with a school email is a student unless they’re listed here. Mods are teachers the
        administration picks.
      </p>
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <h2>Set a role</h2>
        <div className="field-row">
          <div className="field">
            <label className="nb-label" htmlFor="role-email">
              School email
            </label>
            <input
              className="nb-input"
              id="role-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ flex: '0 1 200px' }}>
            <label className="nb-label" htmlFor="role-role">
              Role
            </label>
            <select
              className="nb-select"
              id="role-role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="nb-label" htmlFor="role-reason">
            Reason (goes in the audit log)
          </label>
          <input
            className="nb-input"
            id="role-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
          />
        </div>
        <div className="row">
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy}>
            {busy ? 'Saving' : 'Save'}
          </button>
        </div>
      </form>
      {load === 'loading' ? (
        <Loading label="Loading roles" />
      ) : load === 'error' ? (
        <ErrorState title="Roles did not load" />
      ) : entries.length === 0 ? (
        <Empty title="Nobody has a role yet">
          <p>Admins set in the deploy settings aren’t listed here.</p>
        </Empty>
      ) : (
        <div
          className="tbl-wrap"
          tabIndex={0}
          role="group"
          aria-label="Table. Scroll sideways to see every column."
        >
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([address, r]) => (
                <tr key={address}>
                  <td>{address}</td>
                  <td>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SpacesTab() {
  const toast = useToast();
  const { spaces } = useSpaces();
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('10');
  const [postingRoles, setPostingRoles] = useState<Role[]>([...ROLES]);
  const [busy, setBusy] = useState(false);

  const start = (spaceSlug: string | null) => {
    const space = spaces.find((s) => s.slug === spaceSlug);
    setEditing(spaceSlug);
    setSlug(space?.slug ?? '');
    setName(space?.name ?? '');
    setDescription(space?.description ?? '');
    setOrder(String(space?.order ?? spaces.length + 1));
    setPostingRoles(space?.postingRoles ?? [...ROLES]);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.manageSpace({
        action: editing ? 'update' : 'create',
        slug,
        name,
        description,
        order: Number(order) || 0,
        postingRoles,
      });
      toast(editing ? 'Space updated.' : 'Space created.');
      start(null);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div
        className="tbl-wrap"
        tabIndex={0}
        role="group"
        aria-label="Table. Scroll sideways to see every column."
      >
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Space</th>
              <th scope="col">Address</th>
              <th scope="col">Threads</th>
              <th scope="col">Who can post</th>
              <th scope="col">Edit</th>
            </tr>
          </thead>
          <tbody>
            {spaces.map((space) => (
              <tr key={space.id}>
                <td>{space.name}</td>
                <td>/s/{space.slug}</td>
                <td className="num">{space.postCount ?? 0}</td>
                <td>{space.postingRoles.join(', ')}</td>
                <td>
                  <button className="nb-btn nb-btn--sm" type="button" onClick={() => start(space.slug)}>
                    Edit {space.name}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="panel" onSubmit={(event) => void submit(event)}>
        <h2>{editing ? `Edit ${name}` : 'Add a space'}</h2>
        <div className="field-row">
          <div className="field">
            <label className="nb-label" htmlFor="space-name">
              Name
            </label>
            <input
              className="nb-input"
              id="space-name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="nb-label" htmlFor="space-slug">
              Address (lowercase, dashes)
            </label>
            <input
              className="nb-input"
              id="space-slug"
              value={slug}
              maxLength={40}
              disabled={!!editing}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ flex: '0 1 120px' }}>
            <label className="nb-label" htmlFor="space-order">
              Order
            </label>
            <input
              className="nb-input"
              id="space-order"
              type="number"
              min={0}
              max={999}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="nb-label" htmlFor="space-description">
            Description
          </label>
          <input
            className="nb-input"
            id="space-description"
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <fieldset className="radio-list">
          <legend>Who can start threads here</legend>
          {ROLES.map((r) => (
            <label key={r}>
              <input
                type="checkbox"
                checked={postingRoles.includes(r)}
                onChange={(e) =>
                  setPostingRoles((current) =>
                    e.target.checked ? [...current, r] : current.filter((x) => x !== r),
                  )
                }
              />
              {r}
            </label>
          ))}
        </fieldset>
        <div className="row">
          <button
            className="nb-btn nb-btn--primary"
            type="submit"
            disabled={busy || postingRoles.length === 0}
          >
            {busy ? 'Saving' : editing ? 'Save changes' : 'Create space'}
          </button>
          {editing && (
            <button className="nb-btn nb-btn--quiet" type="button" onClick={() => start(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function UsageTab() {
  const [usage, setUsage] = useState<AiUsageResult | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const fetchUsage = () => {
    setLoad('loading');
    api.getAiUsage({}).then(
      (result) => {
        setUsage(result);
        setLoad('ready');
      },
      () => setLoad('error'),
    );
  };
  useEffect(fetchUsage, []);
  if (load === 'loading') return <Loading label="Loading usage" />;
  if (load === 'error' || !usage) return <ErrorState title="Usage did not load" onRetry={fetchUsage} />;
  const percent = Math.min(100, Math.round((usage.used / Math.max(1, usage.budget)) * 100));
  return (
    <div className="stack">
      <section className="panel">
        <h2>Today ({usage.date})</h2>
        <div
          className="meter"
          role="meter"
          aria-label="Share of today’s AI budget used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <dl className="kv">
          <dt>Tokens used</dt>
          <dd>
            {usage.used.toLocaleString()} of {usage.budget.toLocaleString()} ({percent}%)
          </dd>
          <dt>Model calls</dt>
          <dd>{usage.calls.toLocaleString()}</dd>
          <dt>Provider</dt>
          <dd>{usage.provider}</dd>
        </dl>
        <p className="muted">
          When the day’s budget runs out, summaries and question suggestions stop until tomorrow, and new
          posts go up without the automatic check. Reports and mods still work. AI_DAILY_TOKEN_BUDGET sets the
          budget.
        </p>
      </section>
      {usage.days.length > 0 && (
        <div
          className="tbl-wrap"
          tabIndex={0}
          role="group"
          aria-label="Table. Scroll sideways to see every column."
        >
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Tokens in</th>
                <th scope="col">Tokens out</th>
                <th scope="col">Calls</th>
              </tr>
            </thead>
            <tbody>
              {usage.days.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td className="num">{day.input.toLocaleString()}</td>
                  <td className="num">{day.output.toLocaleString()}</td>
                  <td className="num">{day.calls.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function SettingsTab() {
  const toast = useToast();
  const [banned, setBanned] = useState('');
  const [calendar, setCalendar] = useState('');
  const [message, setMessage] = useState(DEFAULT_WELLBEING_RESOURCES.message);
  const [items, setItems] = useState(
    DEFAULT_WELLBEING_RESOURCES.items.map((i) => `${i.label} | ${i.detail}`).join('\n'),
  );
  const [load, setLoad] = useState<Load>('loading');

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, 'config', 'ai')),
      getDoc(doc(db, 'config', 'calendar')),
      getDoc(doc(db, 'config', 'resources')),
    ]).then(
      ([ai, cal, res]) => {
        setBanned(((ai.data()?.bannedTopics as string[] | undefined) ?? []).join('\n'));
        setCalendar(((cal.data()?.notes as string[] | undefined) ?? []).join('\n'));
        const r = res.data();
        if (r?.message) setMessage(String(r.message));
        if (Array.isArray(r?.items)) {
          setItems(
            (r.items as { label: string; detail: string }[])
              .map((i) => `${i.label} | ${i.detail}`)
              .join('\n'),
          );
        }
        setLoad('ready');
      },
      () => setLoad('error'),
    );
  }, []);

  const save = async (which: 'ai' | 'calendar' | 'resources') => {
    try {
      if (which === 'ai') await api.updateConfig({ doc: 'ai', bannedTopics: lines(banned) });
      if (which === 'calendar') await api.updateConfig({ doc: 'calendar', notes: lines(calendar) });
      if (which === 'resources') {
        await api.updateConfig({
          doc: 'resources',
          message,
          items: lines(items).map((line) => {
            const [label, ...rest] = line.split('|');
            return { label: (label ?? '').trim(), detail: rest.join('|').trim() };
          }),
        });
      }
      toast('Saved.');
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  if (load === 'loading') return <Loading label="Loading settings" />;
  if (load === 'error') return <ErrorState title="Settings did not load" />;
  return (
    <div className="stack">
      <section className="panel">
        <h2>Topics the question of the day should avoid</h2>
        <div className="field">
          <label className="nb-label" htmlFor="set-banned">
            One topic per line
          </label>
          <textarea
            className="nb-textarea"
            id="set-banned"
            value={banned}
            onChange={(e) => setBanned(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="nb-btn" type="button" onClick={() => void save('ai')}>
            Save topics
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>School calendar notes</h2>
        <p className="muted">
          Short notes the model may use for timely questions, such as “Spirit week starts Monday”.
        </p>
        <div className="field">
          <label className="nb-label" htmlFor="set-calendar">
            One note per line
          </label>
          <textarea
            className="nb-textarea"
            id="set-calendar"
            value={calendar}
            onChange={(e) => setCalendar(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="nb-btn" type="button" onClick={() => void save('calendar')}>
            Save notes
          </button>
        </div>
      </section>
      <section className="panel">
        <h2>What a student sees after a wellbeing flag</h2>
        <p className="muted">Please have the counseling office review this wording before launch.</p>
        <div className="field">
          <label className="nb-label" htmlFor="set-message">
            Message
          </label>
          <textarea
            className="nb-textarea"
            id="set-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="nb-label" htmlFor="set-items">
            Resources, one per line, as “Name | detail”
          </label>
          <textarea
            className="nb-textarea"
            id="set-items"
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="nb-btn" type="button" onClick={() => void save('resources')}>
            Save resources
          </button>
        </div>
      </section>
    </div>
  );
}

type Tab = 'roles' | 'spaces' | 'question' | 'usage' | 'settings';
const TABS: [Tab, string][] = [
  ['roles', 'Roles'],
  ['spaces', 'Spaces'],
  ['question', 'Question of the day'],
  ['usage', 'AI budget'],
  ['settings', 'Settings'],
];

export default function Admin() {
  const [tab, setTab] = useState<Tab>('roles');
  useEffect(() => {
    document.title = `Administration  | ${APP_NAME}`;
  }, []);
  return (
    <Page>
      <div className="page">
        <div className="row row--between">
          <h1 className="page-h">Administration</h1>
          <Link className="nb-btn" to="/admin/audit">
            Open the audit log
          </Link>
        </div>
        <div className="tabs" role="tablist" aria-label="Administration sections">
          {TABS.map(([value, label]) => (
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
        {tab === 'roles' && <RolesTab />}
        {tab === 'spaces' && <SpacesTab />}
        {tab === 'question' && <QuestionApprovals />}
        {tab === 'usage' && <UsageTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </Page>
  );
}

/** /admin/audit: every moderation action, role change and role change. Append-only. */
export function AuditLog() {
  const toast = useToast();
  const [entries, setEntries] = useState<(AuditLogEntry & { id: string })[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const fetchLog = () => {
    setLoad('loading');
    getDocs(query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(200))).then(
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditLogEntry) })));
        setLoad('ready');
      },
      () => setLoad('error'),
    );
  };
  useEffect(() => {
    document.title = `Audit log  | ${APP_NAME}`;
    fetchLog();
  }, []);
  const exportLog = async () => {
    try {
      downloadJson('nobles-commons-audit-log.json', await api.exportAuditLog({ limit: 1000 }));
      toast('Exported. The export is logged too.');
      fetchLog();
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <Page>
      <div className="page">
        <div className="row row--between">
          <h1 className="page-h">Audit log</h1>
          <div className="row">
            <Link className="nb-btn nb-btn--quiet" to="/admin">
              Back to admin
            </Link>
            <button className="nb-btn" type="button" onClick={() => void exportLog()}>
              Export
            </button>
          </div>
        </div>
        <p className="page-lede">
          Every mod action and role change, newest first. Nobody can edit or delete these.
        </p>
        {load === 'loading' ? (
          <Loading label="Loading the log" />
        ) : load === 'error' ? (
          <ErrorState title="The log did not load" onRetry={fetchLog} />
        ) : entries.length === 0 ? (
          <Empty title="The log is empty" />
        ) : (
          <div
            className="tbl-wrap"
            tabIndex={0}
            role="group"
            aria-label="Table. Scroll sideways to see every column."
          >
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">About</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="num">
                      {entry.createdAt?.toMillis ? new Date(entry.createdAt.toMillis()).toLocaleString() : ''}
                    </td>
                    <td>{entry.actorEmail}</td>
                    <td>{entry.action}</td>
                    <td>{entry.contentKey ?? entry.target ?? ''}</td>
                    <td>{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}
