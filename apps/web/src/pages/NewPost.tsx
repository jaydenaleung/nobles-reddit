import {
  APP_NAME,
  LIMITS,
  createPostSchema,
  type ContentStatusResult,
  type CreatePostInput,
} from '@commons/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, waitForOutcome } from '../api';
import { useMember } from '../auth/AuthContext';
import { HeldNotice, WellbeingPanel } from '../components/Composer';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { Count } from '../components/Ui';
import { useMine, useSpaces } from '../data/hooks';
import { clearDraft, loadDraft, saveDraft, type Draft } from '../lib/storage';

type Kind = Draft['kind'];
const KIND_LABELS: Record<Kind, string> = { text: 'Text', link: 'Link', poll: 'Poll' };

export default function NewPost() {
  const member = useMember();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { spaces, bySlug } = useSpaces();
  const mine = useMine();
  const id = useId();
  const draft = useRef(loadDraft()).current;

  const [kind, setKind] = useState<Kind>(draft?.kind ?? 'text');
  const [spaceId, setSpaceId] = useState(draft?.spaceId ?? '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [url, setUrl] = useState(draft?.url ?? '');
  const [options, setOptions] = useState<string[]>(draft?.options?.length ? draft.options : ['', '']);
  const [busy, setBusy] = useState<'idle' | 'sending' | 'checking'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ContentStatusResult | null>(null);

  useEffect(() => {
    document.title = `Start a thread  | ${APP_NAME}`;
  }, []);

  // Preselect the space from ?space=slug, or the first one the person can post in.
  const allowed = spaces.filter((s) => s.postingRoles.includes(member.role));
  useEffect(() => {
    if (spaceId && allowed.some((s) => s.id === spaceId)) return;
    const wanted = bySlug(params.get('space') ?? '');
    if (wanted && allowed.some((s) => s.id === wanted.id)) setSpaceId(wanted.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaces]);

  // The draft is kept on this device only. Nothing is sent until you press Post.
  useEffect(() => {
    if (outcome) return;
    saveDraft({ kind, spaceId, title, body, url, options });
  }, [kind, spaceId, title, body, url, options, outcome]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!spaceId) {
      setError('Pick a space.');
      return;
    }
    const base = { spaceId, title };
    const input: CreatePostInput =
      kind === 'text'
        ? { ...base, kind, body }
        : kind === 'link'
          ? { ...base, kind, body, url }
          : { ...base, kind, body, options: options.map((o) => o.trim()).filter(Boolean) };
    // The same checks the server runs, so mistakes are caught before anything is sent.
    const checked = createPostSchema.safeParse(input);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Something in the form isn’t right.');
      return;
    }
    setBusy('sending');
    try {
      const created = await api.createPost(input);
      clearDraft();
      setBusy('checking');
      const result = await waitForOutcome(created.contentKey);
      mine.refresh();
      if (result.outcome === 'visible') {
        navigate(`/t/${created.postId}`);
        return;
      }
      setOutcome(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('idle');
    }
  };

  if (outcome) {
    return (
      <Page>
        <div className="page">
          <h1 className="page-h">{outcome.outcome === 'wellbeing' ? 'Thanks for writing this' : 'Saved'}</h1>
          {outcome.outcome === 'wellbeing' && outcome.resources ? (
            <WellbeingPanel resources={outcome.resources} />
          ) : outcome.outcome === 'held' ? (
            <HeldNotice />
          ) : (
            <div className="nb-notice" role="status">
              <div>
                <b>Still being checked.</b> It’ll show up in the feed in a minute. It’s also under You.
              </div>
            </div>
          )}
          <div className="row">
            <Link className="nb-btn nb-btn--primary" to="/">
              Back to the front page
            </Link>
            <Link className="nb-btn" to="/me">
              See your posts
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <form className="nb-composer" onSubmit={(event) => void submit(event)} noValidate>
        <div className="row row--between">
          <h1 className="page-h">Start a thread</h1>
          <Link className="nb-btn nb-btn--quiet nb-btn--sm" to="/">
            Cancel
          </Link>
        </div>

        <p className="reply__as">
          Posting as <b>{member.profile.displayName}</b>
        </p>

        <div className="field" style={{ maxWidth: 360 }}>
          <label className="nb-label" htmlFor={`${id}-space`}>
            Space
          </label>
          <select
            className="nb-select"
            id={`${id}-space`}
            value={spaceId}
            onChange={(e) => setSpaceId(e.target.value)}
          >
            <option value="">Pick a space</option>
            {allowed.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>

        <div className="tabs" role="tablist" aria-label="Kind of thread">
          {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="field">
          <div className="row row--between">
            <label className="nb-label" htmlFor={`${id}-title`}>
              {kind === 'poll' ? 'Your question' : 'Title'}
            </label>
            <Count value={title.trim().length} max={LIMITS.titleMax} />
          </div>
          <input
            className="nb-input"
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {kind === 'link' && (
          <div className="field">
            <label className="nb-label" htmlFor={`${id}-url`}>
              Link
            </label>
            <input
              className="nb-input"
              id={`${id}-url`}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="nb-help">Links have to start with https://.</p>
          </div>
        )}

        {kind === 'poll' && (
          <fieldset className="opts" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="nb-label">Options (2 to {LIMITS.pollMaxOptions})</legend>
            {options.map((option, i) => (
              <div className="opts__row" key={i}>
                <input
                  className="nb-input"
                  aria-label={`Option ${i + 1}`}
                  value={option}
                  maxLength={LIMITS.pollOptionMax}
                  onChange={(e) =>
                    setOptions((current) => current.map((o, j) => (j === i ? e.target.value : o)))
                  }
                />
                {options.length > LIMITS.pollMinOptions && (
                  <button
                    className="nb-btn nb-btn--quiet nb-btn--sm"
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setOptions((current) => current.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {options.length < LIMITS.pollMaxOptions && (
              <div>
                <button
                  className="nb-btn nb-btn--sm"
                  type="button"
                  onClick={() => setOptions((current) => [...current, ''])}
                >
                  <Icon name="plus" /> Add an option
                </button>
              </div>
            )}
          </fieldset>
        )}

        <div className="field">
          <div className="row row--between">
            <label className="nb-label" htmlFor={`${id}-body`}>
              {kind === 'text' ? 'Text' : 'Text (optional)'}
            </label>
            <Count value={body.trim().length} max={LIMITS.bodyMax} />
          </div>
          <textarea
            className="nb-textarea"
            id={`${id}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
          <p className="nb-help">*italic*, **bold** and https links work. Your draft stays on this device.</p>
        </div>

        <p className="nb-help">
          Keep it to the <Link to="/values">community values</Link>. Focus on ideas, not the people who wrote
          them.
        </p>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}
        <div className="nb-composer__foot">
          <span className="nb-meta" role="status">
            {busy === 'checking' ? 'Checking your post. This takes a few seconds.' : ''}
          </span>
          <button className="nb-btn nb-btn--primary" type="submit" disabled={busy !== 'idle'}>
            {busy === 'sending' ? 'Posting' : busy === 'checking' ? 'Checking' : 'Post'}
          </button>
        </div>
      </form>
    </Page>
  );
}
